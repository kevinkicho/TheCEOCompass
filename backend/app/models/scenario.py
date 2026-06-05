from sqlalchemy import String, Text, Integer, ForeignKey, Float, DateTime, func, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.database import Base
from app.models.user import User
from datetime import datetime
import uuid
import enum


class ScenarioType(str, enum.Enum):
    DIAGNOSIS = "diagnosis"
    ANALYSIS = "analysis"
    DECISION = "decision"
    COMMUNICATION = "communication"
    OUTCOME = "outcome"


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    framework_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("frameworks.id"), nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, default=1)  # 1-5
    context: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string
    stages: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string
    outcome_branches: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string
    is_published: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    framework: Mapped["Framework"] = relationship(back_populates="scenarios")
    attempts: Mapped[list["ScenarioAttempt"]] = relationship(back_populates="scenario")


class ScenarioAttempt(Base):
    __tablename__ = "scenario_attempts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    scenario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenarios.id"), nullable=False)
    current_stage_id: Mapped[str] = mapped_column(String(100), nullable=False)
    choices_made: Mapped[str] = mapped_column(Text, default="{}")  # JSON string
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    outcome_branch: Mapped[str | None] = mapped_column(String(50), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user: Mapped[User] = relationship(back_populates="scenario_attempts")
    scenario: Mapped[Scenario] = relationship(back_populates="attempts")