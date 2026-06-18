import json
import uuid
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.database import async_session_maker, init_db
from app.models.framework import Framework, FrameworkConcept
from app.models.scenario import Scenario
from app.models.user import User


DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"


async def seed_default_user(session: AsyncSession):
    result = await session.execute(select(User).where(User.id == uuid.UUID(DEFAULT_USER_ID)))
    if not result.scalar_one_or_none():
        user = User(
            id=uuid.UUID(DEFAULT_USER_ID),
            email="admin@ceocompass.local",
            hashed_password="changeme",
        )
        session.add(user)
        await session.flush()
        print("Seeded default user")


async def seed_frameworks(session: AsyncSession):
    seed_path = Path(__file__).parent / "frameworks.json"
    with open(seed_path) as f:
        frameworks_data = json.load(f)

    for fw_data in frameworks_data:
        result = await session.execute(
            select(Framework).where(Framework.id == uuid.UUID(fw_data["id"]))
        )
        if result.scalar_one_or_none():
            continue

        concepts_data = fw_data.pop("concepts", [])

        framework = Framework(
            id=uuid.UUID(fw_data["id"]),
            slug=fw_data["slug"],
            title=fw_data["title"],
            description=fw_data["description"],
            category=fw_data["category"],
            difficulty=fw_data["difficulty"],
            estimated_time_minutes=fw_data["estimated_time_minutes"],
            prerequisites=json.dumps(fw_data["prerequisites"]),
            key_concepts=json.dumps(fw_data["key_concepts"]),
            use_cases=json.dumps(fw_data["use_cases"]),
            related_frameworks=json.dumps(fw_data["related_frameworks"]),
            content=fw_data["content"],
        )
        session.add(framework)
        await session.flush()

        for i, concept_data in enumerate(concepts_data):
            concept = FrameworkConcept(
                id=uuid.uuid4(),
                framework_id=framework.id,
                name=concept_data["name"],
                definition=concept_data["definition"],
                formula=concept_data.get("formula"),
                example=concept_data.get("example"),
                tags=json.dumps(concept_data.get("tags", [])),
                order_index=concept_data.get("order_index", i),
                why_it_matters=concept_data.get("why_it_matters"),
                steps=json.dumps(concept_data.get("steps", [])),
                pitfalls=json.dumps(concept_data.get("pitfalls", [])),
                related_concepts=json.dumps(concept_data.get("related_concepts", [])),
                case_study=json.dumps(concept_data.get("case_study")) if concept_data.get("case_study") else None,
                exercise=json.dumps(concept_data.get("exercise")) if concept_data.get("exercise") else None,
            )
            session.add(concept)

    await session.commit()
    print(f"Seeded {len(frameworks_data)} frameworks")


async def seed_scenarios(session: AsyncSession):
    seed_path = Path(__file__).parent / "scenarios.json"
    with open(seed_path) as f:
        scenarios_data = json.load(f)

    for sc_data in scenarios_data:
        result = await session.execute(
            select(Scenario).where(Scenario.id == uuid.UUID(sc_data["id"]))
        )
        if result.scalar_one_or_none():
            continue

        scenario = Scenario(
            id=uuid.UUID(sc_data["id"]),
            slug=sc_data["slug"],
            title=sc_data["title"],
            description=sc_data["description"],
            framework_id=uuid.UUID(sc_data["framework_id"]),
            difficulty=sc_data["difficulty"],
            context=json.dumps(sc_data["context"]),
            stages=json.dumps(sc_data["stages"]),
            outcome_branches=json.dumps(sc_data["outcome_branches"]),
        )
        session.add(scenario)

    await session.commit()
    print(f"Seeded {len(scenarios_data)} scenarios")


async def main():
    await init_db()
    async with async_session_maker() as session:
        await seed_default_user(session)
        await seed_frameworks(session)
        await seed_scenarios(session)
    print("Seeding complete!")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
