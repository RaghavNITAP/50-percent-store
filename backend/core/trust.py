"""
Trust score engine.
- Every user starts at 70 (set in DB default).
- Score is clamped to [0, 100].
- One-time bonuses are tracked in trust_score_bonuses JSONB field.
"""

from sqlalchemy.ext.asyncio import AsyncSession


def _clamp(value: int) -> int:
    return max(0, min(100, value))


async def apply_trust_delta(user, delta: int, db: AsyncSession) -> None:
    """Apply a positive or negative delta to a user's trust score."""
    current = user.trust_score if user.trust_score is not None else 70
    user.trust_score = _clamp(current + delta)
    await db.flush()


async def apply_one_time_bonus(user, key: str, delta: int, db: AsyncSession) -> None:
    """
    Apply a bonus only once per key (e.g. 'phone', 'gps', 'avatar').
    Skips silently if already applied.
    """
    bonuses = user.trust_score_bonuses or {}
    if bonuses.get(key):
        return  # already applied
    await apply_trust_delta(user, delta, db)
    # Update bonuses dict — must reassign for SQLAlchemy to detect JSONB mutation
    user.trust_score_bonuses = {**bonuses, key: True}
    await db.flush()
