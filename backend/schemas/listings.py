from pydantic import BaseModel, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from enum import Enum


class ListingCondition(str, Enum):
    new = "new"
    good = "good"
    fair = "fair"
    poor = "poor"


class ListingStatus(str, Enum):
    active = "active"
    sold = "sold"
    paused = "paused"
    deleted = "deleted"


class ListingImageOut(BaseModel):
    id: UUID
    cloudinary_url: str
    is_primary: bool
    display_order: int
    model_config = {"from_attributes": True}


class PickupPointIn(BaseModel):
    label: Optional[str] = None
    latitude: float
    longitude: float
    radius_km: float = 2.0


class PickupPointOut(PickupPointIn):
    id: UUID
    model_config = {"from_attributes": True}


class ListingCreate(BaseModel):
    title: str
    description: str
    condition: ListingCondition
    original_price: Optional[float] = None
    reselling_price: float
    age_years: Optional[float] = None
    defects: Optional[str] = None
    is_negotiable: bool = False
    category_id: Optional[UUID] = None
    pickup_address: Optional[str] = None
    pickup_latitude: float
    pickup_longitude: float
    pickup_radius_km: float = 3.0
    additional_pickups: Optional[List[PickupPointIn]] = []

    @field_validator("reselling_price")
    @classmethod
    def price_positive(cls, v):
        if v <= 0:
            raise ValueError("Price must be greater than 0")
        return v


class ListingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    condition: Optional[ListingCondition] = None
    original_price: Optional[float] = None
    reselling_price: Optional[float] = None
    age_years: Optional[float] = None
    defects: Optional[str] = None
    is_negotiable: Optional[bool] = None
    category_id: Optional[UUID] = None
    pickup_address: Optional[str] = None
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None
    pickup_radius_km: Optional[float] = None
    status: Optional[ListingStatus] = None


class SellerBrief(BaseModel):
    id: UUID
    full_name: str
    avatar_url: Optional[str]
    city: Optional[str]
    locality: Optional[str]
    trust_score: int = 70
    model_config = {"from_attributes": True}


class ListingOut(BaseModel):
    id: UUID
    title: str
    description: str
    condition: ListingCondition
    original_price: Optional[float]
    reselling_price: float
    age_years: Optional[float]
    defects: Optional[str]
    is_negotiable: bool
    status: ListingStatus
    pickup_address: Optional[str]
    pickup_latitude: float
    pickup_longitude: float
    pickup_radius_km: float
    view_count: int
    created_at: datetime
    seller: SellerBrief
    images: List[ListingImageOut] = []
    additional_pickups: List[PickupPointOut] = []
    ai_suggested_price: Optional[float] = None
    ai_quality_score: Optional[float] = None
    model_config = {"from_attributes": True}


class ListingList(BaseModel):
    items: List[ListingOut]
    total: int
    page: int
    page_size: int