from sqlalchemy import String, Text, ForeignKey, Integer, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.database import Base
from datetime import datetime
import uuid


class Framework(Base):
    __tablename__ = "frameworks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)  # decision-making, financial, etc.
    difficulty: Mapped[int] = mapped_column(Integer, default=1)  # 1-5
    estimated_time_minutes: Mapped[int] = mapped_column(Integer, default=30)
    prerequisites: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of framework IDs
    content: Mapped[str] = mapped_column(Text, nullable=False)  # Full markdown content
    key_concepts: Mapped[str] = mapped_column(Text, default="[]")  # JSON array
    use_cases: Mapped[str] = mapped_column(Text, default="[]")  # JSON array
    related_frameworks: Mapped[str] = mapped_column(Text, default="[]")  # JSON array
    is_published: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    scenarios: Mapped[list["Scenario"]] = relationship(back_populates="framework")
    concepts: Mapped[list["FrameworkConcept"]] = relationship(back_populates="framework", cascade="all, delete-orphan")


class FrameworkConcept(Base):
    __tablename__ = "framework_concepts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    framework_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("frameworks.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    definition: Mapped[str] = mapped_column(Text, nullable=False)
    formula: Mapped[str | None] = mapped_column(Text, nullable=True)
    example: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str] = mapped_column(Text, default="[]")
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    why_it_matters: Mapped[str | None] = mapped_column(Text, nullable=True)
    steps: Mapped[str | None] = mapped_column(Text, default="[]")
    pitfalls: Mapped[str | None] = mapped_column(Text, default="[]")
    related_concepts: Mapped[str | None] = mapped_column(Text, default="[]")
    case_study: Mapped[str | None] = mapped_column(Text, nullable=True)
    exercise: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    framework: Mapped[Framework] = relationship(back_populates="concepts")