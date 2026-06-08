from __future__ import annotations

import json
from collections import Counter, defaultdict
from typing import Any, Dict
from app.ml.remediation_profiles import build_remediation_summary

from app.storage.execution_history import (
    get_recent_execution_history,
    get_execution_failures,
    get_error_statistics,
)


def _safe_json(value: Any) -> Dict[str, Any]:
    if not value:
        return {}

    if isinstance(value, dict):
        return value

    try:
        return json.loads(value)
    except Exception:
        return {}


def analyze_execution_patterns(limit: int = 100) -> Dict[str, Any]:
    records = get_recent_execution_history(limit)
    failures = get_execution_failures(limit)
    error_stats = get_error_statistics()

    runtime_counts = Counter()
    signature_counts = Counter()
    success_by_runtime = defaultdict(lambda: {"success": 0, "failure": 0})
    errors_by_runtime = defaultdict(Counter)
    signatures_by_runtime = defaultdict(Counter)
    recommendations = []

    for record in records:
        runtime = record.get("runtime") or "unknown"
        success = bool(record.get("success"))

        metadata = _safe_json(record.get("metadata"))
        error_signature = metadata.get("error_signature")
        detected_error = record.get("detected_error")

        effective_error = error_signature or detected_error or "none"

        runtime_counts[runtime] += 1
        signature_counts[effective_error] += 1

        if success:
            success_by_runtime[runtime]["success"] += 1
        else:
            success_by_runtime[runtime]["failure"] += 1
            errors_by_runtime[runtime][effective_error] += 1
            signatures_by_runtime[runtime][effective_error] += 1

    for runtime, counts in success_by_runtime.items():
        total = counts["success"] + counts["failure"]
        failure_rate = counts["failure"] / total if total else 0

        if failure_rate >= 0.5 and total >= 3:
            recommendations.append({
                "type": "runtime_failure_pattern",
                "runtime": runtime,
                "severity": "high",
                "message": f"{runtime} has a high failure rate across recent executions.",
                "failure_rate": round(failure_rate, 2),
                "suggested_action": "Review runtime adapter configuration and add targeted remediation profiles.",
            })

    for runtime, signatures in signatures_by_runtime.items():
        for signature, count in signatures.most_common():
            if signature == "none":
                continue

            if count >= 2:
                recommendations.append({
                    "type": "recurring_error_signature",
                    "runtime": runtime,
                    "signature": signature,
                    "severity": "medium",
                    "message": f"{signature} has occurred repeatedly under {runtime}.",
                    "count": count,
                    "suggested_action": "Create or tune a remediation profile for this normalized error signature.",
                })

    return {
        "total_records_analyzed": len(records),
        "total_failures_analyzed": len(failures),
        "runtime_counts": dict(runtime_counts),
        "signature_counts": dict(signature_counts),
        "success_by_runtime": dict(success_by_runtime),
        "errors_by_runtime": {
            runtime: dict(counter)
            for runtime, counter in errors_by_runtime.items()
        },
        "signatures_by_runtime": {
            runtime: dict(counter)
            for runtime, counter in signatures_by_runtime.items()
        },
        "legacy_error_statistics": error_stats,
        "recommendations": recommendations,
        "remediation_profiles": build_remediation_summary(dict(signature_counts)),
    }