import pytest
from unittest.mock import AsyncMock
from app.routers.frameworks import router
from app.schemas.framework import FrameworkRead, FrameworkListItem, FrameworkConceptRead


def test_framework_list_item_schema():
    """FrameworkListItem validates correctly"""
    data = {
        "id": "11111111-1111-1111-1111-111111111111",
        "slug": "test-framework",
        "title": "Test Framework",
        "description": "A test framework",
        "category": "test",
        "difficulty": 2,
        "estimated_time_minutes": 30,
    }
    item = FrameworkListItem(**data)
    assert item.slug == "test-framework"
    assert item.title == "Test Framework"


def test_framework_read_schema_with_concepts():
    """FrameworkRead handles concepts and JSON fields"""
    data = {
        "id": "11111111-1111-1111-1111-111111111111",
        "slug": "test-framework",
        "title": "Test Framework",
        "description": "A test",
        "category": "test",
        "difficulty": 2,
        "estimated_time_minutes": 30,
        "prerequisites": [],
        "key_concepts": ["Concept A", "Concept B"],
        "use_cases": ["Use case 1"],
        "related_frameworks": [],
        "concepts": [],
    }
    fw = FrameworkRead(**data)
    assert len(fw.key_concepts) == 2


def test_framework_read_parses_json_strings():
    """JSON string fields get parsed to lists"""
    from app.schemas.framework import FrameworkRead
    data = {
        "id": "11111111-1111-1111-1111-111111111111",
        "slug": "test-framework",
        "title": "Test Framework",
        "description": "A test",
        "category": "test",
        "difficulty": 2,
        "estimated_time_minutes": 30,
        "prerequisites": '["11111111-1111-1111-1111-111111111111"]',
        "key_concepts": '["Concept A", "Concept B"]',
        "use_cases": '["Use case"]',
        "related_frameworks": '[]',
        "concepts": [],
    }
    fw = FrameworkRead(**data)
    assert isinstance(fw.key_concepts, list)
    assert fw.key_concepts == ["Concept A", "Concept B"]


def test_framework_concept_schema():
    """FrameworkConceptRead validates correctly"""
    data = {
        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "name": "Test Concept",
        "definition": "A test definition",
        "formula": "a + b = c",
        "example": "Example text",
        "tags": ["tag1", "tag2"],
        "order_index": 1,
    }
    concept = FrameworkConceptRead(**data)
    assert concept.name == "Test Concept"
    assert concept.formula == "a + b = c"


def test_framework_concept_tags_parsing():
    """Tags JSON string gets parsed"""
    data = {
        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "name": "Test",
        "definition": "Test def",
        "tags": '["a", "b"]',
        "order_index": 0,
    }
    concept = FrameworkConceptRead(**data)
    assert concept.tags == ["a", "b"]