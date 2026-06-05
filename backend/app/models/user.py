from sqlalchemy import String, DateTime, func, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.database import Base
from datetime import datetime
import uuid


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    scenario_attempts: Mapped[list["ScenarioAttempt"]] = relationship(back_populates="user")
    journal_entries: Mapped[list["JournalEntry"]] = relationship(back_populates="user")
    progress: Mapped[list["UserProgress"]] = relationship(back_populates="user")
    calibration_records: Mapped[list["CalibrationRecord"]] = relationship(back_populates="user")