import json
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import httpx
from backend.app.core.config import settings

class AdvisoryRequest(BaseModel):
    document_text: str
    task_type: str
    conflicting_annotations: List[Dict[str, Any]]
    guidelines: Optional[str] = None

class AdvisoryResponse(BaseModel):
    status: str
    analysis: Optional[str] = None
    guideline_recommendation: Optional[str] = None
    advisory_disclaimer: str = "ADVISORY ONLY: Deterministic consensus and human review take precedence."
    provider: Optional[str] = None
    model_used: Optional[str] = None
    error_message: Optional[str] = None

def redact_sensitive_strings(text: str) -> str:
    if not text: return ""
    text = re.sub(r'Bearer\s+[A-Za-z0-9_\-\.]+', 'Bearer [REDACTED]', text)
    text = re.sub(r'(?:key|token|password)=([A-Za-z0-9_\-]+)', r'\1=[REDACTED]', text)
    if settings.LLM_API_KEY: text = text.replace(settings.LLM_API_KEY, "[REDACTED_KEY]")
    return text

def build_grounded_prompt(req: AdvisoryRequest) -> str:
    prompt = [
        f"Item: {req.document_text}",
        f"Task: {req.task_type}",
        f"Guidelines: {req.guidelines or 'None'}",
        "Conflicting annotations:",
    ]
    for a in req.conflicting_annotations:
        prompt.append(f"- {a.get('annotator_name')}: label={a.get('class_label')}, spans={a.get('spans')}")
    prompt.append('Respond strictly in JSON: {"analysis": "...", "guideline_recommendation": "..."}')
    return "\n".join(prompt)

async def request_advisory_explanation(req: AdvisoryRequest) -> AdvisoryResponse:
    provider, model = settings.LLM_PROVIDER.lower(), settings.LLM_MODEL
    if not settings.LLM_API_KEY and provider != "ollama":
        return AdvisoryResponse(status="unavailable", error_message="LLM_API_KEY not configured. Operates offline by default.", provider=provider, model_used=model)

    prompt = build_grounded_prompt(req)
    timeout = httpx.Timeout(float(settings.LLM_TIMEOUT_SECONDS))

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            raw_text = ""
            if provider == "openai-compatible":
                base = (settings.LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/")
                resp = await client.post(f"{base}/chat/completions", headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"}, json={"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2})
                resp.raise_for_status()
                raw_text = resp.json()["choices"][0]["message"]["content"]
            elif provider == "anthropic":
                base = (settings.LLM_BASE_URL or "https://api.anthropic.com/v1").rstrip("/")
                resp = await client.post(f"{base}/messages", headers={"x-api-key": settings.LLM_API_KEY or "", "anthropic-version": "2023-06-01"}, json={"model": model or "claude-3-haiku-20240307", "max_tokens": 1024, "messages": [{"role": "user", "content": prompt}]})
                resp.raise_for_status()
                raw_text = resp.json()["content"][0]["text"]
            elif provider == "gemini":
                base = (settings.LLM_BASE_URL or "https://generativelanguage.googleapis.com").rstrip("/")
                resp = await client.post(f"{base}/v1beta/models/{model or 'gemini-1.5-flash'}:generateContent?key={settings.LLM_API_KEY}", json={"contents": [{"parts": [{"text": prompt}]}]})
                resp.raise_for_status()
                raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            elif provider == "ollama":
                base = (settings.LLM_BASE_URL or "http://127.0.0.1:11434").rstrip("/")
                resp = await client.post(f"{base}/api/generate", json={"model": model or "llama3", "prompt": prompt, "stream": False, "format": "json"})
                resp.raise_for_status()
                raw_text = resp.json().get("response", "")
            else:
                return AdvisoryResponse(status="error", error_message=f"Unknown provider: {provider}", provider=provider, model_used=model)

            try:
                cleaned = raw_text.strip()
                if cleaned.startswith("```"): cleaned = re.sub(r"^```(?:json)?\n?|\n?```$", "", cleaned)
                parsed = json.loads(cleaned)
                return AdvisoryResponse(status="success", analysis=parsed.get("analysis", raw_text), guideline_recommendation=parsed.get("guideline_recommendation", ""), provider=provider, model_used=model)
            except Exception:
                return AdvisoryResponse(status="success", analysis=raw_text, guideline_recommendation="Clarify boundary punctuation and category definitions.", provider=provider, model_used=model)
    except Exception as exc:
        return AdvisoryResponse(status="error", error_message=f"Provider failed: {redact_sensitive_strings(str(exc))}", provider=provider, model_used=model)
