from fastapi import APIRouter, Depends
from backend.app.core.security import require_role, AuthenticatedUser
from backend.app.services.benchmark_eval import run_evaluation_benchmark

router = APIRouter(prefix="/evaluation", tags=["Evaluation"])

@router.get("/benchmark")
def get_benchmark_report(user: AuthenticatedUser = Depends(require_role("viewer"))):
    """Retrieves reproducible AI/ML evaluation metrics, baselines, and failure cases."""
    return run_evaluation_benchmark()

@router.post("/benchmark/run")
def trigger_benchmark_run(user: AuthenticatedUser = Depends(require_role("viewer"))):
    """Executes fresh AI/ML inter-annotator evaluation benchmark."""
    return run_evaluation_benchmark()
