from __future__ import annotations

from typing import Dict, List
from fastapi import APIRouter
from app.schemas.models import (SystemProfile, HostCapabilities, InsightScanResult, CompatibilityReport, BinaryCompatibilityReport, StrategyOption, CompatibilityBlocker, ExecutionPlan)
from app.core.system import _system_profile, _host_capabilities
from app.core.compatibility import _evaluate_binary, _interp_family_for_report

router = APIRouter(tags=["core"] )

@router.get("/insight/system", response_model=SystemProfile)
def insight_system():
    return _system_profile()

@router.get("/core/capabilities", response_model=HostCapabilities)
def core_capabilities():
    return HostCapabilities(**_host_capabilities())

@router.post("/core/evaluate", response_model=CompatibilityReport)
def core_evaluate(payload: InsightScanResult):
    sys = payload.system
    reports: List[BinaryCompatibilityReport] = []
    for bp in payload.binaries or []:
        try:
            reports.append(_evaluate_binary(sys, bp))
        except Exception as e:
            reports.append(BinaryCompatibilityReport(path=bp.path, format=bp.format, bitness=bp.bitness, arch=bp.arch, script_interpreter=bp.script_interpreter, artifact_class=getattr(bp, "artifact_class", "unknown"), should_evaluate=bool(getattr(bp, "should_evaluate", True)), verdict="unknown", compatibility_score=0.0, recommended=StrategyOption(name="unknown", confidence=0.2, rationale=f"Evaluation error: {e}"), alternatives=[], blockers=[CompatibilityBlocker(code="evaluation_error", message=f"Evaluation error: {e}", severity="soft", remediation="Inspect the binary profile and system profile, then retry evaluation.")], risks=["Evaluation failed; inspect binary profile and system profile."], remediation_steps=["Inspect the binary profile and system profile, then retry evaluation."], execution_path="unknown", execution_plan=ExecutionPlan(strategy="unknown", runtime="none", command=None, args=[], env={}, working_directory=None, notes=["Evaluation failed before an execution plan could be generated."])))
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
    return CompatibilityReport(system=sys, evaluated_count=len(reports), recommended_counts=counts, interpreter_counts=interp_counts, artifact_class_counts=artifact_class_counts, bridge_relevant_count=bridge_relevant_count, binaries=reports)
