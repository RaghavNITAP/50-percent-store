from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from database import get_db
from models import User, RefreshToken, SellerProfile
from schemas.auth import UserRegister, UserLogin, TokenResponse, RefreshRequest, UserOut, UserUpdate
from core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, hash_refresh_token
)
from core.dependencies import get_current_user
import uuid

router = APIRouter(prefix="/auth", tags=["Auth"])


# ─── Register ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserOut, status_code=201)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check duplicate email
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check duplicate phone
    if payload.phone:
        result = await db.execute(select(User).where(User.phone == payload.phone))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Phone already registered")

    user = User(
        id=uuid.uuid4(),
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=payload.role,
        city=payload.city,
        locality=payload.locality,
    )
    db.add(user)
    await db.flush()  # get user.id before commit

    # Auto-create seller profile if role is seller/both
    if payload.role in ("seller", "both"):
        db.add(SellerProfile(id=uuid.uuid4(), user_id=user.id))

    await db.commit()
    await db.refresh(user)
    return user


# ─── Login ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    access_token = create_access_token(str(user.id), user.role)
    raw_refresh, hashed_refresh, expires_at = create_refresh_token()

    db.add(RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hashed_refresh,
        expires_at=expires_at,
    ))
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


# ─── Refresh ──────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hash_refresh_token(payload.refresh_token)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
        )
    )
    stored = result.scalar_one_or_none()

    if not stored or stored.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # Rotate — revoke old, issue new
    stored.revoked = True

    user_result = await db.execute(select(User).where(User.id == stored.user_id))
    user = user_result.scalar_one()

    access_token = create_access_token(str(user.id), user.role)
    raw_refresh, hashed_refresh, expires_at = create_refresh_token()

    db.add(RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hashed_refresh,
        expires_at=expires_at,
    ))
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


# ─── Logout ───────────────────────────────────────────────────────────────────

@router.post("/logout", status_code=204)
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hash_refresh_token(payload.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored = result.scalar_one_or_none()
    if stored:
        stored.revoked = True
        await db.commit()


# ─── Me ───────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user


# ─── Upgrade to seller ────────────────────────────────────────────────────────

@router.post("/become-seller", response_model=UserOut)
async def become_seller(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role in ("seller", "both"):
        raise HTTPException(status_code=400, detail="Already a seller")

    current_user.role = "both"

    result = await db.execute(
        select(SellerProfile).where(SellerProfile.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        db.add(SellerProfile(id=uuid.uuid4(), user_id=current_user.id))

    await db.commit()
    await db.refresh(current_user)
    return current_user