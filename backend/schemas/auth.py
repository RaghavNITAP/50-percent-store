from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from uuid import UUID
from enum import Enum
import re


class UserRole(str, Enum):
    buyer = "buyer"
    seller = "seller"
    both = "both"


# ─── Register ─────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.buyer
    city: Optional[str] = None
    locality: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    availability_radius_km: Optional[float] = 5.0
    
    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("phone")
    @classmethod
    def phone_format(cls, v):
        if v and not re.match(r"^\+?[0-9]{10,15}$", v):
            raise ValueError("Invalid phone number")
        return v


# ─── Login ────────────────────────────────────────────────────────────────────

class UserLogin(BaseModel):
    email: EmailStr
    password: str


# ─── Tokens ───────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ─── User responses ───────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: str
    phone: Optional[str]
    role: UserRole
    city: Optional[str]
    locality: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    availability_radius_km: float
    is_verified: bool
    avatar_url: Optional[str]

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    locality: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    availability_radius_km: Optional[float] = None
    avatar_url: Optional[str] = None
