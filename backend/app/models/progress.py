from sqlalchemy import String, DateTime, ForeignKey, Integer, Float, func, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.database import Base
from app.models.user import User
from datetime import datetime
import uuid


class UserProgress(Base):
    __tablename__ = "user_progress"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True)
    
    # Scenario progress
    scenarios_completed: Mapped[int] = mapped_column(Integer, default=0)
    scenarios_in_progress: Mapped[int] = mapped_column(Integer, default=0)
    total_scenario_score: Mapped[float] = mapped_column(Float, default=0.0)
    average_scenario_score: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Framework mastery
    framework_mastery: Mapped[str] = mapped_column(Text, default="{}")  # JSON: framework_id -> mastery_score
    
    # Streaks
    current_streak_days: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_activity_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Learning pathway
    current_module_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("frameworks.id"), nullable=True)
    modules_completed: Mapped[str] = mapped_column(Text, default="[]")  # JSON array
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user: Mapped[User] = relationship(back_populates="progress")


class CalibrationRecord(Base):
    __tablename__ = "calibration_records"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    journal_entry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("journal_entries.id"), nullable=False)
    
    predicted_outcome: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[int] = mapped_column(Integer, nullable=False)
    actual_outcome: Mapped[str] = mapped_column(Text, nullable=False)
    was_correct: Mapped[bool] = mapped_column(nullable=False)
    brier_score: Mapped[float] = mapped_column(Float, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user: Mapped[User] = relationship(back_populates="calibration_records")


# Indexes for common queries
Index("ix_calibration_user_date", CalibrationRecord.user_id, CalibrationRecord.created_at)
Index("ix_progress_user", UserProgress.user_id)