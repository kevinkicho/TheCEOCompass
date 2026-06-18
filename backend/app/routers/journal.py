from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
import uuid
import json
from datetime import datetime

from app.models.database import get_session
from app.models.journal import JournalEntry, JournalOutcome
from app.routers.auth import get_default_user
from app.schemas.journal import JournalEntryCreate, JournalEntryRead, JournalEntryUpdate, JournalOutcomeCreate, JournalOutcomeRead

router = APIRouter()


@router.post("", response_model=JournalEntryRead, status_code=201)
async def create_journal_entry(
    entry: JournalEntryCreate,
    session: AsyncSession = Depends(get_session),
):
    user = await get_default_user(session)
    
    db_entry = JournalEntry(
        user_id=user.id,
        scenario_id=entry.scenario_id,
        title=entry.title,
        context=entry.context,
        decision=entry.decision,
        alternatives_considered=json.dumps(entry.alternatives_considered),
        rationale=entry.rationale,
        key_assumptions=json.dumps(entry.key_assumptions),
        success_metrics=json.dumps(entry.success_metrics),
        confidence=entry.confidence,
        review_date=entry.review_date,
    )
    session.add(db_entry)
    await session.flush()
    
    # Re-query with eager-loaded outcomes
    result = await session.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.outcomes))
        .where(JournalEntry.id == db_entry.id)
    )
    entry_loaded = result.scalar_one()
    return entry_loaded


@router.get("", response_model=List[JournalEntryRead])
async def list_journal_entries(
    session: AsyncSession = Depends(get_session),
):
    user = await get_default_user(session)
    result = await session.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.outcomes))
        .where(JournalEntry.user_id == user.id)
        .order_by(JournalEntry.created_at.desc())
    )
    entries = result.scalars().all()
    return entries


@router.get("/{entry_id}", response_model=JournalEntryRead)
async def get_journal_entry(
    entry_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    user = await get_default_user(session)
    result = await session.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.outcomes))
        .where(JournalEntry.id == entry_id)
        .where(JournalEntry.user_id == user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return entry


@router.patch("/{entry_id}", response_model=JournalEntryRead)
async def update_journal_entry(
    entry_id: uuid.UUID,
    entry_update: JournalEntryUpdate,
    session: AsyncSession = Depends(get_session),
):
    user = await get_default_user(session)
    result = await session.execute(
        select(JournalEntry)
        .where(JournalEntry.id == entry_id)
        .where(JournalEntry.user_id == user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    update_data = entry_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ["alternatives_considered", "key_assumptions", "success_metrics"]:
            value = json.dumps(value)
        setattr(entry, field, value)
    
    await session.flush()
    await session.refresh(entry)
    return entry


@router.post("/{entry_id}/outcome", response_model=JournalOutcomeRead, status_code=201)
async def create_journal_outcome(
    entry_id: uuid.UUID,
    outcome: JournalOutcomeCreate,
    session: AsyncSession = Depends(get_session),
):
    user = await get_default_user(session)
    result = await session.execute(
        select(JournalEntry)
        .where(JournalEntry.id == entry_id)
        .where(JournalEntry.user_id == user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    import json
    db_outcome = JournalOutcome(
        entry_id=entry_id,
        what_happened=outcome.what_happened,
        was_right=outcome.was_right,
        metrics_actual=json.dumps(outcome.metrics_actual),
        what_missed=outcome.what_missed,
        what_got_right=outcome.what_got_right,
        updated_confidence=outcome.updated_confidence,
        lesson=outcome.lesson,
    )
    session.add(db_outcome)
    
    # Update entry
    entry.outcome_captured = True
    entry.outcome_captured_at = datetime.utcnow()
    
    await session.flush()
    await session.refresh(db_outcome)
    return db_outcome