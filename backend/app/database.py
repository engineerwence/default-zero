from fastapi import Header, HTTPException
from supabase import create_client, Client
from .config import settings

supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)


def get_current_user(authorization: str = Header(default="")):
    """Validates the Supabase JWT passed from the frontend and returns the user."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1]
    try:
        user_response = supabase.auth.get_user(token)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_internal_key(x_internal_key: str = Header(default="")):
    """For endpoints that should only ever be called by something you control (a cron job,
    a scheduled task) — never by the app itself, and never by a regular authenticated user.
    If INTERNAL_API_KEY isn't set, this locks the route entirely rather than defaulting open."""
    if not settings.internal_api_key or x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing internal key")
