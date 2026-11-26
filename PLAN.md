# Product development plan

Each round completes one feature or repair. Future items are planned, not implemented claims.

## Current round

audit-log-filtering

## Roadmap

### continue-implementation — Continue implementation and resolve known failures

Status: done

Acceptance:
- Run checks, fix failures, and implement the next planned feature

Implementation: `frontend/src/components/ReconciliationQueue.tsx`, `frontend/src/components/TaskCoordinator.tsx`, `frontend/src/components/AgreementDashboard.tsx`

Tests: `frontend/src/components/ReconciliationQueue.test.tsx`, `frontend/src/components/AgreementDashboard.test.tsx`, `backend/tests/`

### fix-typescript-build-errors — Fix TypeScript build errors in frontend components

Status: done

Acceptance:
- Frontend builds without TypeScript errors
- All existing tests pass
- Fix type mismatches in AgreementDashboard, ReconciliationQueue, TaskCoordinator

Implementation: `frontend/src/components/AgreementDashboard.tsx`, `frontend/src/components/ReconciliationQueue.tsx`, `frontend/src/components/TaskCoordinator.tsx`

Tests: `frontend/src/components/ReconciliationQueue.test.tsx`, `frontend/src/components/AgreementDashboard.test.tsx`, `backend/tests/`

### audit-log-filtering — Audit log filtering in the web UI

Status: done

Acceptance:
- AuditTrailView exposes event_type, entity_type and user_id filter inputs plus Apply/Clear controls
- api.audit.list sends the active filters as query parameters to GET /api/audit
- Filter and clear actions trigger a reload and render only matching rows
- Load failures surface an inline error message instead of a blank table

Implementation: `frontend/src/api/client.ts`, `frontend/src/components/AuditTrailView.tsx`

Tests: `frontend/src/components/AuditTrailView.test.tsx`

