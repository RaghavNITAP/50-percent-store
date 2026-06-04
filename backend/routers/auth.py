from fastapi import APIRouter, Depends, HTTPException, Request, status, Form
from fastapi.responses import RedirectResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import httpx
import secrets
import os

from database import get_db
from models import User, RefreshToken, SellerProfile, UserRole
from schemas.auth import UserRegister, UserLogin, TokenResponse, RefreshRequest, UserOut, UserUpdate, GoogleAuthPayload
from core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, hash_refresh_token
)
from core.dependencies import get_current_user
from core.trust import apply_one_time_bonus
import uuid

router = APIRouter(prefix="/auth", tags=["Auth"])


# ─── Register ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserOut, status_code=201)
@limiter.limit("3/minute")
async def register(request: Request, payload: UserRegister, db: AsyncSession = Depends(get_db)):
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
        pincode=payload.pincode,
        latitude=payload.latitude,
        longitude=payload.longitude,
        availability_radius_km=payload.availability_radius_km,
    )
    db.add(user)
    await db.flush()  # get user.id before commit

    # Auto-create seller profile for all users (everyone can sell)
    db.add(SellerProfile(id=uuid.uuid4(), user_id=user.id))

    await db.commit()
    await db.refresh(user)
    return user


# ─── Login ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, payload: UserLogin, db: AsyncSession = Depends(get_db)):
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
@limiter.limit("10/minute")
async def refresh(request: Request, payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
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
    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)

    # One-time trust bonuses for completing profile
    if "phone" in update_data:
        await apply_one_time_bonus(current_user, "phone", +5, db)
    if "latitude" in update_data or "longitude" in update_data:
        await apply_one_time_bonus(current_user, "gps", +2, db)
    if "avatar_url" in update_data:
        await apply_one_time_bonus(current_user, "avatar", +3, db)

    await db.commit()
    await db.refresh(current_user)
    return current_user


# ─── Google OAuth ────────────────────────────────────────────────────────────

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

@router.post("/google", response_model=TokenResponse)
async def google_login(payload: GoogleAuthPayload, db: AsyncSession = Depends(get_db)):
    # Verify access token and get user info from Google
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={payload.token}",
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    info = resp.json()

    email = info.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="No email in Google token")

    full_name = info.get("name") or email.split("@")[0]
    avatar_url = info.get("picture")

    # Find or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            id=uuid.uuid4(),
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=full_name,
            avatar_url=avatar_url,
            role=UserRole.both,
        )
        db.add(user)
        await db.flush()
        db.add(SellerProfile(id=uuid.uuid4(), user_id=user.id))
        if avatar_url:
            await apply_one_time_bonus(user, "avatar", +3, db)
    else:
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url

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


# ─── Google OAuth — redirect mode (popup-blocker proof) ──────────────────────

@router.post("/google/callback")
async def google_callback(
    credential: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    FRONTEND_URL = os.getenv("FRONTEND_URL", "https://50-percent-store.vercel.app")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
        )

    if resp.status_code != 200:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=invalid_google_token", status_code=302)

    info = resp.json()
    email = info.get("email")
    if not email:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=no_email", status_code=302)

    full_name = info.get("name") or email.split("@")[0]
    avatar_url = info.get("picture")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            id=uuid.uuid4(),
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=full_name,
            avatar_url=avatar_url,
            role=UserRole.both,
        )
        db.add(user)
        await db.flush()
        db.add(SellerProfile(id=uuid.uuid4(), user_id=user.id))
        if avatar_url:
            await apply_one_time_bonus(user, "avatar", +3, db)
    else:
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url

    if not user.is_active:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=account_deactivated", status_code=302)

    access_token = create_access_token(str(user.id), user.role)
    raw_refresh, hashed_refresh, expires_at = create_refresh_token()
    db.add(RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hashed_refresh,
        expires_at=expires_at,
    ))
    await db.commit()

    return RedirectResponse(
        url=f"{FRONTEND_URL}/google-callback?at={access_token}&rt={raw_refresh}",
        status_code=302,
    )

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