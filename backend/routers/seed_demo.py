"""
Demo data seeder — creates 6 sellers × 10 listings = 60 listings
across major Indian cities.

Usage:
  POST /dev/seed
  Header: X-Seed-Secret: <value of SEED_SECRET env var, default "demo1234">

Safe to call multiple times — skips users/listings if they already exist.
"""

import os
import uuid
import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import (
    User, SellerProfile, Listing, ListingImage,
    ListingCondition, ListingStatus, UserRole, Category,
)
from core.security import hash_password

router = APIRouter(prefix="/dev", tags=["Dev"])

SEED_SECRET = os.getenv("SEED_SECRET", "demo1234")

# ── Image helper ───────────────────────────────────────────────────────────────
# Picsum photos with named seeds — always returns the same image for the seed.
def img(seed: str) -> str:
    return f"https://picsum.photos/seed/{seed}/500/500"

# ── Demo sellers ───────────────────────────────────────────────────────────────
SELLERS = [
    {
        "full_name": "Rahul Sharma",
        "email": "rahul.demo@50pct.store",
        "city": "Delhi",
        "locality": "Connaught Place",
        "pincode": "110001",
        "lat": 28.6313,
        "lon": 77.2167,
        "trust_score": 92,
    },
    {
        "full_name": "Priya Patel",
        "email": "priya.demo@50pct.store",
        "city": "Mumbai",
        "locality": "Bandra West",
        "pincode": "400050",
        "lat": 19.0544,
        "lon": 72.8405,
        "trust_score": 88,
    },
    {
        "full_name": "Arjun Kumar",
        "email": "arjun.demo@50pct.store",
        "city": "Bangalore",
        "locality": "Koramangala",
        "pincode": "560034",
        "lat": 12.9352,
        "lon": 77.6245,
        "trust_score": 85,
    },
    {
        "full_name": "Meera Nair",
        "email": "meera.demo@50pct.store",
        "city": "Chennai",
        "locality": "Anna Nagar",
        "pincode": "600040",
        "lat": 13.0850,
        "lon": 80.2101,
        "trust_score": 90,
    },
    {
        "full_name": "Vikash Singh",
        "email": "vikash.demo@50pct.store",
        "city": "Hyderabad",
        "locality": "Hitech City",
        "pincode": "500081",
        "lat": 17.4435,
        "lon": 78.3772,
        "trust_score": 78,
    },
    {
        "full_name": "Ananya Joshi",
        "email": "ananya.demo@50pct.store",
        "city": "Pune",
        "locality": "Kothrud",
        "pincode": "411038",
        "lat": 18.5089,
        "lon": 73.8093,
        "trust_score": 83,
    },
]

