from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from backend.app.core.config import settings
from backend.app.core.security import (
    AuthenticatedUser,
    get_current_user,
    create_demo_access_token,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

class DemoTokenRequest(BaseModel):
    role: str = "analyst"  # viewer, analyst, admin
    username: str = "demo-analyst"
    email: str = "analyst@example.com"

class DemoTokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    role: str
    username: str
    email: str
    expires_in: int = 86400
    is_demo: bool = True

class AuthConfigResponse(BaseModel):
    demo_mode: bool
    environment: str
    oidc_issuer_url: str
    oidc_client_id: str
    oidc_audience: str
    oidc_discovery_url: str
    supported_roles: List[str]

@router.get("/config", response_model=AuthConfigResponse)
def get_auth_config():
    """Returns external OIDC Keycloak configuration and demo availability."""
    return AuthConfigResponse(
        demo_mode=settings.DEMO_MODE and settings.ENVIRONMENT.lower() != "production",
        environment=settings.ENVIRONMENT,
        oidc_issuer_url=settings.OIDC_ISSUER_URL,
        oidc_client_id=settings.OIDC_CLIENT_ID,
        oidc_audience=settings.OIDC_AUDIENCE,
        oidc_discovery_url=settings.OIDC_DISCOVERY_URL,
        supported_roles=["viewer", "analyst", "admin"],
    )

@router.post("/demo-token", response_model=DemoTokenResponse)
def generate_demo_token(req: DemoTokenRequest):
    """
    Issues a signed Bearer token for local development or testing.
    Explicitly refuses to issue demo tokens in production.
    """
    if settings.ENVIRONMENT.lower() == "production" or not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo tokens are strictly prohibited in production mode. Authenticate via Keycloak OIDC.",
        )

    valid_roles = {"viewer", "analyst", "admin"}
    if req.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{req.role}'. Allowed roles: {list(valid_roles)}",
        )

    token = create_demo_access_token(
        user_id=f"demo-{req.role}",
        email=req.email,
        name=req.username,
        role=req.role,
    )

    return DemoTokenResponse(
        access_token=token,
        token_type="Bearer",
        role=req.role,
        username=req.username,
        email=req.email,
    )

@router.get("/me", response_model=AuthenticatedUser)
def get_current_user_profile(user: AuthenticatedUser = Depends(get_current_user)):
    """Returns profile and role claims of the currently authenticated user."""
    return user

@router.post("/logout")
def logout(user: AuthenticatedUser = Depends(get_current_user)):
    """Explicit logout confirmation for bearer-token clients."""
    return {
        "status": "logged_out",
        "user_id": user.user_id,
        "message": "Token discarded. Client should clear in-memory bearer token.",
    }
