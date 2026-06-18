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
    """Verify all routes are registered by checking the route list"""
    from app.main import app
    paths = set()
    for r in app.routes:
        p = getattr(r, 'path', None) or getattr(r, 'prefix', None)
        if p:
            paths.add(p)
        for sub in getattr(r, 'routes', []):
            sub_p = getattr(sub, 'path', None)
            if sub_p:
                paths.add(getattr(r, 'prefix', '') + sub_p)
    for prefix in ("frameworks", "scenarios", "quiz", "journal", "progress", "search"):
        assert any(f"/api/{prefix}" in p for p in paths), f"/api/{prefix} not found"


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