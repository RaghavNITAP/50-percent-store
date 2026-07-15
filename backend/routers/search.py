from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, text, func
from sqlalchemy.orm import selectinload
from typing import Optional
import httpx
import json
import os

from database import get_db
from models import Listing, ListingStatus
from schemas.listings import ListingList

router = APIRouter(prefix="/search", tags=["Search"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

SEARCH_PROMPT = """You are a search query parser for a second-hand marketplace in India.

Extract structured filters from the user's natural language search query.

Return ONLY valid JSON with these fields (omit any field you can't confidently extract):
{
  "keywords": "core search terms, cleaned up",
  "category_slug": one of [electronics, fashion, furniture, books, sports-fitness, appliances, vehicles, toys-games, musical-instruments, other] or null,
  "min_price": number or null,
  "max_price": number or null,
  "condition": one of [new, good, fair, poor] or null,
  "is_negotiable": true/false or null,
  "sort_by": one of [recent, price_asc, price_desc, nearest] or null
}

Examples:
"red Nike shoes under 500" → {"keywords": "Nike shoes", "category_slug": "fashion", "max_price": 500}
"cheap second hand laptop good condition" → {"keywords": "laptop", "category_slug": "electronics", "condition": "good", "sort_by": "price_asc"}
"guitar negotiable" → {"keywords": "guitar", "category_slug": "musical-instruments", "is_negotiable": true}"""


async def parse_search_query(query: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "qwen/qwen3-27b",
                "messages": [
                    {"role": "system", "content": SEARCH_PROMPT},
                    {"role": "user", "content": query},
                ],
                "max_tokens": 300,
                "temperature": 0.1,
            },
            timeout=10.0,
        )
        data = response.json()
        raw = data["choices"][0]["message"]["content"].strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())


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
async def natural_language_search(
    q: str = Query(..., min_length=2, description="Natural language search query"),
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_km: float = Query(10.0, ge=0.5, le=100.0),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    try:
        parsed = await parse_search_query(q)
    except Exception:
        parsed = {"keywords": q}

    filters = [Listing.status == ListingStatus.active]

    if parsed.get("keywords"):
        from sqlalchemy import or_
        word_filters = []
        for word in parsed["keywords"].split():
            w = word.lower()
            word_filters.append(Listing.title.ilike(f"%{w}%"))
            word_filters.append(Listing.description.ilike(f"%{w}%"))
        filters.append(or_(*word_filters))

    if parsed.get("category_slug"):
        from models import Category
        cat_result = await db.execute(
            select(Category).where(Category.slug == parsed["category_slug"])
        )
        cat = cat_result.scalar_one_or_none()
        if cat:
            filters.append(
                (Listing.category_id == cat.id) | (Listing.category_id == None)
            )

    if parsed.get("min_price") is not None:
        filters.append(Listing.reselling_price >= parsed["min_price"])
    if parsed.get("max_price") is not None:
        filters.append(Listing.reselling_price <= parsed["max_price"])
    if parsed.get("condition"):
        filters.append(Listing.condition == parsed["condition"])
    if parsed.get("is_negotiable") is not None:
        filters.append(Listing.is_negotiable == parsed["is_negotiable"])

    if lat is not None and lon is not None:
        filters.append(text(f"""
            (6371.0 * acos(
                LEAST(1.0,
                    cos(radians({lat})) * cos(radians(pickup_latitude))
                    * cos(radians(pickup_longitude) - radians({lon}))
                    + sin(radians({lat})) * sin(radians(pickup_latitude))
                )
            )) <= ({radius_km} + pickup_radius_km)
        """))

    # ── Ranking: keyword match 80% + trust 20% ───────────────────────────────
    # Build a keyword match score: title match = 10pts/word, desc = 3pts/word
    sort_by = parsed.get("sort_by", "recent")
    keywords = parsed.get("keywords", "").split() if parsed.get("keywords") else []

    if keywords and (sort_by == "recent" or not sort_by):
        # Build SQL CASE expressions for each keyword
        title_cases = " + ".join(
            [f"CASE WHEN LOWER(listings.title) LIKE '%{w.lower()}%' THEN 10 ELSE 0 END" for w in keywords]
        ) if keywords else "0"
        desc_cases = " + ".join(
            [f"CASE WHEN LOWER(listings.description) LIKE '%{w.lower()}%' THEN 3 ELSE 0 END" for w in keywords]
        ) if keywords else "0"

        order = text(f"""
            (
                ({title_cases} + {desc_cases}) * 0.8
                + COALESCE((SELECT trust_score FROM users WHERE users.id = listings.seller_id), 70) * 0.2
            ) DESC
        """)
    elif sort_by == "price_asc":
        order = Listing.reselling_price.asc()
    elif sort_by == "price_desc":
        order = Listing.reselling_price.desc()
    elif sort_by == "nearest" and lat and lon:
        order = text(f"""
            (6371.0 * acos(
                LEAST(1.0,
                    cos(radians({lat})) * cos(radians(pickup_latitude))
                    * cos(radians(pickup_longitude) - radians({lon}))
                    + sin(radians({lat})) * sin(radians(pickup_latitude))
                )
            ))
        """)
    else:
        order = Listing.created_at.desc()

    total = (await db.execute(
        select(func.count()).select_from(Listing).where(and_(*filters))
    )).scalar()

    result = await db.execute(
        listing_query()
        .where(and_(*filters))
        .order_by(order)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()

    return ListingList(items=items, total=total, page=page, page_size=page_size)


@router.get("/parse")
async def parse_only(q: str = Query(..., min_length=2)):
    """Dev endpoint — see how Groq parses a query."""
    try:
        parsed = await parse_search_query(q)
        return {"query": q, "parsed": parsed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse failed: {str(e)}")