from fastapi import APIRouter

from app.ml.runtime_reputation import score_runtime_reputation

router = APIRouter(prefix="/reputation", tags=["reputation"])


@router.get("/runtime")
def runtime_reputation(limit: int = 100):
    return score_runtime_reputation(limit)
