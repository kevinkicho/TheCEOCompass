from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid
import json

from app.models.database import get_session
from app.models.scenario import Scenario, ScenarioAttempt
from app.models.user import User
from app.schemas.scenario import ScenarioRead, ScenarioListItem, ScenarioAttemptRead, ScenarioEvaluateRequest, ScenarioEvaluateResponse, FeedbackResponse
from app.services.scenario_service import ScenarioEngine
from app.services.llm_service import LLMService

router = APIRouter()


@router.get("/slug/{slug}", response_model=ScenarioRead)
async def get_scenario_by_slug(
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Scenario).where(Scenario.slug == slug)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    scenario_dict = {
        "id": scenario.id,
        "slug": scenario.slug,
        "title": scenario.title,
        "description": scenario.description,
        "framework_id": scenario.framework_id,
        "difficulty": scenario.difficulty,
        "context": json.loads(scenario.context),
        "stages": json.loads(scenario.stages),
        "outcome_branches": json.loads(scenario.outcome_branches),
    }
    return scenario_dict


@router.get("", response_model=List[ScenarioListItem])
async def list_scenarios(
    framework_id: uuid.UUID | None = None,
    difficulty: int | None = None,
    session: AsyncSession = Depends(get_session),
):
    query = select(Scenario).where(Scenario.is_published == True)
    if framework_id:
        query = query.where(Scenario.framework_id == framework_id)
    if difficulty:
        query = query.where(Scenario.difficulty == difficulty)
    query = query.order_by(Scenario.difficulty, Scenario.title)
    result = await session.execute(query)
    scenarios = result.scalars().all()
    return scenarios


@router.get("/{scenario_id}", response_model=ScenarioRead)
async def get_scenario(
    scenario_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Scenario).where(Scenario.id == scenario_id)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # Parse JSON fields
    scenario_dict = {
        "id": scenario.id,
        "slug": scenario.slug,
        "title": scenario.title,
        "description": scenario.description,
        "framework_id": scenario.framework_id,
        "difficulty": scenario.difficulty,
        "context": json.loads(scenario.context),
        "stages": json.loads(scenario.stages),
        "outcome_branches": json.loads(scenario.outcome_branches),
    }
    return scenario_dict


@router.post("/{scenario_id}/start", response_model=ScenarioAttemptRead)
async def start_scenario(
    scenario_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    # For MVP, use a default user (no auth yet)
    result = await session.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        user = User(email="demo@ceo.local", hashed_password="demo")
        session.add(user)
        await session.flush()
    
    # Check for existing in-progress attempt
    result = await session.execute(
        select(ScenarioAttempt)
        .where(ScenarioAttempt.user_id == user.id)
        .where(ScenarioAttempt.scenario_id == scenario_id)
        .where(ScenarioAttempt.completed_at.is_(None))
    )
    attempt = result.scalar_one_or_none()
    
    if not attempt:
        # Get scenario to find first stage
        scenario_result = await session.execute(
            select(Scenario).where(Scenario.id == scenario_id)
        )
        scenario = scenario_result.scalar_one()
        stages = json.loads(scenario.stages)
        first_stage_id = stages[0]["id"] if stages else "stage-1"
        
        attempt = ScenarioAttempt(
            user_id=user.id,
            scenario_id=scenario_id,
            current_stage_id=first_stage_id,
            choices_made="{}",
        )
        session.add(attempt)
        await session.flush()
    
    return attempt


@router.post("/{scenario_id}/evaluate", response_model=ScenarioEvaluateResponse)
async def evaluate_choice(
    scenario_id: uuid.UUID,
    request: ScenarioEvaluateRequest,
    session: AsyncSession = Depends(get_session),
):
    # Get user (demo for MVP)
    result = await session.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Get attempt
    result = await session.execute(
        select(ScenarioAttempt)
        .where(ScenarioAttempt.user_id == user.id)
        .where(ScenarioAttempt.scenario_id == scenario_id)
        .where(ScenarioAttempt.completed_at.is_(None))
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="No active attempt found")
    
    # Get scenario
    result = await session.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # Run scenario engine
    engine = ScenarioEngine(scenario)
    choices_made = json.loads(attempt.choices_made) if attempt.choices_made else {}
    choices_made[request.stage_id] = {
        "choice_id": request.choice_id,
        "free_response": request.free_response,
    }
    
    result = engine.evaluate_stage(request.stage_id, request.choice_id, request.free_response)
    
    # Update attempt
    attempt.choices_made = json.dumps(choices_made)
    attempt.current_stage_id = result.next_stage_id or attempt.current_stage_id
    
    if result.is_complete:
        attempt.completed_at = engine.now()
        attempt.outcome_branch = result.outcome_branch
        attempt.score = result.final_score
    
    await session.flush()
    
    return ScenarioEvaluateResponse(
        next_stage_id=result.next_stage_id,
        feedback=result.feedback,
        is_complete=result.is_complete,
        outcome_branch=result.outcome_branch,
        final_score=result.final_score,
    )


@router.get("/{scenario_id}/attempt", response_model=ScenarioAttemptRead)
async def get_attempt(
    scenario_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    result = await session.execute(
        select(ScenarioAttempt)
        .where(ScenarioAttempt.user_id == user.id)
        .where(ScenarioAttempt.scenario_id == scenario_id)
        .order_by(ScenarioAttempt.created_at.desc())
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="No attempt found")
    
    return attempt