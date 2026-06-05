import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_root_endpoint():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        assert "message" in response.json()


@pytest.mark.asyncio
async def test_list_frameworks():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/frameworks")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_list_frameworks_by_category():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/frameworks?category=decision-making")
        assert response.status_code == 200
        frameworks = response.json()
        for fw in frameworks:
            assert fw["category"] == "decision-making"


@pytest.mark.asyncio
async def test_search_frameworks():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/search?q=decision")
        assert response.status_code == 200
        results = response.json()
        assert len(results) > 0


@pytest.mark.asyncio
async def test_list_scenarios():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/scenarios")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_journal_crud():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create
        entry_data = {
            "title": "Test Decision",
            "context": "Test context",
            "decision": "Do X",
            "rationale": "Because Y",
            "confidence": 8,
            "review_date": "2025-12-31T00:00:00Z",
        }
        response = await client.post("/api/journal", json=entry_data)
        assert response.status_code == 201
        entry_id = response.json()["id"]
        
        # Read
        response = await client.get(f"/api/journal/{entry_id}")
        assert response.status_code == 200
        assert response.json()["title"] == "Test Decision"
        
        # List
        response = await client.get("/api/journal")
        assert response.status_code == 200
        entries = response.json()
        assert len(entries) >= 1
        
        # Update
        response = await client.patch(f"/api/journal/{entry_id}", json={"title": "Updated Decision"})
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_progress_endpoint():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/progress")
        assert response.status_code == 200
        data = response.json()
        assert "scenarios_completed" in data
        assert "current_streak_days" in data


@pytest.mark.asyncio
async def test_calibration_endpoint():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/progress/calibration")
        assert response.status_code == 200
        data = response.json()
        assert "total_predictions" in data
        assert "accuracy" in data