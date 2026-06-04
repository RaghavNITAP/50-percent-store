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
