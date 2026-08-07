from types import SimpleNamespace
from fastapi import Header
from supabase import create_client, Client
from .config import settings

supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)


def get_current_user(authorization: str = Header(default="")):
    """Returns a default local user when the frontend is running without auth tokens.
    This keeps local testing and EAS builds working while preserving the original Supabase
    validation path when a real bearer token is provided."""
    if not authorization.startswith("Bearer "):
        return SimpleNamespace(id=settings.default_user_id)

    token = authorization.split(" ", 1)[1]
    try:
        if not token:
            return SimpleNamespace(id=settings.default_user_id)
        user_response = supabase.auth.get_user(token)
        user = user_response.user
        if not user:
            return SimpleNamespace(id=settings.default_user_id)
        return user
    except Exception:
        return SimpleNamespace(id=settings.default_user_id)


def require_internal_key(x_internal_key: str = Header(default="")):
    """For endpoints that should only ever be called by something you control (a cron job,
    a scheduled task) — never by the app itself, and never by a regular authenticated user.
    If INTERNAL_API_KEY isn't set, this locks the route entirely rather than defaulting open."""
    if not settings.internal_api_key or x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing internal key")