# ── Listings per seller ────────────────────────────────────────────────────────
# (title, category_slug, condition, resell_price, original_price, negotiable, image_seed, description)
LISTINGS_BY_SELLER = [
    # Rahul — Electronics (Delhi)
    [
        ("iPhone 13 Pro Max 256GB", "electronics", "good", 55000, 129900, False, "iphone-13", "In excellent condition, scratches only on the sides. Original box and charger included. Battery health 89%."),
        ("Samsung Galaxy S22 128GB", "electronics", "good", 38000, 72999, True, "samsung-s22", "Used for 8 months, always had a case. No cracks. Comes with original charger."),
        ("Dell XPS 13 Laptop", "electronics", "good", 72000, 139990, False, "dell-laptop", "Core i7 11th gen, 16GB RAM, 512GB SSD. Minor cosmetic marks. Runs like new."),
        ("Sony WH-1000XM4 Headphones", "electronics", "new", 22000, 29990, False, "headphones-sony", "Bought, never used. Still sealed in box. Genuine piece, purchased from Sony Centre."),
        ("iPad Air 4th Gen", "electronics", "good", 34000, 54900, True, "ipad-air", "Wi-Fi only, 64GB. Screen protector always on. No scratches on screen. Minor dent on corner."),
        ("Canon EOS M50 Mark II", "electronics", "good", 29000, 55990, False, "canon-camera", "Bought in 2022, used for casual photography. Shutter count ~3000. Comes with kit lens."),
        ("Nintendo Switch OLED", "electronics", "good", 24000, 34999, True, "nintendo-switch", "Used for 6 months. All original accessories included. No dead pixels."),
        ("Apple Watch Series 7 GPS", "electronics", "good", 24000, 41900, False, "apple-watch", "45mm Midnight aluminum. Battery at 91%. Always wore with a screen protector."),
        ("JBL Charge 5 Speaker", "electronics", "good", 7000, 14999, True, "jbl-speaker", "Water-resistant speaker, works perfectly. Minor scratches on rubber. Holds charge for 20 hours."),
        ("Kindle Paperwhite 11th Gen", "electronics", "new", 9500, 13999, False, "kindle-ebook", "Gifted and already have one. Still in box, never registered. 8GB storage."),
    ],
    # Priya — Fashion (Mumbai)
    [
        ("Levi's 511 Slim Jeans W32", "clothing", "good", 1200, 3999, True, "levis-jeans", "Washed twice, faded at the knee as per Levi's design. No rips or tears."),
        ("Nike Air Max 270 UK8", "clothing", "good", 4500, 10995, False, "nike-shoes", "Worn to the gym about 10 times. Sole in perfect condition. Comes with original box."),
        ("Adidas Originals Hoodie M", "clothing", "new", 2200, 4999, False, "adidas-hoodie", "Bought online, wrong size delivered. Never worn. Tags still on."),
        ("H&M Floral Summer Dress S", "clothing", "good", 800, 2499, True, "summer-dress", "Worn twice. Dry cleaned before selling. Light and breezy, perfect for Mumbai summers."),
        ("Ray-Ban Wayfarer Classic", "clothing", "good", 4500, 9990, False, "rayban-sunglasses", "RB2140 Black frame. Lenses are scratch-free. Comes with original case and cloth."),
        ("Zara Formal Blazer M", "clothing", "fair", 1500, 5990, True, "formal-blazer", "Small stain on inner lining, invisible when worn. Dry clean only. Great fit for interviews."),
        ("Puma Running Shoes UK9", "clothing", "good", 2800, 7999, True, "puma-shoes", "Lightly used for jogging. Insoles washed. Good grip remaining on soles."),
        ("Fossil Gen 5 Smartwatch", "clothing", "good", 6000, 16995, False, "fossil-watch", "Wear OS, works with Android and iPhone. Battery holds 24 hours. No scratches."),
        ("Leather Bifold Wallet", "clothing", "good", 600, 1999, False, "leather-wallet", "Genuine leather. Used for 4 months. Slight wear on corners. Clean and functional."),
        ("Woodland Ankle Boots UK8", "clothing", "fair", 2000, 6999, True, "woodland-boots", "Genuine leather. Resoled 6 months ago. Minor scratches on toe area."),
    ],
    # Arjun — Electronics + Sports (Bangalore)
    [
        ("OnePlus 10 Pro 256GB", "electronics", "good", 32000, 65999, True, "oneplus-10", "8GB RAM. No scratches. Comes with 80W charger. Battery health excellent."),
        ("Realme GT Neo 3 150W", "electronics", "good", 17000, 35999, False, "realme-gt", "Lightning fast charging, 0 to 100 in 16 mins. Slight mark on back panel."),
        ("SS Ton Player Cricket Bat", "sports", "good", 2800, 6500, True, "cricket-bat", "English Willow, Grade 3. Used for 2 seasons. Needs toe guard. Well knocked in."),
        ("Yonex Astrox 88S Racket", "sports", "good", 3500, 9000, False, "badminton-racket", "Professional grade, 4U. String tension at 26lbs. Minimal frame scuffs."),
        ("Hero Blast 26T Cycle", "sports", "good", 7500, 18000, True, "hero-cycle", "21-speed, front suspension. Used for 1 year. Tyres replaced 2 months ago."),
        ("Nike Premier 2 Football", "sports", "new", 1800, 3999, False, "football-nike", "Match ball quality. Bought for a tournament, match cancelled. Never used outside."),
        ("Mi Smart Band 7", "electronics", "good", 2000, 3999, False, "mi-band", "HR + SpO2 monitoring. Battery life 14 days. Minor scratch on screen edge."),
        ("Optimum Nutrition Gold Standard 5lb", "sports", "fair", 2200, 3999, True, "protein-powder", "1.5kg remaining out of 2.27kg. Double Rich Chocolate. Expires Dec 2025."),
        ("Chess Set Tournament Size", "sports", "new", 1500, 3499, False, "chess-set", "Weighted pieces, roll-up board, timer included. Gift from abroad. Never used."),
        ("Cosco Table Tennis Set", "sports", "good", 1200, 3299, True, "table-tennis", "2 rackets + 6 balls. Rubber in good condition. Minor cracks on handle of 1 racket."),
    ],
    # Meera — Books + Furniture (Chennai)
    [
        ("Harry Potter Complete Set 7 Books", "books", "good", 2000, 5499, True, "harry-potter-books", "All 7 books, Bloomsbury edition. Minor pencil marks inside Book 3. No torn pages."),
        ("NCERT Class 12 PCM Set", "books", "good", 600, 2200, False, "ncert-books", "Physics, Chemistry, Maths. Lightly highlighted. Clean covers."),
        ("Atomic Habits - James Clear", "books", "good", 220, 499, False, "atomic-habits-book", "Read twice. Some underlines in pencil. Great condition overall."),
        ("Wooden Study Table 4ft", "furniture", "good", 5000, 14000, True, "wooden-table", "Teak wood. One drawer functional. Minor scratch on top surface. Disassembles for transport."),
        ("Ergonomic Office Chair", "furniture", "good", 3500, 9999, True, "office-chair", "Lumbar support. Armrests slightly worn. Height adjustment works perfectly."),
        ("5-Tier Metal Bookshelf", "furniture", "fair", 1800, 4999, False, "bookshelf-metal", "Holds 200+ books. Some rust spots on bottom shelf. Very sturdy."),
        ("IKEA Lack Coffee Table", "furniture", "good", 2000, 4500, True, "coffee-table-ikea", "White. Small chip on one corner. Easy to assemble. No stains."),
        ("CAT 2024 Prep Books Set", "books", "new", 2200, 5500, False, "cat-prep-books", "TIME material + IMS workbooks. All pristine. Couldn't sit for exam due to job offer."),
        ("Rich Dad Poor Dad", "books", "good", 180, 399, False, "rich-dad-book", "Read once. Very clean. No marks or highlights."),
        ("The Alchemist - Paulo Coelho", "books", "good", 150, 250, True, "alchemist-book", "Slightly yellowed pages from age. All pages intact. Good reading copy."),
    ],
    # Vikash — Sports + Toys (Hyderabad)
    [
        ("Lego Star Wars Millennium Falcon", "toys", "good", 4500, 10999, False, "lego-millennium-falcon", "Complete set, all pieces accounted for. Box has minor wear. Manual included."),
        ("Hot Wheels Ultimate Garage", "toys", "good", 1500, 3999, True, "hot-wheels-garage", "Motorized elevator works. Few paint scratches on the ramp. Cars not included."),
        ("PlayStation 4 DualShock Controller", "electronics", "good", 2800, 5999, False, "ps4-controller", "Both analog sticks perfect. L2/R2 responsive. Charging cable included."),
        ("Carrom Board with Coins", "sports", "good", 2000, 4999, True, "carrom-board", "48x48 inch. Smooth playing surface. Set of coins included. Minor scratches on frame."),
        ("Cricket Kit Full Set", "sports", "fair", 4000, 13999, True, "cricket-kit-full", "Bat, pads, gloves, helmet. Helmet has a slight crack on the grille. Rest in good condition."),
        ("Badminton Kit Set 4-player", "sports", "good", 1500, 4299, False, "badminton-kit", "4 rackets, 20 shuttles, net. Used in park. Rackets strung and ready to play."),
        ("Skipping Rope Speed Cable", "sports", "new", 350, 999, False, "skipping-rope", "Ball bearing handles. Still in packet. Good for boxing/HIIT training."),
        ("UNO Card Game Original", "toys", "new", 400, 699, False, "uno-cards", "Original Mattel. Still sealed. Great for family game nights."),
        ("Remote Control Monster Truck", "toys", "good", 1400, 3499, True, "rc-monster-truck", "2.4GHz control. New batteries just put in. Works perfectly. Minor scratches."),
        ("Scrabble Classic Board Game", "toys", "good", 900, 2299, False, "scrabble-game", "All 100 tiles present. Board in great condition. Carry bag included."),
    ],
    # Ananya — Electronics + Clothes (Pune)
    [
        ("MacBook Air M1 256GB Space Grey", "electronics", "good", 65000, 92900, False, "macbook-air-m1", "2021 model. 8GB RAM. Battery cycles: 180. No dents. Original charger included."),
        ("Realme Buds Air 3 Neo", "electronics", "good", 2200, 4999, True, "earbuds-realme", "ANC earbuds. Battery life 30 hours with case. Minor ear tip wear."),
        ("Nikon D3500 with 18-55mm Lens", "electronics", "good", 24000, 42000, False, "nikon-d3500", "Entry DSLR. Shutter count 4200. No dust on sensor. Great starter camera."),
        ("GoPro Hero 9 Black", "electronics", "good", 19000, 39990, True, "gopro-hero9", "4K60fps. Includes 2 batteries, selfie stick, and mount. Slight scratch on lens housing."),
        ("Samsung 27 inch IPS Monitor", "electronics", "good", 13000, 23999, False, "samsung-monitor", "Full HD, 75Hz. Zero dead pixels. HDMI and VGA ports work perfectly."),
        ("Mechanical Keyboard Keychron K2", "electronics", "good", 5000, 9999, False, "mech-keyboard", "Red switches. Hot-swappable. Slight shine on some keycaps from use. Bluetooth works."),
        ("Cotton Ethnic Kurta Set M", "clothing", "new", 1200, 3500, False, "kurta-ethnic", "Bought for a wedding, colour didn't suit. Tags still on. Deep blue with golden border."),
        ("Formal Shirts 3-Pack L", "clothing", "good", 1000, 3000, True, "formal-shirts", "Van Heusen, light blue, white, and stripes. Ironed and packed. No stains."),
        ("Laptop Bag 15.6 inch", "electronics", "new", 900, 2499, False, "laptop-bag", "Never used. Multiple compartments. Water-resistant material. Fits MacBook 15 easily."),
        ("USB-C Hub 7-in-1 Anker", "electronics", "good", 1800, 5999, False, "usb-hub-anker", "4K HDMI, 3x USB 3.0, SD/microSD, power delivery. Works perfectly with MacBook."),
    ],
]

