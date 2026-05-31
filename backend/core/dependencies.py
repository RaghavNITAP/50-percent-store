from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User
from core.security import decode_access_token

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


async def get_current_seller(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("seller", "both"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seller account required",
        )
    return user


async def get_current_buyer(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("buyer", "both"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Buyer account required",
        )
    return user
