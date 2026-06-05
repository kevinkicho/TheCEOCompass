from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, Float, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.database import Base
from app.models.user import User
from datetime import datetime
import uuid


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    scenario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("scenarios.id"), nullable=True)
    
    # Decision details
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    context: Mapped[str] = mapped_column(Text, nullable=False)
    decision: Mapped[str] = mapped_column(Text, nullable=False)
    alternatives_considered: Mapped[str] = mapped_column(Text, default="[]")  # JSON
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    key_assumptions: Mapped[str] = mapped_column(Text, default="[]")  # JSON
    success_metrics: Mapped[str] = mapped_column(Text, default="[]")  # JSON
    confidence: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-10
    
    # Review
    review_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    # Outcome (filled later)
    outcome_captured: Mapped[bool] = mapped_column(default=False)
    outcome_captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user: Mapped[User] = relationship(back_populates="journal_entries")
    scenario: Mapped["Scenario"] = relationship()
    outcomes: Mapped[list["JournalOutcome"]] = relationship(back_populates="entry", cascade="all, delete-orphan")


class JournalOutcome(Base):
    __tablename__ = "journal_outcomes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    entry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("journal_entries.id"), nullable=False)
    
    what_happened: Mapped[str] = mapped_column(Text, nullable=False)
    was_right: Mapped[str] = mapped_column(String(20), nullable=False)  # "yes", "partially", "no"
    metrics_actual: Mapped[str] = mapped_column(Text, default="[]")  # JSON
    what_missed: Mapped[str] = mapped_column(Text, default="")
    what_got_right: Mapped[str] = mapped_column(Text, default="")
    updated_confidence: Mapped[int] = mapped_column(Integer, nullable=False)
    lesson: Mapped[str] = mapped_column(Text, default="")
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    entry: Mapped[JournalEntry] = relationship(back_populates="outcomes")