SLUG_MAP = {
    "electronics": None,
    "clothing":    None,
    "sports":      None,
    "books":       None,
    "furniture":   None,
    "toys":        None,
}


async def get_or_create_category(db: AsyncSession, name: str, slug: str, icon: str) -> uuid.UUID:
    res = await db.execute(select(Category).where(Category.slug == slug))
    cat = res.scalar_one_or_none()
    if cat:
        return cat.id
    cat = Category(id=uuid.uuid4(), name=name, slug=slug, icon=icon)
    db.add(cat)
    await db.flush()
    return cat.id


@router.post("/seed")
async def seed_demo(
    x_seed_secret: str = Header(..., alias="X-Seed-Secret"),
    db: AsyncSession = Depends(get_db),
):
    if x_seed_secret != SEED_SECRET:
        raise HTTPException(status_code=403, detail="Invalid seed secret")

    # ── Ensure categories exist ────────────────────────────────────────────────
    cat_ids = {
        "electronics": await get_or_create_category(db, "Electronics",  "electronics", "💻"),
        "clothing":    await get_or_create_category(db, "Clothing",      "clothing",    "👕"),
        "sports":      await get_or_create_category(db, "Sports",        "sports",      "🏏"),
        "books":       await get_or_create_category(db, "Books",         "books",       "📚"),
        "furniture":   await get_or_create_category(db, "Furniture",     "furniture",   "🛋️"),
        "toys":        await get_or_create_category(db, "Toys & Games",  "toys",        "🎮"),
    }
    await db.flush()

    created_users    = 0
    created_listings = 0

    for seller_data, seller_listings in zip(SELLERS, LISTINGS_BY_SELLER):
        # ── Skip if user already exists ────────────────────────────────────────
        res = await db.execute(select(User).where(User.email == seller_data["email"]))
        user = res.scalar_one_or_none()

        if not user:
            user = User(
                id=uuid.uuid4(),
                email=seller_data["email"],
                hashed_password=hash_password("Demo@12345"),
                full_name=seller_data["full_name"],
                role=UserRole.both,
                city=seller_data["city"],
                locality=seller_data["locality"],
                pincode=seller_data["pincode"],
                latitude=seller_data["lat"],
                longitude=seller_data["lon"],
                availability_radius_km=10.0,
                trust_score=seller_data["trust_score"],
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            await db.flush()

            profile = SellerProfile(
                id=uuid.uuid4(),
                user_id=user.id,
                bio=f"Hi! I'm {seller_data['full_name']} from {seller_data['locality']}, {seller_data['city']}. Selling quality items at fair prices.",
                avg_rating=round(random.uniform(3.8, 4.9), 1),
                total_ratings=random.randint(5, 40),
                total_sales=random.randint(3, 25),
            )
            db.add(profile)
            await db.flush()
            created_users += 1

        # ── Create listings ────────────────────────────────────────────────────
        for (title, cat_slug, condition, resell, original, nego, img_seed, desc) in seller_listings:
            # Check if listing already exists for this seller with this title
            existing = await db.execute(
                select(Listing).where(
                    Listing.seller_id == user.id,
                    Listing.title == title,
                )
            )
            if existing.scalar_one_or_none():
                continue

            # Add a small random offset to coordinates so listings aren't stacked
            lat_offset = random.uniform(-0.02, 0.02)
            lon_offset = random.uniform(-0.02, 0.02)

            listing = Listing(
                id=uuid.uuid4(),
                seller_id=user.id,
                category_id=cat_ids.get(cat_slug),
                title=title,
                description=desc,
                condition=ListingCondition(condition),
                original_price=float(original),
                reselling_price=float(resell),
                is_negotiable=nego,
                status=ListingStatus.active,
                pickup_latitude=seller_data["lat"] + lat_offset,
                pickup_longitude=seller_data["lon"] + lon_offset,
                pickup_radius_km=5.0,
                pincode=seller_data["pincode"],
                pickup_address=f"{seller_data['locality']}, {seller_data['city']}",
                created_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 240)),
            )
            db.add(listing)
            await db.flush()

            # Primary image
            image = ListingImage(
                id=uuid.uuid4(),
                listing_id=listing.id,
                cloudinary_url=img(img_seed),
                cloudinary_public_id=f"demo/{img_seed}",
                is_primary=True,
                display_order=0,
            )
            db.add(image)
            created_listings += 1

    await db.commit()

    return {
        "status": "✅ Demo data seeded",
        "users_created": created_users,
        "listings_created": created_listings,
        "note": "All demo accounts have password: Demo@12345",
        "cities": ["Delhi", "Mumbai", "Bangalore", "Chennai", "Hyderabad", "Pune"],
    }
