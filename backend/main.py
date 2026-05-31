from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, listings, feed, search, chat, payments, reviews
import seed_categories
app = FastAPI(
    title="50% Store API",
    description="Hyperlocal reselling marketplace",
    version="1.0.0",
)

import os

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(feed.router)
app.include_router(search.router)
app.include_router(chat.router)
app.include_router(payments.router)
app.include_router(reviews.router)


@app.get("/")
async def root():
    return {"status": "50% Store API running"}


@app.get("/seed")
async def seed_db():
    await seed_categories.seed()
    return {"status": "Categories seeded!"}
