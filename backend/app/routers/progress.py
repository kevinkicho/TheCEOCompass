from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import uuid
import json
from datetime import datetime, timedelta

from app.models.database import get_session
from app.models.progress import UserProgress, CalibrationRecord
from app.models.journal import JournalEntry, JournalOutcome
from app.models.user import User
from app.schemas.progress import ProgressRead, CalibrationRecordRead, CalibrationSummary

router = APIRouter()


async def get_demo_user(session: AsyncSession) -> User:
    result = await session.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        user = User(email="demo@ceo.local", hashed_password="demo")
        session.add(user)
        await session.flush()
    return user


@router.get("", response_model=ProgressRead)
async def get_progress(
    session: AsyncSession = Depends(get_session),
):
    user = await get_demo_user(session)
    result = await session.execute(
        select(UserProgress).where(UserProgress.user_id == user.id)
    )
    progress = result.scalar_one_or_none()
    
    if not progress:
        progress = UserProgress(user_id=user.id)
        session.add(progress)
        await session.flush()
        await session.refresh(progress)
    
    # Parse JSON fields
    progress_dict = {
        "user_id": progress.user_id,
        "scenarios_completed": progress.scenarios_completed,
        "scenarios_in_progress": progress.scenarios_in_progress,
        "total_scenario_score": progress.total_scenario_score,
        "average_scenario_score": progress.average_scenario_score,
        "framework_mastery": json.loads(progress.framework_mastery) if progress.framework_mastery else {},
        "current_streak_days": progress.current_streak_days,
        "longest_streak_days": progress.longest_streak_days,
        "last_activity_date": progress.last_activity_date,
        "current_module_id": progress.current_module_id,
        "modules_completed": json.loads(progress.modules_completed) if progress.modules_completed else [],
    }
    return progress_dict


@router.get("/calibration", response_model=CalibrationSummary)
async def get_calibration(
    session: AsyncSession = Depends(get_session),
):
    user = await get_demo_user(session)
    
    # Get all calibration records
    result = await session.execute(
        select(CalibrationRecord)
        .where(CalibrationRecord.user_id == user.id)
        .order_by(CalibrationRecord.created_at)
    )
    records = result.scalars().all()
    
    if not records:
        return CalibrationSummary(
            total_predictions=0,
            average_confidence=0.0,
            accuracy=0.0,
            average_brier_score=0.0,
            calibration_by_confidence={},
            calibration_by_domain={},
            trend=[],
        )
    
    # Calculate summary stats
    total = len(records)
    correct = sum(1 for r in records if r.was_correct)
    avg_confidence = sum(r.confidence for r in records) / total
    avg_brier = sum(r.brier_score for r in records) / total
    
    # Calibration by confidence buckets
    calibration_by_confidence = {}
    for r in records:
        bucket = f"{(r.confidence // 10) * 10}-{(r.confidence // 10) * 10 + 9}"
        if bucket not in calibration_by_confidence:
            calibration_by_confidence[bucket] = {"count": 0, "correct": 0, "avg_confidence": 0}
        calibration_by_confidence[bucket]["count"] += 1
        calibration_by_confidence[bucket]["correct"] += 1 if r.was_correct else 0
        calibration_by_confidence[bucket]["avg_confidence"] += r.confidence
    
    for bucket in calibration_by_confidence:
        c = calibration_by_confidence[bucket]
        c["accuracy"] = c["correct"] / c["count"]
        c["avg_confidence"] = c["avg_confidence"] / c["count"]
    
    # Monthly trend
    trend = []
    current_month = None
    month_records = []
    for r in records:
        month_key = r.created_at.strftime("%Y-%m")
        if month_key != current_month:
            if month_records:
                m_correct = sum(1 for mr in month_records if mr.was_correct)
                trend.append({
                    "month": current_month,
                    "total": len(month_records),
                    "accuracy": m_correct / len(month_records),
                    "avg_confidence": sum(mr.confidence for mr in month_records) / len(month_records),
                    "avg_brier": sum(mr.brier_score for mr in month_records) / len(month_records),
                })
            current_month = month_key
            month_records = []
        month_records.append(r)
    
    if month_records:
        m_correct = sum(1 for mr in month_records if mr.was_correct)
        trend.append({
            "month": current_month,
            "total": len(month_records),
            "accuracy": m_correct / len(month_records),
            "avg_confidence": sum(mr.confidence for mr in month_records) / len(month_records),
            "avg_brier": sum(mr.brier_score for mr in month_records) / len(month_records),
        })
    
    return CalibrationSummary(
        total_predictions=total,
        average_confidence=avg_confidence,
        accuracy=correct / total,
        average_brier_score=avg_brier,
        calibration_by_confidence=calibration_by_confidence,
        calibration_by_domain={},  # Would need domain tagging
        trend=trend,
    )


def calculate_brier_score(confidence: int, was_correct: bool) -> float:
    """Brier score for binary outcome: (confidence - outcome)^2"""
    p = confidence / 100.0
    o = 1.0 if was_correct else 0.0
    return (p - o) ** 2


@router.post("/calibration/record")
async def record_calibration(
    journal_entry_id: uuid.UUID,
    predicted_outcome: str,
    confidence: int,
    actual_outcome: str,
    was_correct: bool,
    session: AsyncSession = Depends(get_session),
):
    user = await get_demo_user(session)
    
    brier = calculate_brier_score(confidence, was_correct)
    
    record = CalibrationRecord(
        user_id=user.id,
        journal_entry_id=journal_entry_id,
        predicted_outcome=predicted_outcome,
        confidence=confidence,
        actual_outcome=actual_outcome,
        was_correct=was_correct,
        brier_score=brier,
    )
    session.add(record)
    
    # Update progress
    result = await session.execute(
        select(UserProgress).where(UserProgress.user_id == user.id)
    )
    progress = result.scalar_one_or_none()
    if not progress:
        progress = UserProgress(user_id=user.id)
        session.add(progress)
    
    # Update streak
    today = datetime.utcnow().date()
    if progress.last_activity_date:
        last_date = progress.last_activity_date.date()
        if today == last_date + timedelta(days=1):
            progress.current_streak_days += 1
        elif today > last_date + timedelta(days=1):
            progress.current_streak_days = 1
    else:
        progress.current_streak_days = 1
    
    progress.longest_streak_days = max(progress.longest_streak_days, progress.current_streak_days)
    progress.last_activity_date = datetime.utcnow()
    
    await session.flush()
    return {"status": "recorded", "brier_score": brier}