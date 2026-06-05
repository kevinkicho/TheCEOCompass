from pydantic import BaseModel, Field
from typing import Literal
import uuid


class QuizGenerateRequest(BaseModel):
    framework_id: uuid.UUID
    num_questions: int = Field(default=5, ge=1, le=20)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    question_types: list[Literal["fact", "application", "calculation"]] = ["fact", "application"]


class QuizQuestion(BaseModel):
    id: str
    question: str
    type: Literal["multiple_choice", "free_response", "calculation"]
    options: list[str] = []
    correct_answer: str
    explanation: str
    framework_concept: str


class QuizQuestionRead(BaseModel):
    id: str
    question: str
    type: Literal["multiple_choice", "free_response", "calculation"]
    options: list[str] = []
    correct_answer: str = ""
    explanation: str = ""
    framework_concept: str


class QuizEvaluateRequest(BaseModel):
    question_id: str
    user_answer: str
    correct_answer: str


class QuizEvaluateResponse(BaseModel):
    is_correct: bool
    score: float
    explanation: str
    correct_answer: str