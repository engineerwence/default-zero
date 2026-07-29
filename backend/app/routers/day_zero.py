from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.concurrency import run_in_threadpool
from ..database import supabase, get_current_user

router = APIRouter(prefix="/day-zero", tags=["day-zero"])

MAX_VIDEO_BYTES = 150 * 1024 * 1024  # 150MB — generous for a short video, protects RAM on a small instance
CHUNK_SIZE = 1024 * 1024  # read 1MB at a time instead of the whole file at once


@router.post("/upload")
async def upload_day_zero(file: UploadFile = File(...), user=Depends(get_current_user)):
    # Enforce the one-time lock here too, not just in the frontend — a user retrying a failed
    # upload, or someone bypassing the app UI, shouldn't be able to overwrite a locked video.
    existing = (
        supabase.table("day_zero_videos")
        .select("id")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="Day Zero has already been recorded and is locked.")

    # Read in chunks instead of file.read() all at once — caps peak memory per upload
    # regardless of video length, so several concurrent uploads on launch day don't
    # each grab the full file size in RAM simultaneously.
    size = 0
    chunks = []
    while chunk := await file.read(CHUNK_SIZE):
        size += len(chunk)
        if size > MAX_VIDEO_BYTES:
            raise HTTPException(status_code=413, detail="Video too large. Keep it under 150MB.")
        chunks.append(chunk)
    contents = b"".join(chunks)

    storage_path = f"{user.id}/day-zero.mp4"

    # supabase-py's storage client is synchronous — run it in a threadpool so it doesn't
    # block the event loop (and every other user's request) while the upload is in flight.
    def do_upload():
        return supabase.storage.from_("day-zero-videos").upload(
            storage_path, contents, file_options={"content-type": file.content_type or "video/mp4"}
        )

    try:
        await run_in_threadpool(do_upload)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload to storage failed: {e}")

    supabase.table("day_zero_videos").insert({
        "user_id": user.id,
        "video_url": storage_path,
    }).execute()

    return {"status": "locked", "size_bytes": size}


@router.get("/status")
def get_status(user=Depends(get_current_user)):
    response = (
        supabase.table("day_zero_videos")
        .select("locked_at")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    has_recorded = bool(response.data)
    return {"recorded": has_recorded}
