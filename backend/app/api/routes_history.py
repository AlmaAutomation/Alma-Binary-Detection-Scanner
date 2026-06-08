from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.storage.execution_history import (
    get_recent_execution_history,
    get_execution_failures,
    get_error_statistics,
)

router = APIRouter(prefix="/history", tags=["history"])


@router.get("/recent")
def recent_history(limit: int = 25):
    return JSONResponse(content=get_recent_execution_history(limit))


@router.get("/failures")
def execution_failures(limit: int = 25):
    return JSONResponse(content=get_execution_failures(limit))


@router.get("/stats")
def execution_stats():
    return JSONResponse(content=get_error_statistics())