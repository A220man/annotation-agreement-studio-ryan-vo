import time
import hashlib
import base64
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from jose import jwt
from fastapi import status
from app.core.config import settings
import app.core.security as security_module

@pytest.fixture
def rsa_keypair():
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    return {"private_pem": private_pem, "public_pem": public_pem, "kid": "test-key-id-1"}

def test_complete_oidc_pkce_protocol_and_token_propagation(client, rsa_keypair, monkeypatch):
    """
    Simulates a complete OIDC authorization-code flow with PKCE,
    verifying PKCE challenge verification, state verification, RS256 token signing,
    JWKS discovery, and authorized API access across HTTP boundary.
    """
    # 1. Client generates PKCE code_verifier and code_challenge (S256)
    code_verifier = "synthetic_pkce_verifier_string_value_32_chars_long"
    hashed = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(hashed).decode("ascii").rstrip("=")
    state = "synthetic_client_state_random_nonce_123"

    # Simulated IdP auth code store
    auth_codes = {}

    def idp_authorize(client_id, challenge, challenge_method, req_state):
        assert client_id == settings.OIDC_CLIENT_ID
        assert challenge_method == "S256"
        assert req_state == state
        code = "idp_generated_auth_code_98765"
        auth_codes[code] = {
            "code_challenge": challenge,
            "state": req_state,
        }
        return code

    # Step 1: User redirects to IdP and receives auth code
    issued_code = idp_authorize(settings.OIDC_CLIENT_ID, code_challenge, "S256", state)

    # Step 2: PKCE verification and Token Exchange
    def idp_token_exchange(code, verifier):
        if code not in auth_codes:
            raise ValueError("Invalid authorization code")
        stored = auth_codes[code]
        # Recompute code_challenge from provided verifier
        recomputed = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).decode("ascii").rstrip("=")
        if stored["code_challenge"] != recomputed:
            raise ValueError("PKCE code verification mismatch")

        now = int(time.time())
        token_payload = {
            "sub": "oidc-analyst-user-id",
            "email": "analyst.oidc@example.com",
            "name": "OIDC Analyst",
            "iss": settings.OIDC_ISSUER_URL,
            "aud": settings.OIDC_AUDIENCE,
            "realm_access": {"roles": ["analyst", "viewer"]},
            "iat": now,
            "exp": now + 3600,
        }
        token = jwt.encode(
            token_payload,
            rsa_keypair["private_pem"],
            algorithm="RS256",
            headers={"kid": rsa_keypair["kid"]},
        )
        return token

    # Test PKCE rejection with wrong verifier
    with pytest.raises(ValueError, match="PKCE code verification mismatch"):
        idp_token_exchange(issued_code, "wrong_pkce_verifier_string")

    # Legitimate token exchange with correct verifier
    oidc_access_token = idp_token_exchange(issued_code, code_verifier)
    assert oidc_access_token is not None

    # Step 3: Mock OIDC JWKS discovery returning our public key
    async def mock_fetch_jwks():
        return {
            "keys": [
                {
                    "kid": rsa_keypair["kid"],
                    "kty": "RSA",
                    "alg": "RS256",
                    "use": "sig",
                    "key": rsa_keypair["public_pem"],
                }
            ]
        }
    monkeypatch.setattr(security_module, "fetch_oidc_jwks", mock_fetch_jwks)

    # Step 4: Propagate token into authorized API request crossing HTTP boundary
    headers = {"Authorization": f"Bearer {oidc_access_token}"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    user_data = response.json()
    assert user_data["user_id"] == "oidc-analyst-user-id"
    assert "analyst" in user_data["roles"]

    # Step 5: Test authorized task creation
    task_resp = client.post(
        "/api/tasks",
        json={"name": "OIDC Authenticated Task", "task_type": "span", "labels_schema": ["LOC"]},
        headers=headers,
    )
    assert task_resp.status_code == status.HTTP_201_CREATED
    assert task_resp.json()["name"] == "OIDC Authenticated Task"
