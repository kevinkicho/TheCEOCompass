from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import uuid
import json

from app.models.database import get_session
from app.models.framework import Framework
from app.schemas.quiz import QuizGenerateRequest, QuizQuestionRead, QuizEvaluateRequest, QuizEvaluateResponse
from app.services.llm_service import LLMService

router = APIRouter()


@router.post("/generate", response_model=List[QuizQuestionRead])
async def generate_quiz(
    request: QuizGenerateRequest,
    session: AsyncSession = Depends(get_session),
    x_ollama_url: Optional[str] = Header(None),
    x_ollama_model: Optional[str] = Header(None),
):
    result = await session.execute(
        select(Framework).where(Framework.id == request.framework_id)
    )
    framework = result.scalar_one_or_none()
    if not framework:
        raise HTTPException(status_code=404, detail="Framework not found")

    svc = LLMService(
        ollama_url=x_ollama_url or "",
        ollama_model=x_ollama_model or "",
    )
    concepts = json.loads(framework.key_concepts) if framework.key_concepts else []
    questions = await svc.generate_quiz_questions(
        framework_name=framework.title,
        framework_concepts=concepts,
        num_questions=request.num_questions,
        difficulty=request.difficulty,
    )
    return questions


@router.post("/evaluate", response_model=QuizEvaluateResponse)
async def evaluate_answer(
    request: QuizEvaluateRequest,
):
    is_correct = request.user_answer.strip().lower() == request.correct_answer.strip().lower()
    
    return QuizEvaluateResponse(
        is_correct=is_correct,
        score=1.0 if is_correct else 0.0,
        explanation=f"The correct answer is: {request.correct_answer}" if not is_correct else "Correct!",
        correct_answer=request.correct_answer,
    )