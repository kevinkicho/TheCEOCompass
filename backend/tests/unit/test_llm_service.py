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
    assert result.score == 0.5
    assert result.key_insights == []


def test_llm_service_evaluate_no_api():
    """When no API key is set, should raise RuntimeError"""
    import asyncio
    from unittest.mock import patch
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.openai_api_key = None
        mock_settings.anthropic_api_key = None
        mock_settings.llm_provider = "openai"
        mock_settings.llm_model = "gpt-4o"
        from app.services.llm_service import LLMService
        svc = LLMService()
        with pytest.raises(RuntimeError, match="No LLM API key configured"):
            asyncio.run(svc.evaluate_scenario_response(
                stage_context="Test context",
                stage_type="analysis",
                user_response="Test response",
            ))
