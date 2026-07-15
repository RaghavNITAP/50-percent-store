from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, update
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone, timedelta

from database import get_db
from models import ListingRequest, RequestStatus, PincodeCache, User
from schemas.requests import RequestCreate, RequestUpdate, RequestOut, RequestList
from core.dependencies import get_current_user

router = APIRouter(prefix="/requests", tags=["Requests"])

REQUEST_TTL_DAYS = 14


def request_query():
    return (
        select(ListingRequest)
        .options(
            selectinload(ListingRequest.requester),
            selectinload(ListingRequest.category),
        )
    )


# ─── Create ───────────────────────────────────────────────────────────────────

@router.post("", response_model=RequestOut, status_code=201)
async def create_request(
    payload: RequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Resolve pincode to lat/lon
    pc_result = await db.execute(
        select(PincodeCache).where(PincodeCache.pincode == payload.pincode)
    )
    pc = pc_result.scalar_one_or_none()
    lat = pc.latitude if pc else None
    lon = pc.longitude if pc else None

    req = ListingRequest(
        requester_id=current_user.id,
        category_id=payload.category_id,
        title=payload.title,
        description=payload.description,
        min_budget=payload.min_budget,
        max_budget=payload.max_budget,
        condition_preference=payload.condition_preference,
        pincode=payload.pincode,
        latitude=lat,
        longitude=lon,
        radius_km=payload.radius_km,
        expires_at=datetime.now(timezone.utc) + timedelta(days=REQUEST_TTL_DAYS),
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    result = await db.execute(request_query().where(ListingRequest.id == req.id))
    return result.scalar_one()


# ─── Feed (public, radius-filtered) ──────────────────────────────────────────

@router.get("/feed", response_model=RequestList)
async def get_request_feed(
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_km: float = Query(10.0, ge=0.5, le=500.0),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category_id: Optional[UUID] = None,
    max_budget: Optional[float] = None,
    condition_preference: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    filters = [
        ListingRequest.status == RequestStatus.open,
        ListingRequest.expires_at > now,
    ]

    if category_id:
        filters.append(ListingRequest.category_id == category_id)
    if max_budget is not None:
        filters.append(
            (ListingRequest.max_budget == None) | (ListingRequest.max_budget <= max_budget)
        )
    if condition_preference:
        filters.append(ListingRequest.condition_preference == condition_preference)
    if search:
        filters.append(ListingRequest.title.ilike(f"%{search}%"))

    # Radius filter — only if lat/lon provided
    if lat is not None and lon is not None:
        radius_filter = text(f"""
            (
                listing_requests.latitude IS NULL
                OR listing_requests.longitude IS NULL
                OR (6371.0 * acos(
                    LEAST(1.0,
                        cos(radians({lat})) * cos(radians(listing_requests.latitude))
                        * cos(radians(listing_requests.longitude) - radians({lon}))
                        + sin(radians({lat})) * sin(radians(listing_requests.latitude))
                    )
                )) <= (listing_requests.radius_km + {radius_km})
            )
        """)
        filters.append(radius_filter)

    base_q = request_query().where(*filters)

    total = (await db.execute(
        select(func.count()).select_from(ListingRequest).where(*filters)
    )).scalar()

    result = await db.execute(
        base_q
        .order_by(ListingRequest.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()

    return RequestList(items=items, total=total, page=page, page_size=page_size)


# ─── My Requests ──────────────────────────────────────────────────────────────

@router.get("/me", response_model=RequestList)
async def my_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = [ListingRequest.requester_id == current_user.id]

    total = (await db.execute(
        select(func.count()).select_from(ListingRequest).where(*filters)
    )).scalar()

    result = await db.execute(
        request_query()
        .where(*filters)
        .order_by(ListingRequest.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()

    return RequestList(items=items, total=total, page=page, page_size=page_size)


# ─── Detail ───────────────────────────────────────────────────────────────────

@router.get("/{request_id}", response_model=RequestOut)
async def get_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(request_query().where(ListingRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req


# ─── Edit ─────────────────────────────────────────────────────────────────────

@router.patch("/{request_id}", response_model=RequestOut)
async def update_request(
    request_id: UUID,
    payload: RequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(request_query().where(ListingRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request")

    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(req, field, val)

    await db.commit()
    await db.refresh(req)
    result = await db.execute(request_query().where(ListingRequest.id == req.id))
    return result.scalar_one()


# ─── Fulfill ──────────────────────────────────────────────────────────────────

@router.post("/{request_id}/fulfill", response_model=RequestOut)
async def fulfill_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(request_query().where(ListingRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the requester can mark this as fulfilled")

    req.status = RequestStatus.fulfilled
    await db.commit()
    await db.refresh(req)
    result = await db.execute(request_query().where(ListingRequest.id == req.id))
    return result.scalar_one()


# ─── Renew ────────────────────────────────────────────────────────────────────

@router.post("/{request_id}/renew", response_model=RequestOut)
async def renew_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(request_query().where(ListingRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request")

    req.expires_at = datetime.now(timezone.utc) + timedelta(days=REQUEST_TTL_DAYS)
    req.status = RequestStatus.open
    await db.commit()
    await db.refresh(req)
    result = await db.execute(request_query().where(ListingRequest.id == req.id))
    return result.scalar_one()


# ─── Close / Delete ───────────────────────────────────────────────────────────

@router.delete("/{request_id}", status_code=204)
async def close_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ListingRequest).where(ListingRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request")

    req.status = RequestStatus.closed
    await db.commit()
