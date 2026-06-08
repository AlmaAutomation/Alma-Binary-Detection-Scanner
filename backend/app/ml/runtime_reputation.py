from __future__ import annotations

from typing import Any, Dict

from app.ml.execution_patterns import analyze_execution_patterns


def score_runtime_reputation(limit: int = 100) -> Dict[str, Any]:
    patterns = analyze_execution_patterns(limit=limit)
    stats = patterns.get("success_by_runtime", {})

    reputations = {}

    for runtime, counts in stats.items():
        success = counts.get("success", 0)
        failure = counts.get("failure", 0)
        total = success + failure

        if total == 0:
            score = 50
            band = "unknown"
        else:
            success_rate = success / total
            score = round(success_rate * 100)

            if score >= 80:
                band = "trusted"
            elif score >= 50:
                band = "mixed"
            elif score >= 20:
                band = "risky"
            else:
                band = "poor"

        reputations[runtime] = {
            "success": success,
            "failure": failure,
            "total": total,
            "score": score,
            "band": band,
        }

    return {
        "limit": limit,
        "runtime_reputation": reputations,
    }
