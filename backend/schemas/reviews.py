from pydantic import BaseModel, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class ReviewCreate(BaseModel):
    order_id: UUID
    rating: int
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def valid_rating(cls, v):
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5")
        return v


class ReviewerOut(BaseModel):
    id: UUID
    full_name: str
    avatar_url: Optional[str]

    model_config = {"from_attributes": True}


class ReviewOut(BaseModel):
    id: UUID
    order_id: UUID
    reviewer_id: UUID
    reviewed_user_id: UUID
    rating: int
    comment: Optional[str]
    created_at: datetime
    reviewer: ReviewerOut

    model_config = {"from_attributes": True}


class SellerRatingSummary(BaseModel):
    user_id: UUID
    full_name: str
    avg_rating: float
    total_ratings: int
    total_sales: int
    reviews: List[ReviewOut] = []