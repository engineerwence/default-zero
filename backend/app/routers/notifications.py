import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..database import supabase, get_current_user, require_internal_key
from ..scoring import parse_date, container_score_from_dates

router = APIRouter(prefix="/notifications", tags=["notifications"])

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
STALE_SCORE_THRESHOLD = 30  # containers scoring below this are considered worth nudging about


class PushTokenIn(BaseModel):
    push_token: str


class SendNudgeIn(BaseModel):
    user_id: str
    title: str
    body: str


@router.post("/register-token")
def register_token(payload: PushTokenIn, user=Depends(get_current_user)):
    # Upsert so re-registering (e.g. reinstall, new device) overwrites the old token
    # cleanly instead of accumulating stale duplicates for the same user.
    supabase.table("push_tokens").upsert({
        "user_id": user.id,
        "push_token": payload.push_token,
    }, on_conflict="user_id").execute()
    return {"status": "registered"}


async def send_push_notification(push_token: str, title: str, body: str):
    """Sends one push notification through Expo's push service.

    The 'sound' field references the filename bundled via the expo-notifications config
    plugin in app.json — Expo Go on iOS will just use the default system sound since the
    custom neigh.wav is only bundled into a real build (EAS build), not Expo Go itself.
    """
    message = {
        "to": push_token,
        "sound": "default",
        "title": title,
        "body": body,
        "priority": "high",
        "channelId": "default",  # matches the Android channel created in notifications.js
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            EXPO_PUSH_URL,
            json=message,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=10.0,
        )
        return response.json()


@router.post("/send", dependencies=[Depends(require_internal_key)])
async def send_nudge(payload: SendNudgeIn):
    """Locked to internal callers only (see require_internal_key) — this is NOT reachable
    by a regular signed-in user anymore. Meant to be called by a scheduled job, not the app."""
    token_row = (
        supabase.table("push_tokens").select("push_token").eq("user_id", payload.user_id).maybe_single().execute()
    )
    if not token_row.data:
        raise HTTPException(status_code=404, detail="No push token on file for this user.")

    result = await send_push_notification(token_row.data["push_token"], payload.title, payload.body)
    return result


@router.post("/nudge-stale-containers", dependencies=[Depends(require_internal_key)])
async def nudge_stale_containers():
    """The actual 'harness discipline through Default Zero' mechanism: run this once a day
    from an external scheduler (Render Cron Job, or a free service like cron-job.org hitting
    this URL with the X-Internal-Key header) to nudge anyone whose containers have gone
    quiet, using the same Proof Score math the dashboard shows them.

    This does NOT touch Socrates/Groq at all — it's plain data + a templated message — so it
    carries none of the AI rate-limit risk, only the push-notification volume itself."""
    containers = supabase.table("containers").select("id, user_id, slug, title").execute().data or []
    all_entries = supabase.table("container_entries").select("user_id, container_key, created_at").execute().data or []
    tokens = supabase.table("push_tokens").select("user_id, push_token").execute().data or []
    token_by_user = {t["user_id"]: t["push_token"] for t in tokens}

    # Build { (user_id, container_key): set(dates) }
    dates_by_user_container = {}
    for e in all_entries:
        key = (e["user_id"], e["container_key"])
        dates_by_user_container.setdefault(key, set())
        try:
            dates_by_user_container[key].add(parse_date(e["created_at"]))
        except Exception:
            continue

    nudged = 0
    skipped_no_token = 0

    # Only worth checking users who actually have a container AND a push token
    user_container_pairs = {(c["user_id"], c["slug"], c["title"]) for c in containers if c["user_id"]}
    # Default containers apply to everyone with a token, not just rows with user_id set
    default_containers = [c for c in containers if c["user_id"] is None]
    all_users_with_tokens = set(token_by_user.keys())
    for uid in all_users_with_tokens:
        for c in default_containers:
            user_container_pairs.add((uid, c["slug"], c["title"]))

    for user_id, slug, title in user_container_pairs:
        push_token = token_by_user.get(user_id)
        if not push_token:
            skipped_no_token += 1
            continue

        dates = dates_by_user_container.get((user_id, slug), set())
        score = container_score_from_dates(dates)
        if score < STALE_SCORE_THRESHOLD:
            await send_push_notification(
                push_token,
                "Default Zero",
                f"Your {title} container has gone quiet. What's actually stopping you?",
            )
            nudged += 1

    return {"nudged": nudged, "skipped_no_token": skipped_no_token}
