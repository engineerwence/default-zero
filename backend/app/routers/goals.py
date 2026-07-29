from fastapi import APIRouter, Depends, HTTPException
from ..database import supabase, get_current_user
from ..schemas import LifeGoalCreate, LifeGoalUpdate

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("")
def list_goals(user=Depends(get_current_user)):
    response = (
        supabase.table("life_goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


@router.post("")
def create_goal(payload: LifeGoalCreate, user=Depends(get_current_user)):
    response = supabase.table("life_goals").insert({
        "user_id": user.id,
        "title": payload.title,
        "description": payload.description,
        "container_key": payload.container_key,
        "target_date": payload.target_date,
    }).execute()
    return response.data


@router.patch("/{goal_id}")
def update_goal(goal_id: str, payload: LifeGoalUpdate, user=Depends(get_current_user)):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update.")

    response = (
        supabase.table("life_goals")
        .update(update)
        .eq("id", goal_id)
        .eq("user_id", user.id)  # can't touch someone else's goal even with a guessed id
        .execute()
    )
    return response.data
