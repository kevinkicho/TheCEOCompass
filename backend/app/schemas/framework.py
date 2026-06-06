from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any
import json
import uuid


class ConceptStep(BaseModel):
    title: str
    description: str


class ConceptPitfall(BaseModel):
    title: str
    description: str


class RelatedConcept(BaseModel):
    name: str
    relationship: str


class CaseStudy(BaseModel):
    company: str
    situation: str
    application: str
    result: str


class ConceptExercise(BaseModel):
    scenario: str
    options: list[str]
    correct: int
    explanation: str


class FrameworkConceptRead(BaseModel):
    id: uuid.UUID
    name: str
    definition: str
    formula: Optional[str] = None
    example: Optional[str] = None
    tags: list[str] = []
    order_index: int = 0
    why_it_matters: Optional[str] = None
    steps: Optional[list[ConceptStep]] = None
    pitfalls: Optional[list[ConceptPitfall]] = None
    related_concepts: Optional[list[RelatedConcept]] = None
    case_study: Optional[CaseStudy] = None
    exercise: Optional[ConceptExercise] = None

    @field_validator("tags", "steps", "pitfalls", "related_concepts", mode="before")
    @classmethod
    def parse_json_lists(cls, v: Any) -> Any:
        if isinstance(v, str):
            return json.loads(v)
        return v or []
    
    @field_validator("case_study", "exercise", mode="before")
    @classmethod
    def parse_json_objects(cls, v: Any) -> Any:
        if isinstance(v, str):
            return json.loads(v)
        return v

    class Config:
        from_attributes = True


class FrameworkRead(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str
    category: str
    difficulty: int
    estimated_time_minutes: int
    prerequisites: list[str] = []
    key_concepts: list[str] = []
    use_cases: list[str] = []
    related_frameworks: list[str] = []
    concepts: list[FrameworkConceptRead] = []

    @field_validator("prerequisites", "key_concepts", "use_cases", "related_frameworks", mode="before")
    @classmethod
    def parse_json_list(cls, v: Any) -> list:
        if isinstance(v, str):
            return json.loads(v)
        return v or []

    class Config:
        from_attributes = True


class FrameworkListItem(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str
    category: str
    difficulty: int
    estimated_time_minutes: int

    class Config:
        from_attributes = True