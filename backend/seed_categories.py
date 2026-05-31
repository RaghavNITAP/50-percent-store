import asyncio
from database import AsyncSessionLocal, create_tables
from models import Category
import uuid

CATEGORIES = [
    {"name": "Electronics", "slug": "electronics", "icon": "💻"},
    {"name": "Fashion", "slug": "fashion", "icon": "👕"},
    {"name": "Furniture", "slug": "furniture", "icon": "🪑"},
    {"name": "Books", "slug": "books", "icon": "📚"},
    {"name": "Sports & Fitness", "slug": "sports-fitness", "icon": "🏋️"},
    {"name": "Appliances", "slug": "appliances", "icon": "🫙"},
    {"name": "Vehicles", "slug": "vehicles", "icon": "🚗"},
    {"name": "Toys & Games", "slug": "toys-games", "icon": "🎮"},
    {"name": "Musical Instruments", "slug": "musical-instruments", "icon": "🎸"},
    {"name": "Other", "slug": "other", "icon": "📦"},
]


async def seed():
    await create_tables()
    async with AsyncSessionLocal() as session:
        for cat in CATEGORIES:
            obj = Category(
                id=uuid.uuid4(),
                name=cat["name"],
                slug=cat["slug"],
                icon=cat["icon"],
            )
            session.add(obj)
        await session.commit()
        print("✅ Categories seeded.")


if __name__ == "__main__":
    asyncio.run(seed())