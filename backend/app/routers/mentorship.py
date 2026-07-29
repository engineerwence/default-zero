from fastapi import APIRouter, Depends, HTTPException
from ..database import supabase, get_current_user
from ..schemas import MentorshipMatchOut, MentorshipRequestIn
from ..scoring import get_container_score

router = APIRouter(prefix="/mentorship", tags=["mentorship"])


def normalize_profession(text: str) -> str:
    return text.strip().lower()


@router.get("/match")
def get_match(user=Depends(get_current_user)):
    response = (
        supabase.table("mentor_matches")
        .select("*")
        .eq("mentee_id", user.id)
        .maybe_single()
        .execute()
    )
    return response.data


def _mentor_load(mentor_id: str) -> int:
    """How many mentees this mentor currently has, across all lanes."""
    matches = (
        supabase.table("mentor_matches").select("id").eq("mentor_id", mentor_id).execute().data or []
    )
    return len(matches)


def _find_best_mentor_for_container(container_key: str, mentee_id: str):
    """Real ranking, not first-come-first-served: candidates must have capacity left,
    then are ranked by actual strength in that container (their Proof Score for it),
    then by who has the fewest mentees already, so load doesn't pile onto one person."""
    candidates = (
        supabase.table("mentorship_lanes")
        .select("user_id, max_mentees")
        .eq("role", "mentor")
        .eq("container_key", container_key)
        .eq("status", "available")
        .neq("user_id", mentee_id)
        .execute()
        .data
        or []
    )

    ranked = []
    for c in candidates:
        load = _mentor_load(c["user_id"])
        if load >= c["max_mentees"]:
            continue  # this mentor is full
        score = get_container_score(c["user_id"], container_key)
        ranked.append((score, -load, c["user_id"]))  # higher score better, lower load better

    if not ranked:
        return None
    ranked.sort(reverse=True)  # highest score first, then least loaded as tiebreak
    return ranked[0][2]


def _find_best_mentor_for_profession(profession: str, mentee_id: str):
    normalized = normalize_profession(profession)
    candidates = (
        supabase.table("mentorship_lanes")
        .select("user_id, max_mentees, profession")
        .eq("role", "mentor")
        .eq("status", "available")
        .neq("user_id", mentee_id)
        .execute()
        .data
        or []
    )

    # v1 matching: exact match first, then "contains" as a looser fallback — free text
    # professions won't line up perfectly ("dev" vs "developer"), so this is intentionally
    # forgiving rather than requiring an exact string match that will rarely hit.
    exact = [c for c in candidates if c.get("profession") and normalize_profession(c["profession"]) == normalized]
    loose = [
        c for c in candidates
        if c.get("profession") and normalized in normalize_profession(c["profession"])
        or (c.get("profession") and normalize_profession(c["profession"]) in normalized)
    ]
    pool = exact or loose

    available = [c for c in pool if _mentor_load(c["user_id"]) < c["max_mentees"]]
    if not available:
        return None
    # No meaningful "score" for profession lanes (no container data to rank by) —
    # least-loaded mentor is the fair default here.
    available.sort(key=lambda c: _mentor_load(c["user_id"]))
    return available[0]["user_id"]


@router.post("/request")
def request_match(payload: MentorshipRequestIn, user=Depends(get_current_user)):
    if not payload.container_key and not payload.profession:
        raise HTTPException(status_code=400, detail="Provide either a container_key or a profession.")
    if payload.container_key and payload.profession:
        raise HTTPException(status_code=400, detail="Provide only one: container_key OR profession, not both.")

    if payload.role == "mentor":
        supabase.table("mentorship_lanes").insert({
            "user_id": user.id,
            "role": "mentor",
            "container_key": payload.container_key,
            "profession": payload.profession,
            "status": "available",
        }).execute()
        return {"status": "opted_in_as_mentor"}

    # role == 'mentee': try to match immediately rather than leaving it pending forever —
    # simple and synchronous is the right v1 given real-time matching pools will be small
    # at launch. Revisit with a background job once the mentor pool is large enough that
    # this lookup gets expensive.
    if payload.container_key:
        mentor_id = _find_best_mentor_for_container(payload.container_key, user.id)
        lane_label = payload.container_key
        lane_type = "container"
    else:
        mentor_id = _find_best_mentor_for_profession(payload.profession, user.id)
        lane_label = payload.profession
        lane_type = "profession"

    supabase.table("mentorship_lanes").insert({
        "user_id": user.id,
        "role": "mentee",
        "container_key": payload.container_key,
        "profession": payload.profession,
        "status": "matched" if mentor_id else "pending",
    }).execute()

    if not mentor_id:
        return {"status": "pending", "reason": "No available mentor for this lane yet."}

    supabase.table("mentor_matches").insert({
        "mentee_id": user.id,
        "mentor_id": mentor_id,
        "lane": lane_label,
        "lane_type": lane_type,
    }).execute()

    return {"status": "matched"}
