from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
import uuid
import json
from models import Listing, ListingImage, ListingPickupPoint, ListingStatus, Category
import base64
import os
import httpx
import base64

from database import get_db
from models import Listing, ListingImage, ListingPickupPoint, ListingStatus
from schemas.listings import (
    ListingCreate, ListingUpdate, ListingOut, ListingList
)
from core.dependencies import get_current_user, get_current_seller
from core.cloudinary import upload_image, delete_image
from models import User

router = APIRouter(prefix="/listings", tags=["Listings"])

# ─── AI polish ────────────────────────────────────────────────────────────────

@router.post("/ai-polish")
async def ai_polish(
    field: str = Form(...),
    content: str = Form(...),
    title: str = Form(""),
    condition: str = Form("good"),
    current_user: User = Depends(get_current_user),
):
    if field == "description":
        prompt = (
            f"Rewrite this second-hand marketplace listing description in 2-3 clear, honest sentences. "
            f"Use ONLY what the seller told you - do not add anything new. "
            f"Item: {title} ({condition} condition). "
            f"Seller wrote: {content} "
            f"Return plain text only."
        )
    else:
        prompt = (
            f"Rewrite this defect description for a second-hand marketplace listing in 1-2 honest sentences. "
            f"Use ONLY what the seller mentioned. Item: {title}. "
            f"Seller wrote: {content} "
            f"Return plain text only."
        )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                json={
                    "model": "openai/gpt-oss-120b",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 150,
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            result = resp.json()["choices"][0]["message"]["content"].strip()
            return {"text": result}
    except Exception as e:
        print(f"[ai-polish error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ─── Get all categories ───────────────────────────────────────────────────────

@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category).where(Category.parent_id == None).order_by(Category.name)
    )
    cats = result.scalars().all()
    return [{"id": str(c.id), "name": c.name, "slug": c.slug, "icon": c.icon} for c in cats]


# ─── AI listing assistant ─────────────────────────────────────────────────────

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

AI_ASSIST_PROMPT = """You are a listing assistant for a second-hand marketplace in India called "50% Store".
Items typically resell at 40-60% of original retail price.


Analyze this product image and return ONLY valid JSON with these exact fields:
{
  "title": "short specific product title, max 8 words (include brand, model, color if visible)",
  "description": "2-3 sentences describing exactly what you see — specific details, not generic filler. Mention brand, color, visible features, overall appearance.",
  "category_slug": "one of: electronics|fashion|furniture|books|sports-fitness|appliances|vehicles|toys-games|musical-instruments|other",
  "condition_guess": "one of: new|good|fair|poor based on visual appearance only",
  "suggested_price_inr": estimated resale price as a plain number in Indian Rupees
}"""

@router.post("/ai-assist")
async def ai_listing_assist(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_seller),
):
    image_bytes = await image.read()
    b64 = base64.b64encode(image_bytes).decode()
    mime = image.content_type or "image/jpeg"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.2-11b-vision-preview",
                    "messages": [{
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime};base64,{b64}"},
                            },
                            {"type": "text", "text": AI_ASSIST_PROMPT},
                        ],
                    }],
                    "max_tokens": 500,
                    "temperature": 0.1,
                },
                timeout=30.0,
            )
        data = resp.json()
        raw = data["choices"][0]["message"]["content"].strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

def listing_query():
    return (
        select(Listing)
        .options(
            selectinload(Listing.seller),
            selectinload(Listing.images),
            selectinload(Listing.additional_pickups),
        )
    )


# ─── Create listing ───────────────────────────────────────────────────────────

@router.post("", response_model=ListingOut, status_code=201)
async def create_listing(
    payload: str = Form(...),           # JSON string of ListingCreate
    images: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_seller),
):
    try:
        data = ListingCreate(**json.loads(payload))
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    listing = Listing(
        id=uuid.uuid4(),
        seller_id=current_user.id,
        title=data.title,
        description=data.description,
        condition=data.condition,
        original_price=data.original_price,
        reselling_price=data.reselling_price,
        age_years=data.age_years,
        defects=data.defects,
        is_negotiable=data.is_negotiable,
        category_id=data.category_id,
        pickup_address=data.pickup_address,
        pickup_latitude=data.pickup_latitude,
        pickup_longitude=data.pickup_longitude,
        pickup_radius_km=data.pickup_radius_km,
    )
    db.add(listing)
    await db.flush()

    # Upload images
    for idx, img_file in enumerate(images[:6]):   # max 6 images
        uploaded = await upload_image(img_file, folder=f"listings/{listing.id}")
        db.add(ListingImage(
            id=uuid.uuid4(),
            listing_id=listing.id,
            cloudinary_url=uploaded["url"],
            cloudinary_public_id=uploaded["public_id"],
            is_primary=(idx == 0),
            display_order=idx,
        ))

    # Additional pickup points
    for pt in (data.additional_pickups or []):
        db.add(ListingPickupPoint(
            id=uuid.uuid4(),
            listing_id=listing.id,
            label=pt.label,
            latitude=pt.latitude,
            longitude=pt.longitude,
            radius_km=pt.radius_km,
        ))

    await db.commit()

    result = await db.execute(
        listing_query().where(Listing.id == listing.id)
    )
    return result.scalar_one()


