from fastapi import APIRouter
from pydantic import BaseModel

from app.ml.execution_policy import evaluate_execution_policy

router = APIRouter(prefix="/policy", tags=["policy"])


class ExecutionPolicyRequest(BaseModel):
    file_path: str
    runtime: str
    error_signature: str | None = None


@router.post("/execution")
def execution_policy(payload: ExecutionPolicyRequest):
    return evaluate_execution_policy(
        file_path=payload.file_path,
        runtime=payload.runtime,
        error_signature=payload.error_signature,
    )
