import pytest
import httpx
from unittest.mock import AsyncMock, patch
from backend.app.core.config import settings
from backend.app.services.llm_advisor import (
    AdvisoryRequest,
    request_advisory_explanation,
    redact_sensitive_strings,
)

@pytest.mark.asyncio
async def test_offline_default_when_api_key_missing():
    settings.LLM_API_KEY = None
    settings.LLM_PROVIDER = "openai-compatible"

    req = AdvisoryRequest(
        document_text="Sample text",
        task_type="classification",
        conflicting_annotations=[{"annotator_name": "A", "class_label": "POS"}],
    )
    resp = await request_advisory_explanation(req)
    assert resp.status == "unavailable"
    assert "LLM_API_KEY" in resp.error_message and "not configured" in resp.error_message

@pytest.mark.asyncio
async def test_openai_compatible_mocked_adapter():
    # Synthetic runtime key
    synthetic_key = "test-provider-" + ("0" * 32)
    settings.LLM_API_KEY = synthetic_key
    settings.LLM_PROVIDER = "openai-compatible"

    mock_resp = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": '{"analysis": "Semantic boundary discrepancy", "guideline_recommendation": "Exclude punctuation"}'
                    }
                }
            ]
        },
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = AdvisoryRequest(
            document_text="Sample text",
            task_type="span",
            conflicting_annotations=[],
        )
        res = await request_advisory_explanation(req)
        assert res.status == "success"
        assert "Semantic boundary discrepancy" in res.analysis
        assert "Exclude punctuation" in res.guideline_recommendation
        assert "ADVISORY ONLY" in res.advisory_disclaimer

    settings.LLM_API_KEY = None

def test_sensitive_credentials_redaction():
    synthetic_token = "synthetic-secret-" + ("0" * 24)
    raw_error = f"HTTP 401 Unauthorized for Authorization: Bearer {synthetic_token}"
    redacted = redact_sensitive_strings(raw_error)
    assert synthetic_token not in redacted
    assert "Bearer [REDACTED]" in redacted
