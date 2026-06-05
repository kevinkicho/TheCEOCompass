import pytest
from unittest.mock import AsyncMock, patch
from app.services.llm_service import LLMService, LLMFeedback


@pytest.fixture
def llm_service():
    return LLMService()


def test_parse_feedback_valid_json(llm_service):
    response = '{"feedback": "Great work", "score": 0.85, "next_framework_suggestion": "Financial Mastery", "key_insights": ["Good analysis", "Consider risk"]}'
    result = llm_service._parse_feedback(response)
    
    assert isinstance(result, LLMFeedback)
    assert result.feedback == "Great work"
    assert result.score == 0.85
    assert result.next_framework_suggestion == "Financial Mastery"
    assert len(result.key_insights) == 2


def test_parse_feedback_invalid_json(llm_service):
    response = "not json"
    result = llm_service._parse_feedback(response)
    
    assert isinstance(result, LLMFeedback)
    assert result.feedback == "Feedback parsing error."
    assert result.score == 0.5


def test_parse_feedback_missing_fields(llm_service):
    response = '{"feedback": "Good"}'
    result = llm_service._parse_feedback(response)
    
    assert result.feedback == "Good"
    assert result.score == 0.5  # default
    assert result.key_insights == []


def test_mock_feedback_is_valid(llm_service):
    result = llm_service._mock_feedback("analysis", "test response")
    
    assert isinstance(result, LLMFeedback)
    assert len(result.feedback) > 0
    assert 0 <= result.score <= 1
    assert result.next_framework_suggestion is not None
    assert len(result.key_insights) > 0


def test_mock_scenario_is_valid(llm_service):
    result = llm_service._mock_scenario("Financial Mastery", 3)
    
    assert "title" in result
    assert "stages" in result
    assert len(result["stages"]) > 0
    assert result["difficulty"] == 3


def test_mock_questions_count(llm_service):
    result = llm_service._mock_questions("Test Framework", 5)
    
    assert len(result) == 5
    for q in result:
        assert "id" in q
        assert "question" in q
        assert "options" in q
        assert "correct_answer" in q


def test_llm_service_evaluate_no_api(llm_service):
    """When no API key is set, should fall back to mock feedback"""
    import asyncio
    result = asyncio.run(llm_service.evaluate_scenario_response(
        stage_context="Test context",
        stage_type="analysis",
        user_response="Test response",
    ))
    
    assert isinstance(result, LLMFeedback)
    assert 0 <= result.score <= 1