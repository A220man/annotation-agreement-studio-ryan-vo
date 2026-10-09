# Changelog

## [1.1.0] - 2026-10-09

All notable changes to Annotation Agreement Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Unified backend imports on the `app` package (matching the Docker `uvicorn app.main:app` entrypoint). Mixed `backend.app`/`app` imports loaded the security module twice, so the OIDC test's JWKS patch never reached the running app and hosted CI failed.
- README run and benchmark commands now use the same entrypoint.

## [1.0.0] - 2026-10-08

### Added
- Initial release of Annotation Agreement Studio.
- Multi-annotator coordination for span tagging (NER/PII/BIO) and document classification tasks.
- Inter-annotator agreement metrics engine computing Cohen's Kappa, Fleiss' Kappa, and Krippendorff's Alpha.
- Token-level BIO transformation and span boundary overlap metrics (Exact Match IoU, Partial Match F1).
- Disagreement confusion matrices and boundary misalignment diagnostic analysis.
- Adjudication and consensus workflow supporting majority voting, rule-based conflict resolution, and manual reconciliation with audit history.
- Gold-standard dataset export in JSONL and CoNLL-2003 IOB formats.
- Opt-in, advisory LLM conflict explainer with provider-agnostic httpx adapters for OpenAI, Anthropic, Gemini, and Ollama.
- Keycloak OIDC authorization-code PKCE authentication architecture with role-based access control (viewer, analyst, admin) and local demo mode.
- Full-stack React + TypeScript + Vite frontend dashboard and FastAPI backend.
