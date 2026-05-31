from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from enum import Enum


class OrderStatus(str, Enum):
    pending = "pending"
    paid = "paid"
    completed = "completed"
    cancelled = "cancelled"
    refunded = "refunded"


class OrderCreate(BaseModel):
    listing_id: UUID
    agreed_price: float


class OrderOut(BaseModel):
    id: UUID
    listing_id: UUID
    buyer_id: UUID
    seller_id: UUID
    agreed_price: float
    platform_fee: float
    status: OrderStatus
    stripe_payment_intent_id: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PaymentIntentOut(BaseModel):
    order_id: str
    client_secret: str
    amount: int          # in cents (USD)
    currency: str


class RefundRequest(BaseModel):
    reason: Optional[str] = None