import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings, validate_environment_safety
from backend.app.core.database import engine, Base
from backend.app.api.routes import (
    auth,
    tasks,
    annotations,
    agreement,
    reconciliation,
    advisory,
    audit,
    evaluation,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("annotation-agreement-studio")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Enforce production security check: demo mode is strictly disallowed in production
    validate_environment_safety(settings)
    # Initialize database tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")
    logger.info("Annotation Agreement Studio v%s started in %s mode", settings.VERSION, settings.ENVIRONMENT)
    yield

def create_app() -> FastAPI:
    """Application factory for Annotation Agreement Studio."""
    app_instance = FastAPI(
        title="Annotation Agreement Studio",
        description="NLP inter-annotator agreement evaluation, disagreement matrix analysis, and consensus reconciliation.",
        version=settings.VERSION,
        lifespan=lifespan,
    )

    # Enable CORS for frontend clients
    app_instance.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:3000", "http://localhost:3000", "http://127.0.0.1:8080", "http://localhost:8080"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check route
    @app_instance.get("/api/health", tags=["System"])
    def health_check():
        return {
            "status": "healthy",
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "demo_mode": settings.DEMO_MODE,
        }

    # Mount API routers
    app_instance.include_router(auth.router, prefix="/api")
    app_instance.include_router(tasks.router, prefix="/api")
    app_instance.include_router(annotations.router, prefix="/api")
    app_instance.include_router(agreement.router, prefix="/api")
    app_instance.include_router(reconciliation.router, prefix="/api")
    app_instance.include_router(advisory.router, prefix="/api")
    app_instance.include_router(audit.router, prefix="/api")
    app_instance.include_router(evaluation.router, prefix="/api")

    return app_instance

app = create_app()
