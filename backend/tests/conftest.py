import os
import pytest
import asyncio

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("ENVIRONMENT", "test")

from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.database import init_db, close_db, async_session_maker


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def setup_db():
    await init_db()
    yield
    await close_db()


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def db_session():
    async with async_session_maker() as session:
        yield session
        await session.rollback()
        await session.close()
