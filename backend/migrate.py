"""
Safe, idempotent migration script.
Adds new columns and the pincode_cache table to the existing DB.
Uses `IF NOT EXISTS` so it is safe to run multiple times.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "")
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")


MIGRATIONS = [
    # Add pincode to users
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode VARCHAR(10)",

    # Add pincode to listings
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS pincode VARCHAR(10)",

    # Create pincode_cache table
    """
    CREATE TABLE IF NOT EXISTS pincode_cache (
        pincode     VARCHAR(10) PRIMARY KEY,
        latitude    FLOAT,
        longitude   FLOAT,
        bounding_radius_km FLOAT,
        is_valid    BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,

    # Create listing_requests table
    """
    CREATE TABLE IF NOT EXISTS listing_requests (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        requester_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id          UUID REFERENCES categories(id),
        title                VARCHAR(200) NOT NULL,
        description          TEXT,
        min_budget           FLOAT,
        max_budget           FLOAT,
        condition_preference VARCHAR(10) NOT NULL DEFAULT 'any',
        pincode              VARCHAR(10),
        latitude             FLOAT,
        longitude            FLOAT,
        radius_km            FLOAT NOT NULL DEFAULT 10.0,
        status               VARCHAR(20) NOT NULL DEFAULT 'open',
        expires_at           TIMESTAMPTZ NOT NULL,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ
    )
    """,

    "CREATE INDEX IF NOT EXISTS ix_requests_status ON listing_requests(status)",
    "CREATE INDEX IF NOT EXISTS ix_requests_location ON listing_requests(latitude, longitude)",
]


async def run_migrations():
    engine = create_async_engine(ASYNC_DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        for sql in MIGRATIONS:
            print(f"Running: {sql.strip()[:80]}...")
            await conn.execute(text(sql))
    await engine.dispose()
    print("✅ All migrations complete.")


if __name__ == "__main__":
    asyncio.run(run_migrations())
