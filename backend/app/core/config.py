import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings

def get_product_version() -> str:
    candidates = [
        Path(__file__).resolve().parent.parent.parent / "VERSION",
        Path(__file__).resolve().parent.parent.parent.parent / "VERSION",
        Path("/app/VERSION"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            try:
                ver = candidate.read_text(encoding="utf-8").strip()
                if ver:
                    return ver
            except Exception:
                pass
    return "1.0.0"

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    PORT: int = 8000
    HOST: str = "127.0.0.1"
    DEMO_MODE: bool = True
    VERSION: str = get_product_version()

    # Database
    DATABASE_URL: str = "sqlite:///./annotation_studio.db"

    # Authentication & OIDC Keycloak
    OIDC_ISSUER_URL: str = "http://127.0.0.1:8080/realms/annotation-realm"
    OIDC_AUDIENCE: str = "annotation-agreement-studio"
    OIDC_CLIENT_ID: str = "annotation-agreement-studio-client"
    OIDC_CLIENT_SECRET: Optional[str] = None
    OIDC_DISCOVERY_URL: str = "http://127.0.0.1:8080/realms/annotation-realm/.well-known/openid-configuration"
    JWT_SECRET_KEY: str = "insecure-dev-secret-key-for-local-demo-only-change-in-production"
    JWT_ALGORITHM: str = "HS256"

    # Advisory LLM Adapter Settings (strictly opt-in, non-secret operator settings)
    LLM_PROVIDER: str = "openai-compatible"  # openai-compatible, anthropic, gemini, ollama
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_BASE_URL: Optional[str] = None
    LLM_API_KEY: Optional[str] = None
    LLM_TIMEOUT_SECONDS: int = 15

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

def validate_environment_safety(cfg: Settings) -> None:
    """Refuses demo mode in production environments."""
    if cfg.ENVIRONMENT.lower() == "production" and cfg.DEMO_MODE:
        raise RuntimeError(
            "FATAL CONFIGURATION ERROR: DEMO_MODE cannot be enabled in production environments. "
            "Please configure authentic OIDC Identity Provider credentials."
        )
