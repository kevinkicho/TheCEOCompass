import json
import uuid
from app.services.scenario_service import ScenarioEngine


def mock_scenario():
    return type("Scenario", (), {
        "id": uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        "title": "Test Scenario",
        "description": "A test scenario",
        "framework_id": uuid.UUID("11111111-1111-1111-1111-111111111111"),
        "difficulty": 2,
        "context": '{"company": "Test co", "situation": "Test situation", "time_pressure": "None", "data_provided": []}',
        "stages": json.dumps([
            {
                "id": "stage-1",
                "type": "diagnosis",
                "prompt": "Choose a framework",
                "options": [
                    {"id": "a", "label": "Good choice", "score": 0.9, "rationale": "Best"},
                    {"id": "b", "label": "OK choice", "score": 0.5, "rationale": "OK"},
                ],
                "feedback_prompt_template": "User chose {option}"
            },
            {
                "id": "stage-2",
                "type": "analysis",
                "prompt": "Analyze the situation",
                "options": [],
                "free_response": True,
                "feedback_prompt_template": "User answered: {response}"
            },
            {
                "id": "stage-3",
                "type": "decision",
                "prompt": "Decide",
                "options": [
                    {"id": "a", "label": "Yes", "score": 0.9, "rationale": "Good"},
                    {"id": "b", "label": "No", "score": 0.2, "rationale": "Bad"},
                ],
                "feedback_prompt_template": "User chose {option}"
            }
        ]),
        "outcome_branches": json.dumps({
            "optimal": {"title": "Great", "description": "Optimal"},
            "acceptable": {"title": "OK", "description": "Acceptable"},
            "failure": {"title": "Bad", "description": "Failure"},
        }),
    })


def test_scenario_engine_initialization():
    scenario = mock_scenario()
    engine = ScenarioEngine(scenario)
    assert len(engine.stages) == 3
    assert engine.stages[0]["id"] == "stage-1"


def test_evaluate_stage_1_optimal_choice():
    scenario = mock_scenario()
    engine = ScenarioEngine(scenario)
    result = engine.evaluate_stage("stage-1", "a", None)
    
    # Should advance to next stage
    assert result.next_stage_id == "stage-2"
    assert result.is_complete is False
    assert result.feedback is not None
    assert result.feedback["score"] == 0.9


def test_evaluate_stage_1_suboptimal_choice():
    scenario = mock_scenario()
    engine = ScenarioEngine(scenario)
    result = engine.evaluate_stage("stage-1", "b", None)
    
    assert result.next_stage_id == "stage-2"
    assert result.feedback["score"] == 0.5


def test_evaluate_stage_2_free_response():
    scenario = mock_scenario()
    engine = ScenarioEngine(scenario)
    result = engine.evaluate_stage("stage-2", None, "Here is my analysis")
    
    assert result.next_stage_id == "stage-3"
    assert result.feedback is not None


def test_evaluate_final_stage():
    scenario = mock_scenario()
    engine = ScenarioEngine(scenario)
    
    # Simulate optimal path
    engine.evaluate_stage("stage-1", "a", None)
    engine.evaluate_stage("stage-2", None, "analysis")
    result = engine.evaluate_stage("stage-3", "a", None)
    
    assert result.is_complete is True
    assert result.outcome_branch == "optimal"
    assert result.final_score is not None


def test_evaluate_final_stage_failure():
    scenario = mock_scenario()
    engine = ScenarioEngine(scenario)
    
    # Simulate failure path
    engine.evaluate_stage("stage-1", "b", None)
    engine.evaluate_stage("stage-2", None, "bad analysis")
    result = engine.evaluate_stage("stage-3", "b", None)
    
    assert result.is_complete is True
    assert result.outcome_branch == "failure"


def test_determine_outcome():
    scenario = mock_scenario()
    engine = ScenarioEngine(scenario)
    
    assert engine._determine_outcome(0.9) == "optimal"
    assert engine._determine_outcome(0.7) == "acceptable"
    assert engine._determine_outcome(0.3) == "failure"


def test_evaluate_stage_invalid_id():
    scenario = mock_scenario()
    engine = ScenarioEngine(scenario)
    
    try:
        engine.evaluate_stage("nonexistent", "a", None)
        assert False, "Should have raised ValueError"
    except ValueError:
        assert True