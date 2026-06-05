from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.routers import frameworks, scenarios, quiz, journal, progress, search
from app.models.database import init_db, close_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title="CEO Knowledge Platform API",
    description="Scenario simulator and decision-making framework platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(frameworks.router, prefix=f"{settings.api_prefix}/frameworks", tags=["frameworks"])
app.include_router(scenarios.router, prefix=f"{settings.api_prefix}/scenarios", tags=["scenarios"])
app.include_router(quiz.router, prefix=f"{settings.api_prefix}/quiz", tags=["quiz"])
app.include_router(journal.router, prefix=f"{settings.api_prefix}/journal", tags=["journal"])
app.include_router(progress.router, prefix=f"{settings.api_prefix}/progress", tags=["progress"])
app.include_router(search.router, prefix=f"{settings.api_prefix}/search", tags=["search"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "environment": settings.environment}


@app.get("/")
async def root():
    return {"message": "CEO Knowledge Platform API", "docs": "/docs"}