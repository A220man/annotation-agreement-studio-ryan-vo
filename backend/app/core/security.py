import time
from typing import List, Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel
import httpx
from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)

class AuthenticatedUser(BaseModel):
    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    roles: List[str] = []

    def has_role(self, required_role: str) -> bool:
        if "admin" in self.roles: return True
        if required_role == "viewer": return bool({"viewer", "analyst", "admin"} & set(self.roles))
        if required_role == "analyst": return bool({"analyst", "admin"} & set(self.roles))
        return required_role in self.roles

_jwks_cache: Dict[str, Any] = {}
_jwks_last_fetched: float = 0.0

async def fetch_oidc_jwks() -> Optional[Dict[str, Any]]:
    global _jwks_cache, _jwks_last_fetched
    now = time.time()
    if _jwks_cache and (now - _jwks_last_fetched < 3600): return _jwks_cache
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            discovery = await client.get(settings.OIDC_DISCOVERY_URL)
            if discovery.status_code == 200:
                jwks_uri = discovery.json().get("jwks_uri")
                if jwks_uri:
                    jwks_resp = await client.get(jwks_uri)
                    if jwks_resp.status_code == 200:
                        _jwks_cache = jwks_resp.json()
                        _jwks_last_fetched = now
                        return _jwks_cache
    except Exception: pass
    return None

def create_demo_access_token(user_id: str, email: str, name: str, role: str) -> str:
    if settings.ENVIRONMENT.lower() == "production" or not settings.DEMO_MODE:
        raise HTTPException(status_code=403, detail="Demo tokens forbidden in production")
    now = int(time.time())
    payload = {
        "sub": user_id, "email": email, "name": name,
        "realm_access": {"roles": [role, "viewer"]},
        "iss": settings.OIDC_ISSUER_URL, "aud": settings.OIDC_AUDIENCE,
        "iat": now, "exp": now + 86400, "mode": "demo",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> AuthenticatedUser:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Missing Bearer token", headers={"WWW-Authenticate": "Bearer"})
    raw_token = credentials.credentials

    if settings.DEMO_MODE and settings.ENVIRONMENT.lower() != "production":
        try:
            payload = jwt.decode(raw_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM], audience=settings.OIDC_AUDIENCE)
            return AuthenticatedUser(user_id=payload.get("sub", "demo"), email=payload.get("email"), name=payload.get("name"), roles=payload.get("realm_access", {}).get("roles", []))
        except JWTError: pass

    jwks = await fetch_oidc_jwks()
    if jwks:
        try:
            kid = jwt.get_unverified_header(raw_token).get("kid")
            raw_key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
            if raw_key:
                v_key = raw_key.get("key") if isinstance(raw_key, dict) and "key" in raw_key else raw_key
                payload = jwt.decode(raw_token, v_key, algorithms=["RS256"], audience=settings.OIDC_AUDIENCE, issuer=settings.OIDC_ISSUER_URL)
                roles = list(set(payload.get("realm_access", {}).get("roles", []) + payload.get("resource_access", {}).get(settings.OIDC_CLIENT_ID, {}).get("roles", [])))
                return AuthenticatedUser(user_id=payload.get("sub", "oidc"), email=payload.get("email"), name=payload.get("name") or payload.get("preferred_username"), roles=roles)
        except JWTError: pass

    raise HTTPException(status_code=401, detail="Invalid token", headers={"WWW-Authenticate": "Bearer"})

def require_role(role_name: str):
    def role_checker(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if not user.has_role(role_name):
            raise HTTPException(status_code=403, detail=f"Access denied: {role_name} required")
        return user
    return role_checker
