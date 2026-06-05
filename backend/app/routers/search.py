from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List
import uuid

from app.models.database import get_session
from app.models.framework import Framework, FrameworkConcept

router = APIRouter()


@router.get("")
async def search_frameworks(
    q: str = Query(..., min_length=1),
    category: str | None = None,
    limit: int = Query(10, le=50),
    session: AsyncSession = Depends(get_session),
):
    query = select(Framework).where(Framework.is_published == True)
    
    # Simple text search across title, description, content
    search_term = f"%{q.lower()}%"
    query = query.where(
        or_(
            Framework.title.ilike(search_term),
            Framework.description.ilike(search_term),
            Framework.content.ilike(search_term),
            Framework.key_concepts.ilike(search_term),
        )
    )
    
    if category:
        query = query.where(Framework.category == category)
    
    query = query.limit(limit)
    result = await session.execute(query)
    frameworks = result.scalars().all()
    
    return [
        {
            "id": f.id,
            "slug": f.slug,
            "title": f.title,
            "description": f.description,
            "category": f.category,
            "difficulty": f.difficulty,
            "matched_fields": _get_matched_fields(f, q),
        }
        for f in frameworks
    ]


@router.get("/concepts")
async def search_concepts(
    q: str = Query(..., min_length=1),
    framework_id: uuid.UUID | None = None,
    limit: int = Query(20, le=100),
    session: AsyncSession = Depends(get_session),
):
    query = select(FrameworkConcept).join(Framework).where(Framework.is_published == True)
    
    search_term = f"%{q.lower()}%"
    query = query.where(
        or_(
            FrameworkConcept.name.ilike(search_term),
            FrameworkConcept.definition.ilike(search_term),
            FrameworkConcept.example.ilike(search_term),
        )
    )
    
    if framework_id:
        query = query.where(FrameworkConcept.framework_id == framework_id)
    
    query = query.limit(limit)
    result = await session.execute(query)
    concepts = result.scalars().all()
    
    return [
        {
            "id": c.id,
            "framework_id": c.framework_id,
            "name": c.name,
            "definition": c.definition,
            "formula": c.formula,
            "example": c.example,
            "tags": c.tags if isinstance(c.tags, list) else [],
        }
        for c in concepts
    ]


def _get_matched_fields(framework: Framework, query: str) -> List[str]:
    matched = []
    query_lower = query.lower()
    if query_lower in framework.title.lower():
        matched.append("title")
    if query_lower in framework.description.lower():
        matched.append("description")
    if query_lower in framework.content.lower():
        matched.append("content")
    if framework.key_concepts and query_lower in framework.key_concepts.lower():
        matched.append("key_concepts")
    return matched