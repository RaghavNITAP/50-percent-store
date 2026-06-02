from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, Enum,
    ForeignKey, ARRAY, Index, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.sql import func
import uuid
import enum


class Base(DeclarativeBase):
    pass


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    buyer = "buyer"
    seller = "seller"
    both = "both"


class ListingCondition(str, enum.Enum):
    new = "new"
    good = "good"
    fair = "fair"
    poor = "poor"


class ListingStatus(str, enum.Enum):
    active = "active"
    sold = "sold"
    paused = "paused"
    deleted = "deleted"


class OrderStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    completed = "completed"
    cancelled = "cancelled"
    refunded = "refunded"


class MessageType(str, enum.Enum):
    text = "text"
    offer = "offer"
    system = "system"


# ─── Users ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    avatar_url = Column(Text, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.buyer, nullable=False)

    # Location
    city = Column(String(100), nullable=True)
    locality = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    availability_radius_km = Column(Float, default=5.0)

    # Meta
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    trust_score = Column(Integer, default=70)
    trust_score_bonuses = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Seller profile
    seller_profile = relationship("SellerProfile", back_populates="user", uselist=False)

    # Relationships
    listings = relationship("Listing", back_populates="seller", foreign_keys="Listing.seller_id")
    orders_as_buyer = relationship("Order", back_populates="buyer", foreign_keys="Order.buyer_id")
    orders_as_seller = relationship("Order", back_populates="seller", foreign_keys="Order.seller_id")
    reviews_given = relationship("Review", back_populates="reviewer", foreign_keys="Review.reviewer_id")
    reviews_received = relationship("Review", back_populates="reviewed_user", foreign_keys="Review.reviewed_user_id")
    conversations = relationship("ConversationParticipant", back_populates="user")
    refresh_tokens = relationship("RefreshToken", back_populates="user")


class SellerProfile(Base):
    __tablename__ = "seller_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    bio = Column(Text, nullable=True)
    avg_rating = Column(Float, default=0.0)
    total_ratings = Column(Integer, default=0)
    total_sales = Column(Integer, default=0)
    stripe_account_id = Column(String(100), nullable=True)  # Stripe Connect
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="seller_profile")


# ─── Auth ─────────────────────────────────────────────────────────────────────

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    token_hash = Column(String(255), unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked = Column(Boolean, default=False)

    user = relationship("User", back_populates="refresh_tokens")


# ─── Listings ─────────────────────────────────────────────────────────────────

class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    icon = Column(String(50), nullable=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)

    subcategories = relationship("Category", backref="parent", remote_side=[id])
    listings = relationship("Listing", back_populates="category")


class Listing(Base):
    __tablename__ = "listings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)

    # Core fields
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    condition = Column(Enum(ListingCondition), nullable=False)
    original_price = Column(Float, nullable=True)
    reselling_price = Column(Float, nullable=False)
    age_years = Column(Float, nullable=True)           # e.g. 1.5 = 1.5 years old
    defects = Column(Text, nullable=True)
    is_negotiable = Column(Boolean, default=False)
    status = Column(Enum(ListingStatus), default=ListingStatus.active)

    # AI-assisted fields
    ai_suggested_price = Column(Float, nullable=True)
    ai_quality_score = Column(Float, nullable=True)   # 0–100
    ai_quality_feedback = Column(JSONB, nullable=True)

    # Location (pickup point)
    pickup_address = Column(Text, nullable=True)
    pickup_latitude = Column(Float, nullable=False)
    pickup_longitude = Column(Float, nullable=False)
    pickup_radius_km = Column(Float, default=3.0)

    # Meta
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    sold_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    seller = relationship("User", back_populates="listings", foreign_keys=[seller_id])
    category = relationship("Category", back_populates="listings")
    images = relationship("ListingImage", back_populates="listing", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="listing")
    additional_pickups = relationship("ListingPickupPoint", back_populates="listing", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("reselling_price > 0", name="positive_price"),
        Index("ix_listings_status", "status"),
        Index("ix_listings_location", "pickup_latitude", "pickup_longitude"),
    )


class ListingImage(Base):
    __tablename__ = "listing_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    cloudinary_url = Column(Text, nullable=False)
    cloudinary_public_id = Column(String(255), nullable=False)
    is_primary = Column(Boolean, default=False)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    listing = relationship("Listing", back_populates="images")


class ListingPickupPoint(Base):
    """Seller can set multiple pickup locations per listing."""
    __tablename__ = "listing_pickup_points"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    label = Column(String(100), nullable=True)         # e.g. "Near Metro Gate 2"
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_km = Column(Float, default=2.0)

    listing = relationship("Listing", back_populates="additional_pickups")


# ─── Orders / Payments ────────────────────────────────────────────────────────

class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id"), nullable=False)
    buyer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    agreed_price = Column(Float, nullable=False)
    platform_fee = Column(Float, default=0.0)          # future monetisation
    status = Column(Enum(OrderStatus), default=OrderStatus.pending)

    # Stripe
    stripe_payment_intent_id = Column(String(255), nullable=True)
    stripe_charge_id = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    listing = relationship("Listing", back_populates="orders")
    buyer = relationship("User", back_populates="orders_as_buyer", foreign_keys=[buyer_id])
    seller = relationship("User", back_populates="orders_as_seller", foreign_keys=[seller_id])
    review = relationship("Review", back_populates="order", uselist=False)


# ─── Chat ─────────────────────────────────────────────────────────────────────

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_message_at = Column(DateTime(timezone=True), nullable=True)

    listing = relationship("Listing")
    participants = relationship("ConversationParticipant", back_populates="conversation")
    messages = relationship("Message", back_populates="conversation", order_by="Message.created_at")


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    unread_count = Column(Integer, default=0)
    last_read_at = Column(DateTime(timezone=True), nullable=True)

    conversation = relationship("Conversation", back_populates="participants")
    user = relationship("User", back_populates="conversations")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(Enum(MessageType), default=MessageType.text)
    offer_amount = Column(Float, nullable=True)        # used when type = offer
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")


# ─── Reviews ──────────────────────────────────────────────────────────────────

class Review(Base):
    __tablename__ = "reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), unique=True, nullable=False)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reviewed_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)           # 1–5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", back_populates="review")
    reviewer = relationship("User", back_populates="reviews_given", foreign_keys=[reviewer_id])
    reviewed_user = relationship("User", back_populates="reviews_received", foreign_keys=[reviewed_user_id])

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="valid_rating"),
    )
