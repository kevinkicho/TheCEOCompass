import pytest


def test_app_imports():
    """Verify the FastAPI app imports without errors"""
    from app.main import app
    assert app is not None
    assert app.title == "CEO Knowledge Platform API"


def test_config_loads():
    """Verify config loads with defaults"""
    from app.config import settings
    assert settings.database_url is not None
    assert settings.api_prefix == "/api"
    assert settings.environment == "test"


def test_routers_registered():
    """Verify all routers are registered"""
    from app.main import app
    routes = [r.path for r in app.routes if hasattr(r, 'path')]
    assert any("/api/frameworks" in r for r in routes)
    assert any("/api/scenarios" in r for r in routes)
    assert any("/api/quiz" in r for r in routes)
    assert any("/api/journal" in r for r in routes)
    assert any("/api/progress" in r for r in routes)
    assert any("/api/search" in r for r in routes)


def test_models_import():
    """Verify all ORM models import cleanly"""
    from app.models import (
        framework as fw,
        scenario as sc,
        journal as jn,
        progress as pg,
        user as us,
        database as db,
    )
    assert fw.Framework is not None
    assert sc.Scenario is not None
    assert jn.JournalEntry is not None
    assert pg.UserProgress is not None
    assert us.User is not None


def test_schemas_import():
    """Verify all Pydantic schemas import"""
    from app.schemas import (
        FrameworkRead,
        ScenarioRead,
        QuizEvaluateRequest,
        JournalEntryCreate,
        ProgressRead,
    )
    assert FrameworkRead is not None
    assert ScenarioRead is not None
    assert QuizEvaluateRequest is not None
    assert JournalEntryCreate is not None
    assert ProgressRead is not None