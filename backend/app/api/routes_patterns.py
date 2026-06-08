from fastapi import APIRouter

from app.ml.execution_patterns import analyze_execution_patterns

router = APIRouter(prefix="/patterns", tags=["patterns"])


@router.get("/execution")
def execution_patterns(limit: int = 100):
    return analyze_execution_patterns(limit)
