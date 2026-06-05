from pydantic import BaseModel, field_validator, ValidationInfo
from typing import Optional, Any
from datetime import datetime
import uuid
import json


class ProgressRead(BaseModel):
    user_id: uuid.UUID
    scenarios_completed: int
    scenarios_in_progress: int
    total_scenario_score: float
    average_scenario_score: float
    framework_mastery: dict[str, float]
    current_streak_days: int
    longest_streak_days: int
    last_activity_date: Optional[datetime] = None
    current_module_id: Optional[uuid.UUID] = None
    modules_completed: list[uuid.UUID] = []

    @field_validator("framework_mastery", "modules_completed", mode="before")
    @classmethod
    def parse_json_field(cls, v: Any, info: ValidationInfo) -> Any:
        if isinstance(v, str):
            return json.loads(v)
        field_is_dict = info.field_name == "framework_mastery"
        if not v:
            return {} if field_is_dict else []
        if info.field_name == "framework_mastery" and not isinstance(v, dict):
            return {}
        if info.field_name == "modules_completed" and not isinstance(v, list):
            return []
        return v

    class Config:
        from_attributes = True


class CalibrationRecordRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    journal_entry_id: uuid.UUID
    predicted_outcome: str
    confidence: int
    actual_outcome: str
    was_correct: bool
    brier_score: float
    created_at: datetime

    class Config:
        from_attributes = True


class CalibrationSummary(BaseModel):
    total_predictions: int
    average_confidence: float
    accuracy: float
    average_brier_score: float
    calibration_by_confidence: dict[str, dict]
    calibration_by_domain: dict[str, dict]
    trend: list[dict]

    class Config:
        from_attributes = True