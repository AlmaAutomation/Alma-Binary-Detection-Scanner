from __future__ import annotations

import os
import subprocess
from datetime import datetime

from app.execution.classifiers import classify_execution_error
from app.execution.remediation import recommend_actions
from app.schemas.execution import ExecutionRequest, ExecutionResult
from app.storage.execution_history import add_execution_record
from app.ml.error_signatures import detect_error_signature
from ews.telemetry import get_latest_snapshot


def run_program(request: ExecutionRequest) -> ExecutionResult:
    started_at = datetime.utcnow()

    env = os.environ.copy()
    env.update(request.env or {})

    command = [request.runtime, request.file_path, *(request.args or [])]

    try:
        proc = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
            timeout=120,
        )
        stdout = proc.stdout
        stderr = proc.stderr
        exit_code = proc.returncode

    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout or ""
        stderr = exc.stderr or "Execution timed out."
        exit_code = None

    finished_at = datetime.utcnow()

    detected_error, likely_causes = classify_execution_error(stdout, stderr)
    error_signature = detect_error_signature(stderr, stdout)

    recommended = recommend_actions(
        detected_error,
        request.file_path,
        request.runtime,
    )

    telemetry_snapshot = get_latest_snapshot()
    
    print("WRITING EXECUTION RECORD")

    add_execution_record(
        file_path=request.file_path,
        runtime=request.runtime,
        success=(exit_code == 0),
        exit_code=exit_code,
        detected_error=detected_error,
        stdout=stdout,
        stderr=stderr,
        telemetry_snapshot=telemetry_snapshot,
        command=command,
        metadata={
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "likely_causes": likely_causes,
            "recommended_actions": recommended,
            "error_signature": error_signature,
        },
    )
    
    print("EXECUTION RECORD WRITTEN")
    
    return ExecutionResult(
        file_path=request.file_path,
        runtime=request.runtime,
        command=command,
        started_at=started_at,
        finished_at=finished_at,
        exit_code=exit_code,
        stdout=stdout,
        stderr=stderr,
        detected_error=detected_error,
        likely_causes=likely_causes,
        recommended_actions=recommended,
    )


def execute_plan_dict(plan: dict):
    cmd = [plan.get("command")] + (plan.get("args", []) or [])

    env = os.environ.copy()
    env.update(plan.get("env", {}) or {})

    result = subprocess.run(
        cmd,
        env=env,
        capture_output=True,
        text=True,
    )

    return {
        "status": "executed",
        "cmd": cmd,
        "returncode": result.returncode,
        "stdout": result.stdout[:1000],
        "stderr": result.stderr[:1000],
    }