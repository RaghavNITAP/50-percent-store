from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from routers import auth, listings, feed, search, chat, payments, reviews, locations
from migrate import run_migrations
import seed_categories
import os

# ─── Rate Limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run DB migrations on every startup (idempotent — safe to repeat)
    await run_migrations()
    yield


app = FastAPI(
    title="50% Store API",
    description="Hyperlocal reselling marketplace",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Middleware ───────────────────────────────────────────────────────────────
# ProxyHeadersMiddleware must come FIRST — it rewrites request.client.host
# to the real client IP from X-Forwarded-For (set by Railway's reverse proxy).
# Without this, all users share the same proxy IP and rate limiting is broken.
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(feed.router)
app.include_router(search.router)
app.include_router(chat.router)
app.include_router(payments.router)
app.include_router(reviews.router)
app.include_router(locations.router)


@app.get("/")
async def root():
    return {"status": "50% Store API running"}


@app.get("/seed")
async def seed_db():
    await seed_categories.seed()
    return {"status": "Categories seeded!"}

