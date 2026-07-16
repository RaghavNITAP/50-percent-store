from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID

from database import get_db
from models import Listing, ListingStatus, User, PincodeCache
from schemas.listings import ListingList, ListingOut
from core.dependencies import get_current_user
from core.geo import haversine_distance, zones_overlap

router = APIRouter(prefix="/feed", tags=["Feed"])


def listing_query():
    return (
        select(Listing)
        .options(
            selectinload(Listing.seller),
            selectinload(Listing.images),
            selectinload(Listing.additional_pickups),
        )
    )


@router.get("", response_model=ListingList)
async def get_feed(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(5.0, ge=0.5, le=500.0),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category_id: Optional[UUID] = None,
    condition: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    is_negotiable: Optional[bool] = None,
    sort_by: str = Query("recent", enum=["recent", "price_asc", "price_desc", "nearest"]),
    db: AsyncSession = Depends(get_db),
):
    filters = [Listing.status == ListingStatus.active]

    if category_id:
        filters.append(Listing.category_id == category_id)
    if condition:
        filters.append(Listing.condition == condition)
    if min_price is not None:
        filters.append(Listing.reselling_price >= min_price)
    if max_price is not None:
        filters.append(Listing.reselling_price <= max_price)
    if is_negotiable is not None:
        filters.append(Listing.is_negotiable == is_negotiable)

    distance_expr = text(f"""
        (6371.0 * acos(
            LEAST(1.0,
                cos(radians({lat})) * cos(radians(pickup_latitude))
                * cos(radians(pickup_longitude) - radians({lon}))
                + sin(radians({lat})) * sin(radians(pickup_latitude))
            )
        ))
    """)

    radius_filter = text(f"""
        (
            pickup_latitude IS NULL
            OR pickup_longitude IS NULL
            OR (6371.0 * acos(
                LEAST(1.0,
                    cos(radians({lat})) * cos(radians(pickup_latitude))
                    * cos(radians(pickup_longitude) - radians({lon}))
                    + sin(radians({lat})) * sin(radians(pickup_latitude))
                )
            )) <= ({radius_km} + pickup_radius_km)
        )
    """)

    filters.append(radius_filter)

    count_q = select(func.count()).select_from(Listing).where(and_(*filters))
    total = (await db.execute(count_q)).scalar()

    # ── Ranking: recency 80% + trust 20% (distance is binary gate, not gradient) ──
    if sort_by == "price_asc":
        order = Listing.reselling_price.asc()
    elif sort_by == "price_desc":
        order = Listing.reselling_price.desc()
    elif sort_by == "nearest":
        order = text(f"""
            (6371.0 * acos(
                LEAST(1.0,
                    cos(radians({lat})) * cos(radians(pickup_latitude))
                    * cos(radians(pickup_longitude) - radians({lon}))
                    + sin(radians({lat})) * sin(radians(pickup_latitude))
                )
            )) ASC NULLS LAST
        """)
    else:
        # Default: blend recency (80%) + seller trust score (20%)
        order = text(f"""
            (
                GREATEST(0.0, 100.0 - EXTRACT(EPOCH FROM (NOW() - listings.created_at)) / 86400.0 * 3.33) * 0.8
                + COALESCE((SELECT trust_score FROM users WHERE users.id = listings.seller_id), 70) * 0.2
            ) DESC
        """)

    result = await db.execute(
        listing_query()
        .where(and_(*filters))
        .order_by(order)
        .offset((page - 1) * page_size)
        .limit(page_size * 2)  # fetch extra for deduplication
    )
    items = result.scalars().all()

    # Seller dedup: first listing per seller goes to primary, rest to secondary
    seen_sellers: set = set()
    primary, secondary = [], []
    for item in items:
        sid = str(item.seller_id)
        if sid not in seen_sellers:
            seen_sellers.add(sid)
            primary.append(item)
        else:
            secondary.append(item)
    items = (primary + secondary)[:page_size]

    return ListingList(items=items, total=total, page=page, page_size=page_size)


