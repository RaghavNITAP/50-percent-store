from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from database import get_db
from models import Review, Order, OrderStatus, SellerProfile, User
from schemas.reviews import ReviewCreate, ReviewOut, SellerRatingSummary
from core.dependencies import get_current_user
from core.trust import apply_trust_delta

router = APIRouter(prefix="/reviews", tags=["Reviews"])


# ─── Submit review ────────────────────────────────────────────────────────────

@router.post("", response_model=ReviewOut, status_code=201)
async def submit_review(
    payload: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get order
    order_result = await db.execute(select(Order).where(Order.id == payload.order_id))
    order = order_result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.completed:
        raise HTTPException(status_code=400, detail="Order must be completed before reviewing")
    if order.buyer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only buyer can leave a review")

    # Check not already reviewed
    existing = await db.execute(
        select(Review).where(Review.order_id == payload.order_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already reviewed this order")

    import uuid
    review = Review(
        id=uuid.uuid4(),
        order_id=payload.order_id,
        reviewer_id=current_user.id,
        reviewed_user_id=order.seller_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    await db.flush()

    # Update seller profile avg rating
    seller_profile_result = await db.execute(
        select(SellerProfile).where(SellerProfile.user_id == order.seller_id)
    )
    profile = seller_profile_result.scalar_one_or_none()

    if profile:
        # Recalculate from all reviews
        stats = await db.execute(
            select(
                func.avg(Review.rating).label("avg"),
                func.count(Review.id).label("count"),
            ).where(Review.reviewed_user_id == order.seller_id)
        )
        row = stats.one()
        profile.avg_rating = round(float(row.avg or 0), 2)
        profile.total_ratings = row.count
        profile.total_sales = profile.total_sales + 1

    # ── Trust score delta based on rating ────────────────────────────────────
    reviewed_user_result = await db.execute(
        select(User).where(User.id == order.seller_id)
    )
    reviewed_user = reviewed_user_result.scalar_one_or_none()
    if reviewed_user:
        if payload.rating == 5:
            delta = +3
        elif payload.rating == 4:
            delta = +1
        elif payload.rating == 3:
            delta = -1
        else:  # 1 or 2
            delta = -5
        await apply_trust_delta(reviewed_user, delta, db)

    await db.commit()

    result = await db.execute(
        select(Review)
        .options(selectinload(Review.reviewer))
        .where(Review.id == review.id)
    )
    return result.scalar_one()


# ─── Get reviews for a user ───────────────────────────────────────────────────

@router.get("/user/{user_id}", response_model=SellerRatingSummary)
async def get_user_reviews(
    user_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile_result = await db.execute(
        select(SellerProfile).where(SellerProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()

    result = await db.execute(
        select(Review)
        .options(selectinload(Review.reviewer))
        .where(Review.reviewed_user_id == user_id)
        .order_by(Review.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    reviews = result.scalars().all()

    return SellerRatingSummary(
        user_id=user.id,
        full_name=user.full_name,
        avg_rating=profile.avg_rating if profile else 0.0,
        total_ratings=profile.total_ratings if profile else 0,
        total_sales=profile.total_sales if profile else 0,
        reviews=reviews,
    )


# ─── Get review for a specific order ─────────────────────────────────────────

@router.get("/order/{order_id}", response_model=ReviewOut)
async def get_order_review(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order_result = await db.execute(select(Order).where(Order.id == order_id))
    order = order_result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyer_id != current_user.id and order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")

    result = await db.execute(
        select(Review)
        .options(selectinload(Review.reviewer))
        .where(Review.order_id == order_id)
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="No review for this order yet")

    return review


# ─── My reviews received ──────────────────────────────────────────────────────

@router.get("/me", response_model=List[ReviewOut])
async def my_reviews(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Review)
        .options(selectinload(Review.reviewer))
        .where(Review.reviewed_user_id == current_user.id)
        .order_by(Review.created_at.desc())
    )
    return result.scalars().all()