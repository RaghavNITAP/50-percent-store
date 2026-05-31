import cloudinary
import cloudinary.uploader
import os
from fastapi import UploadFile, HTTPException
from dotenv import load_dotenv

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_MB = 5


async def upload_image(file: UploadFile, folder: str = "listings") -> dict:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP allowed")

    contents = await file.read()

    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Image must be under {MAX_SIZE_MB}MB")

    result = cloudinary.uploader.upload(
        contents,
        folder=folder,
        transformation=[
            {"width": 1200, "height": 1200, "crop": "limit"},
            {"quality": "auto"},
            {"fetch_format": "auto"},
        ],
    )

    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
    }


async def delete_image(public_id: str):
    cloudinary.uploader.destroy(public_id)