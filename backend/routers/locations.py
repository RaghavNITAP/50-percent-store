import math
import asyncio
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from database import get_db
from models import PincodeCache

router = APIRouter(prefix="/locations", tags=["Locations"])

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
FAILURE_TTL_DAYS = 7


@router.get("/resolve-pincode")
async def resolve_pincode(
    pincode: str = Query(..., pattern=r"^\d{6}$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Resolve a 6-digit Indian pincode to (lat, lon, bounding_radius_km).
    Results are cached permanently for valid pincodes.
    Invalid pincode failures are cached for FAILURE_TTL_DAYS before retrying.
    """
    # ── 1. Check cache ────────────────────────────────────────────────────────
    result = await db.execute(select(PincodeCache).where(PincodeCache.pincode == pincode))
    cached = result.scalar_one_or_none()

    if cached:
        if cached.is_valid:
            return {
                "pincode": cached.pincode,
                "latitude": cached.latitude,
                "longitude": cached.longitude,
                "bounding_radius_km": cached.bounding_radius_km,
            }

        # Self-healing TTL: retry stale failures after FAILURE_TTL_DAYS
        cached_at = cached.created_at
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - cached_at

        if age < timedelta(days=FAILURE_TTL_DAYS):
            raise HTTPException(status_code=400, detail="Invalid or unrecognized pincode")

        # Failure is stale — delete and retry below
        await db.execute(delete(PincodeCache).where(PincodeCache.pincode == pincode))
        await db.flush()

    # ── 2. Rate-limit protection (Nominatim: max 1 req/sec) ──────────────────
    await asyncio.sleep(1.1)

    # ── 3. Fetch from Nominatim ───────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={
                    "postalcode": pincode,
                    "country": "India",
                    "format": "json",
                    "limit": 1,
                },
                headers={"User-Agent": "50PercentStore/1.0"},
            )
        data = resp.json()
    except Exception:
        # Cache temporarily as invalid; self-heals after TTL
        try:
            db.add(PincodeCache(pincode=pincode, is_valid=False))
            await db.commit()
        except Exception:
            await db.rollback()
        raise HTTPException(status_code=503, detail="Geocoding service unavailable. Try again shortly.")

    if not data:
        try:
            db.add(PincodeCache(pincode=pincode, is_valid=False))
            await db.commit()
        except Exception:
            await db.rollback()
        raise HTTPException(status_code=400, detail="Invalid or unrecognized pincode. Check and try again.")

    # ── 4. Parse result and compute adaptive bounding radius ──────────────────
    item = data[0]
    lat = float(item["lat"])
    lon = float(item["lon"])
    bbox = item.get("boundingbox")  # [south, north, west, east]

    bounding_radius_km = 2.5  # safe fallback
    if bbox and len(bbox) == 4:
        south, north, west, east = (float(x) for x in bbox)
        height_km = abs(north - south) * 111
        # cos(lat) accounts for longitude degree compression at India's latitude
        width_km = abs(east - west) * 111 * math.cos(math.radians(lat))
        bounding_radius_km = (height_km + width_km) / 4

    # ── 5. Cache valid result ─────────────────────────────────────────────────
    try:
        db.add(PincodeCache(
            pincode=pincode,
            latitude=lat,
            longitude=lon,
            bounding_radius_km=bounding_radius_km,
            is_valid=True,
        ))
        await db.commit()
    except Exception:
        # Another concurrent request already cached this — that's fine
        await db.rollback()

    return {
        "pincode": pincode,
        "latitude": lat,
        "longitude": lon,
        "bounding_radius_km": bounding_radius_km,
    }
