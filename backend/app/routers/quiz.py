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


from pydantic import BaseModel


class ExplainRequest(BaseModel):
    concept_name: str
    definition: str
    framework_title: str


@router.post("/explain", response_model=dict)
async def explain_concept(
    request: ExplainRequest,
    x_ollama_url: Optional[str] = Header(None),
    x_ollama_model: Optional[str] = Header(None),
):
    import time
    t0 = time.time()
    print(f"[LLM] Explaining concept '{request.concept_name}' from '{request.framework_title}'")

    svc = LLMService(
        ollama_url=x_ollama_url or "",
        ollama_model=x_ollama_model or "",
    )

    prompt = f"""You are an expert CEO coach. Provide a concise, actionable explanation of this concept.

Concept: {request.concept_name}
Definition: {request.definition}
Framework: {request.framework_title}

Return a JSON object with these fields:
{{
  "real_world_example": "A brief real-world CEO example of this concept in action (2-3 sentences)",
  "ceo_insight": "Why this matters specifically to a CEO (1-2 sentences)",
  "common_mistake": "One common mistake CEOs make with this concept (1-2 sentences)",
  "related_tip": "A quick actionable tip for applying this (1 sentence)"
}}

Return ONLY valid JSON.
"""
    response = await svc._call_provider(prompt, temperature=0.4)

    import json as j
    try:
        data = j.loads(response)
        elapsed = time.time() - t0
        print(f"[LLM] Concept explanation generated in {elapsed:.1f}s")
        return data
    except Exception as e:
        print(f"[LLM] Failed to parse explanation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate explanation: {e}")
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