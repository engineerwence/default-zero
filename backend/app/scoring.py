from datetime import datetime, timezone, timedelta
from .database import supabase


def parse_date(iso_str: str):
    return datetime.fromisoformat(iso_str.replace("Z", "+00:00")).date()


def current_streak(dates: set) -> int:
    """Consecutive days with at least one entry, counted backward from today, with a
    1-day grace period. If the most recent entry is 2+ days old, the streak is broken."""
    if not dates:
        return 0
    today = datetime.now(timezone.utc).date()
    most_recent = max(dates)
    if (today - most_recent).days > 1:
        return 0

    streak = 0
    cursor = most_recent
    while cursor in dates:
        streak += 1
        cursor = cursor - timedelta(days=1)
    return streak


def recency_score(dates: set) -> float:
    if not dates:
        return 0.0
    today = datetime.now(timezone.utc).date()
    days_since = (today - max(dates)).days
    return max(0.0, 100.0 - days_since * 20.0)


def container_score_from_dates(dates: set) -> int:
    streak = current_streak(dates)
    streak_component = min(streak, 30) / 30 * 100
    recency_component = recency_score(dates)
    return round(0.6 * streak_component + 0.4 * recency_component)


def get_container_score(user_id: str, container_key: str) -> int:
    """Used by mentorship matching to rank candidate mentors by actual strength in
    a container, not just whoever signed up first."""
    entries = (
        supabase.table("container_entries")
        .select("created_at")
        .eq("user_id", user_id)
        .eq("container_key", container_key)
        .execute()
        .data
        or []
    )
    dates = set()
    for e in entries:
        try:
            dates.add(parse_date(e["created_at"]))
        except Exception:
            continue
    return container_score_from_dates(dates)
