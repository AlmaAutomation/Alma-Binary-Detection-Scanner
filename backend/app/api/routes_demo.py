from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel
from app.schemas.models import (
    EWSSnapshot,
    InsightScanRequest,
    ScanPolicy,
    InsightScanResult,
    CompatibilityReport,
    BinaryCompatibilityReport,
    StrategyOption,
    CompatibilityBlocker,
    ExecutionPlan,
)
from app.scanning.scanner import _scan_files_legacy, _legacy_to_insight
from app.core.compatibility import _evaluate_binary, _interp_family_for_report
from app.api.routes_ews import get_latest_snapshot

router = APIRouter(tags=["demo"])

class DemoRunResult(BaseModel):
    telemetry: Optional[EWSSnapshot] = None
    insight: InsightScanResult
    core: CompatibilityReport
    selected_binary: Optional[BinaryCompatibilityReport] = None
    selected_execution_plan: Optional[ExecutionPlan] = None
    note: str = "Demo run completed."


@router.post("/demo/run", response_model=DemoRunResult)
def demo_run(payload: InsightScanRequest):
    legacy, used_cache, duration_ms = _scan_files_legacy(
        payload.folder,
        payload.arch_filter,
        payload.limit,
        payload.forensic,
    )

    policy = ScanPolicy(
        folder=payload.folder,
        arch_filter=payload.arch_filter,
        limit=payload.limit,
        forensic=payload.forensic,
        exclude_dirs=[],
    )

    insight = _legacy_to_insight(legacy, policy, used_cache, duration_ms)

    reports: List[BinaryCompatibilityReport] = []
    for bp in insight.binaries or []:
        try:
            reports.append(_evaluate_binary(insight.system, bp))
        except Exception as exc:
            reports.append(
                BinaryCompatibilityReport(
                    path=bp.path,
                    format=bp.format,
                    bitness=bp.bitness,
                    arch=bp.arch,
                    script_interpreter=bp.script_interpreter,
                    artifact_class=getattr(bp, "artifact_class", "unknown"),
                    should_evaluate=bool(getattr(bp, "should_evaluate", True)),
                    verdict="unknown",
                    compatibility_score=0.0,
                    recommended=StrategyOption(
                        name="unknown",
                        confidence=0.2,
                        rationale=f"Evaluation error: {exc}",
                    ),
                    alternatives=[],
                    blockers=[
                        CompatibilityBlocker(
                            code="evaluation_error",
                            message=f"Evaluation error: {exc}",
                            severity="soft",
                            remediation="Inspect the binary profile and retry evaluation.",
                        )
                    ],
                    risks=["Evaluation failed; inspect the binary profile and system profile."],
                    remediation_steps=["Inspect the binary profile and system profile, then retry evaluation."],
                    execution_path="unknown",
                    execution_plan=ExecutionPlan(
                        strategy="unknown",
                        runtime="none",
                        command=None,
                        args=[],
                        env={},
                        working_directory=None,
                        notes=["Evaluation failed before an execution plan could be generated."],
                    ),
                )
            )

    counts: Dict[str, int] = {}
    interp_counts: Dict[str, int] = {}
    artifact_class_counts: Dict[str, int] = {}
    bridge_relevant_count = 0
    for r in reports:
        counts[r.recommended.name] = counts.get(r.recommended.name, 0) + 1
        fam = _interp_family_for_report(r)
        interp_counts[fam] = interp_counts.get(fam, 0) + 1
        artifact_class = getattr(r, "artifact_class", "unknown") or "unknown"
        artifact_class_counts[artifact_class] = artifact_class_counts.get(artifact_class, 0) + 1
        if getattr(r, "should_evaluate", True):
            bridge_relevant_count += 1

    core_report = CompatibilityReport(
        system=insight.system,
        evaluated_count=len(reports),
        recommended_counts=counts,
        interpreter_counts=interp_counts,
        artifact_class_counts=artifact_class_counts,
        bridge_relevant_count=bridge_relevant_count,
        binaries=reports,
    )

    selected = None
    for report in reports:
        if report.recommended.name != "reject" and report.verdict not in ("unsupported", "incompatible_local"):
            selected = report
            break
    if selected is None and reports:
        selected = reports[0]

    return DemoRunResult(
        telemetry=get_latest_snapshot(),
        insight=insight,
        core=core_report,
        selected_binary=selected,
        selected_execution_plan=selected.execution_plan if selected else None,
        note="Demo flow completed. Use the selected binary and execution plan for a live run.",
    )
