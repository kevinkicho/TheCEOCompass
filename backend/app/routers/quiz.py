from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid
import json
import random
from pathlib import Path

from app.models.database import get_session
from app.models.framework import Framework
from app.schemas.quiz import QuizGenerateRequest, QuizQuestionRead, QuizEvaluateRequest, QuizEvaluateResponse
from app.services.llm_service import llm_service

router = APIRouter()

# Load curated quiz questions from seed file
_quiz_seed_path = Path(__file__).parent.parent.parent / "seed" / "quiz_questions.json"
with open(_quiz_seed_path) as f:
    _quiz_seed = json.load(f)


@router.post("/generate", response_model=List[QuizQuestionRead])
async def generate_quiz(
    request: QuizGenerateRequest,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Framework).where(Framework.id == request.framework_id)
    )
    framework = result.scalar_one_or_none()
    if not framework:
        raise HTTPException(status_code=404, detail="Framework not found")
    
    seed_questions = _quiz_seed.get(framework.slug, [])
    
    if seed_questions:
        # Shuffle and pick the requested number
        available = seed_questions.copy()
        random.shuffle(available)
        selected = available[:request.num_questions]
        return [
            {"id": f"q{i+1}", "type": "multiple_choice", **q} for i, q in enumerate(selected)
        ]
    
    # Fallback to LLM if no seed questions for this framework
    concepts = json.loads(framework.key_concepts) if framework.key_concepts else []
    questions = await llm_service.generate_quiz_questions(
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