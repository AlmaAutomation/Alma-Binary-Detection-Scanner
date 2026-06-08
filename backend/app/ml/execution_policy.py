from __future__ import annotations

import os
from typing import Any, Dict

from app.ml.execution_patterns import analyze_execution_patterns
from app.ml.remediation_profiles import get_remediation_profile
from app.ml.runtime_reputation import score_runtime_reputation


def evaluate_execution_policy(
    *,
    file_path: str,
    runtime: str,
    error_signature: str | None = None,
) -> Dict[str, Any]:
    patterns = analyze_execution_patterns(limit=100)

    signature = error_signature or "unknown_error"
    if not os.path.exists(file_path):
        signature = "file_not_found"

    profile = get_remediation_profile(signature)

    reputation = score_runtime_reputation(limit=100)
    runtime_rep = reputation.get("runtime_reputation", {}).get(runtime)

    decisions = []
    allow_execution = True

    if not os.path.exists(file_path):
        allow_execution = False
        decisions.append({
            "policy": "validate_path_before_launch",
            "decision": "block",
            "reason": "Target file path does not exist.",
            "signature": "file_not_found",
            "profile": get_remediation_profile("file_not_found"),
        })

    runtime_stats = patterns.get("success_by_runtime", {}).get(runtime)
    if runtime_stats:
        total = runtime_stats.get("success", 0) + runtime_stats.get("failure", 0)
        failures = runtime_stats.get("failure", 0)
        failure_rate = failures / total if total else 0

        if total >= 3 and failure_rate >= 0.8:
            decisions.append({
                "policy": "high_runtime_failure_rate",
                "decision": "warn",
                "reason": f"{runtime} has a high historical failure rate.",
                "failure_rate": round(failure_rate, 2),
                "profile": profile,
            })

    if runtime_rep:
        score = runtime_rep.get("score", 50)
        band = runtime_rep.get("band", "unknown")

        if band == "poor" and score <= 20:
            decisions.append({
                "policy": "poor_runtime_reputation",
                "decision": "warn",
                "reason": f"{runtime} has poor runtime reputation based on historical execution outcomes.",
                "runtime_reputation": runtime_rep,
                "profile": profile,
            })

        if band == "poor" and score == 0 and runtime_rep.get("total", 0) >= 10:
            decisions.append({
                "policy": "runtime_quarantine_candidate",
                "decision": "warn",
                "reason": f"{runtime} has repeated failures and may need isolated execution or alternate runtime routing.",
                "runtime_reputation": runtime_rep,
                "suggested_action": "Use isolated WINEPREFIX, enable debug logging, or try alternate runtime.",
            })

    return {
        "allow_execution": allow_execution,
        "runtime": runtime,
        "file_path": file_path,
        "signature": signature,
        "runtime_reputation": runtime_rep,
        "decisions": decisions,
    }