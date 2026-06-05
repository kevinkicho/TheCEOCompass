from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any
import json
import uuid


class FrameworkConceptRead(BaseModel):
    id: uuid.UUID
    name: str
    definition: str
    formula: Optional[str] = None
    example: Optional[str] = None
    tags: list[str] = []
    order_index: int

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            return json.loads(v)
        return v or []

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