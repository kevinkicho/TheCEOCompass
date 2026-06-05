from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any
from datetime import datetime
import uuid
import json


class JournalEntryBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    context: str
    decision: str
    alternatives_considered: list[dict] = []
    rationale: str
    key_assumptions: list[dict] = []
    success_metrics: list[dict] = []
    confidence: int = Field(..., ge=1, le=10)
    review_date: datetime
    scenario_id: Optional[uuid.UUID] = None


class JournalEntryCreate(JournalEntryBase):
    pass


class JournalEntryUpdate(BaseModel):
    title: Optional[str] = None
    context: Optional[str] = None
    decision: Optional[str] = None
    alternatives_considered: Optional[list[dict]] = None
    rationale: Optional[str] = None
    key_assumptions: Optional[list[dict]] = None
    success_metrics: Optional[list[dict]] = None
    confidence: Optional[int] = Field(None, ge=1, le=10)
    review_date: Optional[datetime] = None


class JournalEntryRead(JournalEntryBase):
    id: uuid.UUID
    user_id: uuid.UUID
    outcome_captured: bool
    outcome_captured_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    outcomes: list["JournalOutcomeRead"] = []

    @field_validator("alternatives_considered", "key_assumptions", "success_metrics", mode="before")
    @classmethod
    def parse_json_list(cls, v: Any) -> list:
        if isinstance(v, str):
            return json.loads(v)
        return v or []

    class Config:
        from_attributes = True


class JournalOutcomeCreate(BaseModel):
    what_happened: str
    was_right: str
    metrics_actual: list[dict] = []
    what_missed: str = ""
    what_got_right: str = ""
    updated_confidence: int = Field(..., ge=1, le=10)
    lesson: str = ""


class JournalOutcomeRead(BaseModel):
    id: uuid.UUID
    entry_id: uuid.UUID
    what_happened: str
    was_right: str
    metrics_actual: list[dict]
    what_missed: str
    what_got_right: str
    updated_confidence: int
    lesson: str
    created_at: datetime

    @field_validator("metrics_actual", mode="before")
    @classmethod
    def parse_metrics(cls, v: Any) -> list:
        if isinstance(v, str):
            return json.loads(v)
        return v or []

    class Config:
        from_attributes = True


JournalEntryRead.model_rebuild()