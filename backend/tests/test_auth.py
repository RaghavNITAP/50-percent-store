"""
Auth endpoint tests — uses in-memory SQLite so no real DB is needed.

Run with:  pytest backend/tests/test_auth.py -v
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from main import app
from database import get_db
from models import Base

# ─── In-memory SQLite engine (no Postgres required) ───────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    bind=test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_test_tables():
    """Create all tables once before tests run."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture()
async def client():
    """HTTP test client with DB override."""
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ─── Helper ───────────────────────────────────────────────────────────────────

VALID_USER = {
    "email": "test@example.com",
    "password": "Password123",
    "full_name": "Test User",
    "role": "buyer",
}


async def register_user(client: AsyncClient, payload: dict = None):
    payload = payload or VALID_USER
    return await client.post("/auth/register", json=payload)


# ─── Tests ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    """A new user can register and gets back their profile."""
    resp = await register_user(client)
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == VALID_USER["email"]
    assert data["role"] == "buyer"
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    """Registering with an already-used email returns 400."""
    await register_user(client)  # first — may already exist from previous test
    resp = await register_user(client)  # second attempt
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    """Passwords shorter than 8 chars are rejected with 422."""
    payload = {**VALID_USER, "email": "weak@example.com", "password": "123"}
    resp = await client.post("/auth/register", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    """Registered user can log in and receives access + refresh tokens."""
    await register_user(client)
    resp = await client.post(
        "/auth/login",
        json={"email": VALID_USER["email"], "password": VALID_USER["password"]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    """Wrong password returns 401."""
    await register_user(client)
    resp = await client.post(
        "/auth/login",
        json={"email": VALID_USER["email"], "password": "WrongPass999"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_without_token(client: AsyncClient):
    """Accessing /auth/me without a token returns 401."""
    resp = await client.get("/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_with_valid_token(client: AsyncClient):
    """Accessing /auth/me with a valid token returns the current user."""
    await register_user(client)
    login_resp = await client.post(
        "/auth/login",
        json={"email": VALID_USER["email"], "password": VALID_USER["password"]},
    )
    token = login_resp.json()["access_token"]
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == VALID_USER["email"]
