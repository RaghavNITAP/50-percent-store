from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from models import RequestStatus, ConditionPreference


class RequestCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    min_budget: Optional[float] = None
    max_budget: Optional[float] = None
    condition_preference: ConditionPreference = ConditionPreference.any
    pincode: str = Field(..., min_length=6, max_length=6)
    radius_km: float = Field(10.0, ge=1.0, le=100.0)


class RequestUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    min_budget: Optional[float] = None
    max_budget: Optional[float] = None
    condition_preference: Optional[ConditionPreference] = None
    radius_km: Optional[float] = Field(None, ge=1.0, le=100.0)


class RequesterOut(BaseModel):
    id: UUID
    full_name: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class CategoryOut(BaseModel):
    id: UUID
    name: str
    slug: str
    icon: Optional[str] = None

    class Config:
        from_attributes = True


class RequestOut(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    category: Optional[CategoryOut] = None
    min_budget: Optional[float] = None
    max_budget: Optional[float] = None
    condition_preference: ConditionPreference
    pincode: Optional[str] = None
    radius_km: float
    status: RequestStatus
    expires_at: datetime
    created_at: datetime
    requester: RequesterOut

    class Config:
        from_attributes = True


class RequestList(BaseModel):
    items: List[RequestOut]
    total: int
    page: int
    page_size: int
