# Product development plan

Each round completes one feature or repair. Future items are planned, not implemented claims.

## Current round

agreement-report-export

## Roadmap

### agreement-report-export — Agreement Report Export

Status: done

Acceptance:
- GET /api/agreement/tasks/{task_id}/export?format=json returns full agreement summary as downloadable JSON
- GET /api/agreement/tasks/{task_id}/export?format=csv returns disagreement matrix and boundary diagnostics as CSV
- Exported reports include Cohen/Fleiss/Krippendorff metrics, confusion matrix, and boundary diagnostics
- Export respects RBAC (requires viewer role)
- Frontend adds Export button to Agreement Dashboard with format selection

Implementation: `backend/app/api/routes/agreement.py`, `backend/app/services/agreement_engine.py`, `frontend/src/components/AgreementDashboard.tsx`, `frontend/src/api/client.ts`

Tests: `backend/tests/test_agreement_export.py`, `frontend/src/components/AgreementDashboard.test.tsx`

### annotation-import-validation — Annotation Batch Import Validation

Status: planned

Acceptance:
- Validates span boundaries within document text lengths on batch import
- Rejects malformed span inputs with detailed error feedback