# ─── Get single listing ───────────────────────────────────────────────────────

@router.get("/{listing_id}", response_model=ListingOut)
async def get_listing(
    listing_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        listing_query().where(
            Listing.id == listing_id,
            Listing.status != ListingStatus.deleted,
        )
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Increment view count
    listing.view_count += 1
    await db.commit()
    await db.refresh(listing)

    return listing


# ─── List listings ────────────────────────────────────────────────────────────

@router.get("", response_model=ListingList)
async def list_listings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category_id: Optional[UUID] = None,
    condition: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    is_negotiable: Optional[bool] = None,
    seller_id: Optional[UUID] = None,
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
    if seller_id:
        filters.append(Listing.seller_id == seller_id)

    count_result = await db.execute(
        select(func.count()).select_from(Listing).where(and_(*filters))
    )
    total = count_result.scalar()

    result = await db.execute(
        listing_query()
        .where(and_(*filters))
        .order_by(Listing.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()

    return ListingList(items=items, total=total, page=page, page_size=page_size)


# ─── Update listing ───────────────────────────────────────────────────────────

@router.patch("/{listing_id}", response_model=ListingOut)
async def update_listing(
    listing_id: UUID,
    payload: ListingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_seller),
):
    result = await db.execute(
        listing_query().where(Listing.id == listing_id)
    )
    listing = result.scalar_one_or_none()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(listing, field, value)

    await db.commit()
    await db.refresh(listing)
    return listing


# ─── Delete listing ───────────────────────────────────────────────────────────

@router.delete("/{listing_id}", status_code=204)
async def delete_listing(
    listing_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_seller),
):
    result = await db.execute(
        select(Listing).where(Listing.id == listing_id)
    )
    listing = result.scalar_one_or_none()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")

    listing.status = ListingStatus.deleted
    await db.commit()


# ─── Add image to existing listing ───────────────────────────────────────────

@router.post("/{listing_id}/images", response_model=ListingOut)
async def add_images(
    listing_id: UUID,
    images: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_seller),
):
    result = await db.execute(
        listing_query().where(Listing.id == listing_id)
    )
    listing = result.scalar_one_or_none()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")

    current_count = len(listing.images)
    for idx, img_file in enumerate(images):
        if current_count + idx >= 6:
            break
        uploaded = await upload_image(img_file, folder=f"listings/{listing.id}")
        db.add(ListingImage(
            id=uuid.uuid4(),
            listing_id=listing.id,
            cloudinary_url=uploaded["url"],
            cloudinary_public_id=uploaded["public_id"],
            is_primary=(current_count == 0 and idx == 0),
            display_order=current_count + idx,
        ))

    await db.commit()

    result = await db.execute(listing_query().where(Listing.id == listing_id))
    return result.scalar_one()


# ─── Delete image ─────────────────────────────────────────────────────────────

@router.delete("/{listing_id}/images/{image_id}", status_code=204)
async def delete_image_endpoint(
    listing_id: UUID,
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_seller),
):
    listing_result = await db.execute(
        select(Listing).where(Listing.id == listing_id)
    )
    listing = listing_result.scalar_one_or_none()

    if not listing or listing.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")

    img_result = await db.execute(
        select(ListingImage).where(
            ListingImage.id == image_id,
            ListingImage.listing_id == listing_id,
        )
    )
    image = img_result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    await delete_image(image.cloudinary_public_id)
    await db.delete(image)
    await db.commit()


# ─── My listings ──────────────────────────────────────────────────────────────

@router.get("/me/listings", response_model=ListingList)
async def my_listings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = [Listing.seller_id == current_user.id]
    if status:
        filters.append(Listing.status == status)
    else:
        filters.append(Listing.status != ListingStatus.deleted)

    count_result = await db.execute(
        select(func.count()).select_from(Listing).where(and_(*filters))
    )
    total = count_result.scalar()

    result = await db.execute(
        listing_query()
        .where(and_(*filters))
        .order_by(Listing.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()

    return ListingList(items=items, total=total, page=page, page_size=page_size)