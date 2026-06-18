import uuid
import json
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.models.user import User

DEFAULT_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


async def get_default_user(session: AsyncSession) -> User:
    result = await session.execute(select(User).where(User.id == DEFAULT_USER_ID))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=401,
            detail="No user configured. Run `python backend/seed/seed_db.py` first."
        )
    return user
