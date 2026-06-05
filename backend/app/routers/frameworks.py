from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from app.models.database import get_session
from app.models.framework import Framework, FrameworkConcept
from sqlalchemy.orm import selectinload
from app.schemas.framework import FrameworkRead, FrameworkListItem, FrameworkConceptRead

router = APIRouter()


@router.get("", response_model=List[FrameworkListItem])
async def list_frameworks(
    category: str | None = Query(None),
    difficulty: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    query = select(Framework).where(Framework.is_published == True)
    if category:
        query = query.where(Framework.category == category)
    if difficulty:
        query = query.where(Framework.difficulty == difficulty)
    query = query.order_by(Framework.category, Framework.difficulty, Framework.title)
    result = await session.execute(query)
    frameworks = result.scalars().all()
    return frameworks


@router.get("/slug/{slug}", response_model=FrameworkRead)
async def get_framework_by_slug(
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Framework)
        .options(selectinload(Framework.concepts))
        .where(Framework.slug == slug)
    )
    framework = result.scalar_one_or_none()
    if not framework:
        raise HTTPException(status_code=404, detail="Framework not found")
    return framework


@router.get("/{framework_id}", response_model=FrameworkRead)
async def get_framework(
    framework_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Framework)
        .options(selectinload(Framework.concepts))
        .where(Framework.id == framework_id)
    )
    framework = result.scalar_one_or_none()
    if not framework:
        raise HTTPException(status_code=404, detail="Framework not found")
    return framework


@router.get("/{framework_id}/concepts", response_model=List[FrameworkConceptRead])
async def get_framework_concepts(
    framework_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(FrameworkConcept)
        .where(FrameworkConcept.framework_id == framework_id)
        .order_by(FrameworkConcept.order_index)
    )
    concepts = result.scalars().all()
    return concepts