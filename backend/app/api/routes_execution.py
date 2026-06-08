from fastapi import APIRouter, Body
from app.schemas.execution import ExecutionRequest, ExecutionResult
from app.execution.runner import run_program, execute_plan_dict

router = APIRouter(tags=["execution"])

@router.get("/execution/health")
def execution_health():
    return {"module": "execution", "status": "ready"}

@router.post("/execution/run", response_model=ExecutionResult)
def execute_program(request: ExecutionRequest):
    return run_program(request)

@router.post("/execute")
def execute_plan(plan: dict = Body(...)):
    return execute_plan_dict(plan)
