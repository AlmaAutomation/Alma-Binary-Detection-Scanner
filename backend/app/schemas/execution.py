from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel

class ExecutionRequest(BaseModel):
    file_path: str
    runtime: str = "wine"
    args: List[str] = []
    env: Dict[str, str] = {}

class ExecutionResult(BaseModel):
    file_path: str
    runtime: str
    command: List[str]
    started_at: datetime
    finished_at: datetime
    exit_code: Optional[int]
    stdout: str
    stderr: str
    detected_error: Optional[str] = None
    likely_causes: List[str] = []
    recommended_actions: List[str] = []
