import re
from fastapi import APIRouter, Depends, HTTPException, Request
from groq import AsyncGroq
from datetime import datetime, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address
from ..database import supabase, get_current_user
from ..schemas import SocratesMessageIn, SocratesMessageOut
from ..config import settings

router = APIRouter(prefix="/socrates", tags=["socrates"])

# Rate limit by caller IP — protects your Groq quota/cost from one user hammering the endpoint.
limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# Safety layer — this runs BEFORE the accountability prompt below, and overrides it
# entirely when triggered. This is not optional and should not be removed or weakened:
# the harsh, no-comfort Socratic style is appropriate for "did you log your entry today,"
# it is not appropriate for someone describing self-harm, suicidal thoughts, abuse, or a
# genuine crisis. Confronting contradictions is right for discipline; it is the wrong tool
# entirely for real pain, and could cause real harm if applied there.
# This keyword list is a blunt, best-effort net — not a clinical-grade classifier. Treat it
# as a floor, not a finished solution, before this is in front of real users at scale.
# ---------------------------------------------------------------------------

CRISIS_PATTERNS = [
    r"\bkill myself\b", r"\bsuicid", r"\bend my life\b", r"\bwant to die\b",
    r"\bdon'?t want to (be alive|live)\b", r"\bself[\s-]?harm\b", r"\bhurt(ing)? myself\b",
    r"\bcutting myself\b", r"\bno reason to live\b", r"\bbetter off dead\b",
]
CRISIS_REGEX = re.compile("|".join(CRISIS_PATTERNS), re.IGNORECASE)

SAFETY_REPLY = (
    "I'm not going to push you on discipline right now — what you're describing matters more than that. "
    "Please reach out to the Emergency Medicine Kenya Foundation's suicide prevention line at 0800 723 253 "
    "(toll-free, staffed by people trained in exactly this) or Befrienders Kenya, or talk to someone you "
    "trust in person. You don't have to carry this alone, and you don't have to earn support by having "
    "your containers in order first."
)


def is_crisis_message(text: str) -> bool:
    return bool(CRISIS_REGEX.search(text))


CRISIS_CLASSIFIER_PROMPT = (
    "You are a safety classifier for a discipline-app chat, nothing else. Read the message and decide: "
    "does it express suicidal thoughts, self-harm intent, an acute mental health crisis, or that the "
    "person is currently being abused or is in danger? This is different from normal complaining, "
    "stress, or venting about a bad day — those are SAFE. "
    "Reply with exactly one word, nothing else: CRISIS or SAFE."
)


async def classify_crisis_with_model(client: AsyncGroq, text: str) -> bool:
    """Second layer, only runs if the keyword net above didn't already catch it. Catches
    paraphrased or subtler crisis language the keyword list can't anticipate. Uses a small,
    fast model since this is a yes/no gate, not the main conversation.

    This fails OPEN (treats a classifier error as SAFE) rather than blocking the chat —
    the keyword net is the hard floor and always runs regardless; this is a second net on
    top of it, not a replacement, so a failure here doesn't remove the primary protection."""
    try:
        completion = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            max_tokens=5,
            temperature=0,
            messages=[
                {"role": "system", "content": CRISIS_CLASSIFIER_PROMPT},
                {"role": "user", "content": text},
            ],
        )
        result = completion.choices[0].message.content.strip().upper()
        return result.startswith("CRISIS")
    except Exception:
        return False


SOCRATES_SYSTEM_PROMPT = (
    "You are Socrates, the AI layer inside Default Zero, a discipline and accountability app. "
    "You operate on the actual Socratic method: you do not give advice, you do not give answers, "
    "and you do not tell the user what to do. You ask the question that makes them answer it themselves. "
    "\n\n"
    "You are given the user's real logged data below — their actual container entries, not "
    "self-reported feelings. Use it as your evidence. When what they say contradicts what they've "
    "logged, name the contradiction directly and ask them to explain it — do not soften it, do not "
    "let it pass. If a container is empty or stale, that silence is itself something to interrogate: "
    "ask why, not whether they meant to get to it. "
    "\n\n"
    "IMPORTANT DISTINCTION: this exacting, no-comfort style is for accountability on things within "
    "someone's control — habits, discipline, follow-through. It is NOT for genuine emotional pain, grief, "
    "relationship abuse, or distress. If the user describes real hurt rather than avoidance or excuse-making "
    "— someone who hurt them, grief, a loss, feeling genuinely overwhelmed — drop the confrontational mode "
    "for that part of the reply. Ask a real, non-interrogating question, or simply acknowledge what they said "
    "before continuing. You can still be direct without being cold about someone's pain. "
    "\n\n"
    "Hard rules: "
    "Never say 'I understand', 'that's okay', 'it's alright', or anything that excuses inaction — "
    "but this applies to avoidance and excuses, not to real pain, which deserves acknowledgment. "
    "Never offer a pep talk or generic encouragement — that is not your function. "
    "Never hand them a plan, a list of steps, or advice; if they ask you what to do, turn it back "
    "on them with a question that forces them to already know the answer. "
    "End most responses with a direct question, not a statement. "
    "\n\n"
    "You are not cruel — you do not insult them or attack who they are. You are exacting about avoidance "
    "and gentle about pain — those are different things and you can tell the difference. "
    "Keep responses to 2-4 sentences. Precision over warmth, except where warmth is actually warranted. "
    "\n\n"
    "CONTAINER SUGGESTIONS: the user's containers (life areas they track) are listed below. If — and only "
    "if — you notice a real, recurring pattern in this conversation that doesn't fit any existing container, "
    "you may propose exactly one new one. Do this rarely, not by default. If you do, end your ENTIRE reply "
    "with a new line formatted EXACTLY as: SUGGEST_CONTAINER: <short title, 2-4 words> "
    "— nothing after it. Do not explain the suggestion inline; the title alone is the suggestion."
)


