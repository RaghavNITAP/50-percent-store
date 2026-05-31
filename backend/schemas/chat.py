from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from enum import Enum


class MessageType(str, Enum):
    text = "text"
    offer = "offer"
    system = "system"


# ─── Conversation ─────────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    listing_id: UUID
    initial_message: str


class ParticipantOut(BaseModel):
    id: UUID
    full_name: str
    avatar_url: Optional[str]

    model_config = {"from_attributes": True}


class ListingBrief(BaseModel):
    id: UUID
    title: str
    reselling_price: float
    images: list = []

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: UUID
    listing_id: Optional[UUID]
    listing: Optional[ListingBrief]
    participants: List[ParticipantOut] = []
    last_message_at: Optional[datetime]
    unread_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Message ──────────────────────────────────────────────────────────────────

class MessageOut(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    content: str
    message_type: MessageType
    offer_amount: Optional[float]
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageList(BaseModel):
    items: List[MessageOut]
    total: int
    page: int
    page_size: int


# ─── WebSocket payloads ───────────────────────────────────────────────────────

class WSMessageIn(BaseModel):
    type: MessageType = MessageType.text
    content: str
    offer_amount: Optional[float] = None


class WSMessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    content: str
    message_type: str
    offer_amount: Optional[float]
    created_at: str