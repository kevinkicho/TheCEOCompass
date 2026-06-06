import pytest
from app.schemas.scenario import ScenarioStage, ScenarioRead, ScenarioAttemptRead, ScenarioEvaluateRequest, ScenarioEvaluateResponse
from app.schemas.quiz import QuizGenerateRequest, QuizQuestionRead, QuizEvaluateRequest, QuizEvaluateResponse
from app.schemas.journal import JournalEntryCreate, JournalEntryRead, JournalOutcomeCreate
from app.schemas.progress import ProgressRead, CalibrationSummary
from datetime import datetime
import uuid


class TestScenarioSchemas:
    def test_scenario_stage_validation(self):
        stage = ScenarioStage(
            id="stage-1",
            type="diagnosis",
            prompt="Choose a framework",
            options=[{"id": "a", "label": "Porter", "score": 0.9, "rationale": "Best"}],
            free_response=False,
            feedback_prompt_template="User chose {option}",
        )
        assert stage.type == "diagnosis"
        assert len(stage.options) == 1

    def test_scenario_stage_with_sample_answer(self):
        stage = ScenarioStage(
            id="stage-2",
            type="analysis",
            prompt="Analyze",
            free_response=True,
            feedback_prompt_template="feedback template",
            sample_answer="Expected answer here",
        )
        assert stage.sample_answer == "Expected answer here"

    def test_scenario_read_validation(self):
        scenario = ScenarioRead(
            id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            slug="test-scenario",
            title="Test",
            description="Test scenario",
            framework_id="11111111-1111-1111-1111-111111111111",
            difficulty=2,
            context={"company": "TestCo", "situation": "Test", "time_pressure": "None", "data_provided": []},
            stages=[],
            outcome_branches={"optimal": {"title": "Win", "description": "Success"}},
        )
        assert scenario.slug == "test-scenario"

    def test_scenario_attempt_read_parses_choices(self):
        data = {
            "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "user_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "scenario_id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
            "current_stage_id": "stage-1",
            "choices_made": '{"stage-1": {"choice_id": "a"}}',
            "created_at": datetime.utcnow(),
        }
        attempt = ScenarioAttemptRead(**data)
        assert isinstance(attempt.choices_made, dict)

    def test_evaluate_request_validation(self):
        req = ScenarioEvaluateRequest(stage_id="stage-1", choice_id="a")
        assert req.choice_id == "a"

    def test_evaluate_response_structure(self):
        resp = ScenarioEvaluateResponse(
            next_stage_id="stage-2",
            feedback={"feedback": "Good", "score": 0.9, "key_insights": ["insight"]},
            is_complete=False,
        )
        assert resp.next_stage_id == "stage-2"


class TestQuizSchemas:
    def test_quiz_generate_request(self):
        req = QuizGenerateRequest(
            framework_id="11111111-1111-1111-1111-111111111111",
            num_questions=5,
            difficulty="medium",
        )
        assert req.num_questions == 5

    def test_quiz_question_read(self):
        q = QuizQuestionRead(
            id="q1",
            question="Test question?",
            type="multiple_choice",
            options=["A", "B", "C", "D"],
            correct_answer="A",
            explanation="Because A is right",
            framework_concept="Test Concept",
        )
        assert len(q.options) == 4

    def test_quiz_evaluate_request(self):
        req = QuizEvaluateRequest(
            question_id="q1",
            user_answer="B",
            correct_answer="A",
        )
        assert req.correct_answer == "A"

    def test_quiz_evaluate_response(self):
        resp = QuizEvaluateResponse(
            is_correct=False,
            score=0.0,
            explanation="Wrong!",
            correct_answer="A",
        )
        assert resp.is_correct is False


class TestJournalSchemas:
    def test_journal_entry_create(self):
        entry = JournalEntryCreate(
            title="Test Decision",
            context="Test context",
            decision="Do X",
            rationale="Because Y",
            confidence=8,
            review_date=datetime(2025, 12, 31),
        )
        assert entry.confidence == 8

    def test_journal_entry_read_parses_fields(self):
        data = {
            "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "user_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "title": "Test",
            "context": "ctx",
            "decision": "do X",
            "rationale": "why",
            "confidence": 8,
            "review_date": datetime(2025, 12, 31),
            "outcome_captured": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "alternatives_considered": '[]',
            "key_assumptions": '[]',
            "success_metrics": '[]',
        }
        entry = JournalEntryRead(**data)
        assert entry.alternatives_considered == []

    def test_journal_outcome_create(self):
        outcome = JournalOutcomeCreate(
            what_happened="It worked",
            was_right="yes",
            updated_confidence=9,
            lesson="Trust my instincts",
        )
        assert outcome.was_right == "yes"


class TestProgressSchemas:
    def test_progress_read_parses_json(self):
        data = {
            "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "scenarios_completed": 5,
            "scenarios_in_progress": 2,
            "total_scenario_score": 4.5,
            "average_scenario_score": 0.85,
            "framework_mastery": '{"11111111-1111-1111-1111-111111111111": 0.75}',
            "current_streak_days": 3,
            "longest_streak_days": 7,
            "modules_completed": '["11111111-1111-1111-1111-111111111111"]',
        }
        p = ProgressRead(**data)
        assert isinstance(p.framework_mastery, dict)
        assert isinstance(p.modules_completed, list)

    def test_calibration_summary(self):
        summary = CalibrationSummary(
            total_predictions=10,
            average_confidence=0.75,
            accuracy=0.7,
            average_brier_score=0.15,
            calibration_by_confidence={},
            calibration_by_domain={},
            trend=[],
        )
        assert summary.total_predictions == 10