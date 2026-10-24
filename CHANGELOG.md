# Changelog

## 1.5.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

## 1.4.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

## 1.3.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

## 1.2.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

### Added
- HuggingFace dataset export format (`GET /api/reconciliation/export/{task_id}?format=huggingface`) with proper Content-Disposition headers for JSONL, CoNLL, and HuggingFace formats.
- Reconciliation Queue UI adds HuggingFace export button for span annotation tasks.
- Full unit test coverage for HuggingFace export endpoint (RBAC, auth, format validation) and frontend export links.
- Content-Disposition download headers added to all reconciliation export formats (JSONL, CoNLL, HuggingFace).

- Agreement report export endpoint (`GET /api/agreement/tasks/{id}/export`) supporting JSON and multi-section CSV formats with summary metrics, Cohen's kappa, disagreement matrix, top disagreement pairs, and boundary diagnostics.
- Agreement Dashboard export UI buttons for downloading JSON and CSV reports with automatic blob download handling.
- Full unit test coverage for agreement report export endpoint and frontend export actions.
- **Annotation batch import validation** (`POST /api/annotations/batch`) with comprehensive span boundary checks against document text lengths, task-document consistency verification, and detailed per-span error reporting.

### Fixed
- Unified backend imports on the `app` package (matching the Docker `uvicorn app.main:app` entrypoint). Mixed `backend.app`/`app` imports loaded the security module twice, so the OIDC test's JWKS patch never reached the running app and hosted CI failed.
- README run and benchmark commands now use the same entrypoint.

## [1.1.1] - 2026-10-09

- Fix backend Docker builds in CI and Compose by including the root VERSION file in a restricted repository-root build context.

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