def build_user_context(user_id: str):
    """Pulls this user's real data so Socrates responds to what they've actually done,
    not a generic prompt. Also returns the list of existing container titles so Socrates
    doesn't suggest a duplicate."""
    lines = []

    day_zero = (
        supabase.table("day_zero_videos").select("locked_at").eq("user_id", user_id).maybe_single().execute()
    )
    if day_zero.data:
        lines.append(f"Day Zero recorded on {day_zero.data['locked_at']}.")
    else:
        lines.append("Day Zero has not been recorded yet.")

    containers = (
        supabase.table("containers")
        .select("slug, title")
        .or_(f"user_id.is.null,user_id.eq.{user_id}")
        .execute()
        .data
        or []
    )
    existing_titles = [c["title"] for c in containers]

    for c in containers:
        key = c["slug"]
        entries = (
            supabase.table("container_entries")
            .select("title, created_at")
            .eq("user_id", user_id)
            .eq("container_key", key)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        rows = entries.data or []
        if not rows:
            lines.append(f"{c['title']}: no entries logged at all.")
            continue

        latest = rows[0]["created_at"]
        try:
            last_dt = datetime.fromisoformat(latest.replace("Z", "+00:00"))
            days_since = (datetime.now(timezone.utc) - last_dt).days
        except Exception:
            days_since = None

        titles = ", ".join(r["title"] for r in rows[:3])
        gap_note = f"{days_since} days since last entry" if days_since is not None else "recency unknown"
        lines.append(f"{c['title']}: {len(rows)} recent entries ({titles}). {gap_note}.")

    return "\n".join(lines), existing_titles


def extract_container_suggestion(reply: str):
    """Pulls a SUGGEST_CONTAINER line out of the reply if present, returns (clean_reply, suggestion|None)."""
    match = re.search(r"SUGGEST_CONTAINER:\s*(.+)$", reply.strip())
    if not match:
        return reply, None
    suggestion = match.group(1).strip()
    clean_reply = reply[: match.start()].strip()
    return clean_reply, suggestion


@router.post("/message", response_model=SocratesMessageOut)
@limiter.limit("10/minute")
async def send_message(request: Request, payload: SocratesMessageIn, user=Depends(get_current_user)):
    client = AsyncGroq(api_key=settings.groq_api_key)

    # Layer 1: keyword net — instant, zero cost, catches explicit language unconditionally.
    # Layer 2: small-model classifier — catches paraphrased/subtler crisis language the
    # keyword list can't anticipate. Layer 1 alone is the hard floor; layer 2 is a genuine
    # improvement on top of it, not a replacement — if it fails, layer 1 still stands.
    crisis_detected = is_crisis_message(payload.message)
    if not crisis_detected:
        crisis_detected = await classify_crisis_with_model(client, payload.message)

    if crisis_detected:
        supabase.table("socrates_sessions").insert({
            "user_id": user.id,
            "message": payload.message,
            "reply": SAFETY_REPLY,
        }).execute()
        return SocratesMessageOut(reply=SAFETY_REPLY, safety_mode=True)

    user_context, existing_titles = build_user_context(user.id)

    try:
        completion = await client.chat.completions.create(
            model="llama-3.1-70b-versatile",
            messages=[
                {"role": "system", "content": SOCRATES_SYSTEM_PROMPT},
                {"role": "system", "content": f"User's actual logged data:\n{user_context}"},
                {"role": "system", "content": f"Existing container titles (do not suggest duplicates of these): {', '.join(existing_titles)}"},
                {"role": "user", "content": payload.message},
            ],
        )
    except Exception:
        raise HTTPException(status_code=503, detail="Socrates is unavailable right now, try again shortly.")

    raw_reply = completion.choices[0].message.content
    clean_reply, suggestion = extract_container_suggestion(raw_reply)

    supabase.table("socrates_sessions").insert({
        "user_id": user.id,
        "message": payload.message,
        "reply": clean_reply,
    }).execute()

    return SocratesMessageOut(reply=clean_reply, suggested_container=suggestion)
