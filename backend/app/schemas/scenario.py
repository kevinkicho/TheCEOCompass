from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal, Any
from datetime import datetime
import uuid
import json


class ScenarioOption(BaseModel):
    id: str
    label: str
    score: float
    rationale: str


class ScenarioStage(BaseModel):
    id: str
    type: Literal["diagnosis", "analysis", "decision", "communication", "outcome"]
    prompt: str
    options: list[ScenarioOption] = []
    free_response: bool = False
    feedback_prompt_template: str
    sample_answer: Optional[str] = None


class OutcomeBranch(BaseModel):
    title: str
    description: str


class ScenarioContext(BaseModel):
    company: str
    situation: str
    time_pressure: str
    data_provided: list[str]


class ScenarioRead(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str
    framework_id: uuid.UUID
    difficulty: int
    context: ScenarioContext
    stages: list[ScenarioStage]
    outcome_branches: dict[str, OutcomeBranch]

    class Config:
        from_attributes = True


class ScenarioListItem(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str
    framework_id: uuid.UUID
    difficulty: int

    class Config:
        from_attributes = True


class ScenarioAttemptRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    scenario_id: uuid.UUID
    current_stage_id: str
    choices_made: dict
    score: Optional[float] = None
    outcome_branch: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    @field_validator("choices_made", mode="before")
    @classmethod
    def parse_choices(cls, v: Any) -> dict:
        if isinstance(v, str):
            return json.loads(v)
        return v or {}

    class Config:
        from_attributes = True


class ScenarioEvaluateRequest(BaseModel):
    stage_id: str
    choice_id: Optional[str] = None
    free_response: Optional[str] = None


class FeedbackResponse(BaseModel):
    feedback: str
    score: float
    next_framework_suggestion: Optional[str] = None
    key_insights: list[str] = []


class ScenarioEvaluateResponse(BaseModel):
    next_stage_id: Optional[str] = None
    feedback: Optional[FeedbackResponse] = None
    is_complete: bool = False
    outcome_branch: Optional[str] = None
    final_score: Optional[float] = None