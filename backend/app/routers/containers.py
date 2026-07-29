import re
from fastapi import APIRouter, Depends, HTTPException
from ..database import supabase, get_current_user
from ..schemas import ContainerEntryCreate, ContainerSummary, ContainerCreate
from ..scoring import parse_date, container_score_from_dates

router = APIRouter(prefix="/containers", tags=["containers"])


def slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug or "container"


@router.get("/list")
def list_containers(user=Depends(get_current_user)):
    """Defaults (shared) plus this user's own custom/Socrates-suggested containers."""
    response = (
        supabase.table("containers")
        .select("*")
        .or_(f"user_id.is.null,user_id.eq.{user.id}")
        .order("created_at")
        .execute()
    )
    return response.data


@router.post("/list")
def create_container(payload: ContainerCreate, user=Depends(get_current_user)):
    slug = slugify(payload.title)
    response = supabase.table("containers").insert({
        "user_id": user.id,
        "slug": slug,
        "title": payload.title,
        "icon": payload.icon or "ellipse-outline",
        "source": payload.source or "user",
    }).execute()
    return response.data


@router.get("/summary", response_model=ContainerSummary)
def get_summary(user=Depends(get_current_user)):
    containers = (
        supabase.table("containers")
        .select("slug")
        .or_(f"user_id.is.null,user_id.eq.{user.id}")
        .execute()
        .data
        or []
    )
    entries = (
        supabase.table("container_entries")
        .select("container_key, created_at")
        .eq("user_id", user.id)
        .execute()
        .data
        or []
    )

    dates_by_container = {c["slug"]: set() for c in containers}
    for e in entries:
        key = e["container_key"]
        dates_by_container.setdefault(key, set())
        try:
            dates_by_container[key].add(parse_date(e["created_at"]))
        except Exception:
            continue

    scores = {slug: container_score_from_dates(dates) for slug, dates in dates_by_container.items()}

    # Average across ALL containers, including empty ones scoring 0 — this is what
    # actually enforces "proof over performance" across the whole person, not just
    # wherever they happen to be strong.
    proof_score = round(sum(scores.values()) / len(scores)) if scores else 0

    return ContainerSummary(containers=scores, proof_score=proof_score)


@router.get("/{container_key}/entries")
def get_entries(container_key: str, user=Depends(get_current_user)):
    response = (
        supabase.table("container_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("container_key", container_key)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


@router.post("/entries")
def create_entry(entry: ContainerEntryCreate, user=Depends(get_current_user)):
    response = (
        supabase.table("container_entries")
        .insert({
            "user_id": user.id,
            "container_key": entry.container_key,
            "title": entry.title,
            "note": entry.note,
        })
        .execute()
    )
    return response.data