@router.get("/my", response_model=ListingList)
async def get_my_feed(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    radius_override: Optional[float] = Query(None, ge=0.5, le=500.0),
    category_id: Optional[UUID] = None,
    condition: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: str = Query("recent", enum=["recent", "price_asc", "price_desc", "nearest"]),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.latitude or not current_user.longitude:
        raise HTTPException(
            status_code=400,
            detail="Set your pincode first via your profile"
        )

    lat = current_user.latitude
    lon = current_user.longitude

    # Adaptive pincode buffer: look up the actual geographic size of the user's pincode
    pincode_buffer = 2.5  # safe fallback (km)
    if current_user.pincode:
        pc_result = await db.execute(
            select(PincodeCache).where(PincodeCache.pincode == current_user.pincode)
        )
        pc_info = pc_result.scalar_one_or_none()
        if pc_info and pc_info.bounding_radius_km:
            pincode_buffer = min(pc_info.bounding_radius_km, 15.0)  # clamp at 15km

    radius_km = radius_override or current_user.availability_radius_km
    effective_radius_km = radius_km + pincode_buffer

    filters = [Listing.status == ListingStatus.active]

    if category_id:
        filters.append(Listing.category_id == category_id)
    if condition:
        filters.append(Listing.condition == condition)
    if min_price is not None:
        filters.append(Listing.reselling_price >= min_price)
    if max_price is not None:
        filters.append(Listing.reselling_price <= max_price)

    distance_expr = text(f"""
        (6371.0 * acos(
            LEAST(1.0,
                cos(radians({lat})) * cos(radians(pickup_latitude))
                * cos(radians(pickup_longitude) - radians({lon}))
                + sin(radians({lat})) * sin(radians(pickup_latitude))
            )
        ))
    """)

    radius_filter = text(f"""
        (
            pickup_latitude IS NULL
            OR pickup_longitude IS NULL
            OR (6371.0 * acos(
                LEAST(1.0,
                    cos(radians({lat})) * cos(radians(pickup_latitude))
                    * cos(radians(pickup_longitude) - radians({lon}))
                    + sin(radians({lat})) * sin(radians(pickup_latitude))
                )
            )) <= ({effective_radius_km} + pickup_radius_km)
        )
    """)

    filters.append(radius_filter)

    count_q = select(func.count()).select_from(Listing).where(and_(*filters))
    total = (await db.execute(count_q)).scalar()

    # ── Ranking: recency 80% + trust 20% (distance is binary gate, not gradient) ──
    if sort_by == "price_asc":
        order = Listing.reselling_price.asc()
    elif sort_by == "price_desc":
        order = Listing.reselling_price.desc()
    elif sort_by == "nearest":
        order = text(f"""
            (6371.0 * acos(
                LEAST(1.0,
                    cos(radians({lat})) * cos(radians(pickup_latitude))
                    * cos(radians(pickup_longitude) - radians({lon}))
                    + sin(radians({lat})) * sin(radians(pickup_latitude))
                )
            )) ASC NULLS LAST
        """)
    else:
        # Default: blend recency (80%) + seller trust score (20%)
        order = text(f"""
            (
                GREATEST(0.0, 100.0 - EXTRACT(EPOCH FROM (NOW() - listings.created_at)) / 86400.0 * 3.33) * 0.8
                + COALESCE((SELECT trust_score FROM users WHERE users.id = listings.seller_id), 70) * 0.2
            ) DESC
        """)

    result = await db.execute(
        listing_query()
        .where(and_(*filters))
        .order_by(order)
        .offset((page - 1) * page_size)
        .limit(page_size * 2)  # fetch extra for deduplication
    )
    items = result.scalars().all()

    # Seller dedup: first listing per seller goes to primary, rest to secondary
    seen_sellers: set = set()
    primary, secondary = [], []
    for item in items:
        sid = str(item.seller_id)
        if sid not in seen_sellers:
            seen_sellers.add(sid)
            primary.append(item)
        else:
            secondary.append(item)
    items = (primary + secondary)[:page_size]

    return ListingList(items=items, total=total, page=page, page_size=page_size)


@router.get("/distance/{listing_id}")
async def get_distance(
    listing_id: UUID,
    lat: float = Query(...),
    lon: float = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Listing).where(
            Listing.id == listing_id,
            Listing.status != ListingStatus.deleted,
        )
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    distance = haversine_distance(lat, lon, listing.pickup_latitude, listing.pickup_longitude)
    overlaps = zones_overlap(
        lat, lon, 5.0,
        listing.pickup_latitude, listing.pickup_longitude, listing.pickup_radius_km,
    )

    return {
        "listing_id": str(listing_id),
        "distance_km": round(distance, 2),
        "zones_overlap": overlaps,
        "pickup_radius_km": listing.pickup_radius_km,
    }
