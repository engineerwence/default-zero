import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.routers import containers, day_zero, mentorship, socrates, notifications, finance, goals
from app.routers.socrates import limiter

app = FastAPI(title="Default Zero API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Comma-separated list in env, e.g. ALLOWED_ORIGINS=https://defaultzero.app,exp://192.168.1.5:8081
# Falls back to "*" only if nothing is set, so dev still works without config.
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Prevents a raw stack trace leaking to the client; still logs it server-side for you.
    print(f"Unhandled error on {request.url.path}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Something went wrong. Try again."})

app.include_router(containers.router)
app.include_router(day_zero.router)
app.include_router(mentorship.router)
app.include_router(socrates.router)
app.include_router(notifications.router)
app.include_router(finance.router)
app.include_router(goals.router)


@app.get("/")
def root():
    return {"status": "Default Zero API is running"}
