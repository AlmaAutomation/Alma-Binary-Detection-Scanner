from __future__ import annotations

import os, shutil
from typing import Literal, List, Dict, Optional
from app.schemas.models import (SystemProfile, BinaryProfile, BinaryCompatibilityReport, StrategyOption, CompatibilityBlocker, ExecutionPlan)
from app.core.system import _normalize_arch

def _system_is_linux(sys: SystemProfile) -> bool:
    return (sys.os or "").lower() == "linux"

def _system_arch(sys: SystemProfile) -> str:
    return _normalize_arch(getattr(sys, "cpu_arch_normalized", None) or sys.architecture)

def _has_translation_risk_flags(bp: BinaryProfile) -> bool:
    return any(
        f.category == "translation" and f.severity in ("warn", "high")
        for f in (bp.flags or [])
    )

def _norm_interp(interp: Optional[str]) -> str:
    """
    Normalize interpreter names for policy rules.
    Examples:
      python3.12 -> python3
      python2.7  -> python2
      bash       -> bash
      sh         -> sh
      /usr/bin/python3 -> python3   (if it ever shows up)
    """
    if not interp:
        return ""

    s = str(interp).strip()
    s = os.path.basename(s)  # defensive

    # Collapse versioned python names
    if s.startswith("python2"):
        return "python2"
    if s.startswith("python3"):
        return "python3"
    if s == "python":
        # ambiguous; treat as legacy-ish
        return "python"

    # normalize common shells
    if s in ("bash", "sh", "dash", "zsh"):
        return s

    # perl variants
    if s.startswith("perl"):
        return "perl"

    return s

def _interp_family_for_report(r: BinaryCompatibilityReport) -> str:
    """
    Bucket interpreters into stable families for reporting.
    """
    if (r.format or "").upper() != "SCRIPT":
        return "non_script"

    raw = getattr(r, "script_interpreter", None)
    interp = _norm_interp(raw)

    if not interp:
        return "unknown"

    if interp in ("python3",):
        return "python3"
    if interp in ("python2", "python"):
        return "python2"
    if interp in ("sh", "bash", "dash", "zsh"):
        return "shell"
    if interp == "perl":
        return "perl"

    return "other"

def _command_available(name: str) -> bool:
    return shutil.which(name) is not None

def _interpreter_available(raw_interp: Optional[str]) -> bool:
    interp = _norm_interp(raw_interp)
    if not interp:
        return False

    candidates = [interp]
    if interp == "python3":
        candidates.extend(["python3", raw_interp or ""])
    elif interp == "python2":
        candidates.extend(["python2", raw_interp or ""])
    elif interp == "python":
        candidates.extend(["python", "python2", "python3"])
    elif interp == "perl":
        candidates.append("perl")
    elif interp in ("sh", "bash", "dash", "zsh"):
        candidates.append(interp)

    seen = set()
    for c in candidates:
        c = os.path.basename(str(c))
        if not c or c in seen:
            continue
        seen.add(c)
        if _command_available(c):
            return True
    return False

def _has_container_runtime(sys: SystemProfile) -> bool:
    return bool(getattr(sys, "docker_available", False) or getattr(sys, "podman_available", False))

def _container_runtime_name(sys: SystemProfile) -> str:
    if getattr(sys, "podman_available", False):
        return "podman"
    if getattr(sys, "docker_available", False):
        return "docker"
    return "container runtime"

def _host_can_run_elf_natively(sys: SystemProfile, bp: BinaryProfile) -> bool:
    host_arch = _system_arch(sys)
    os_bits = getattr(sys, "os_bitness", "unknown")
    if bp.arch == "unknown":
        return False
    if bp.arch == host_arch:
        if bp.bitness == "64-bit" and os_bits == "32-bit":
            return False
        return True
    if host_arch == "x86_64" and bp.arch == "x86" and bp.bitness == "32-bit":
        return bool(getattr(sys, "multiarch_available", False))
    return False

def _build_execution_plan(
    sys: SystemProfile,
    bp: BinaryProfile,
    recommended: StrategyOption,
    execution_path: Optional[str],
    verdict: str,
) -> Optional[ExecutionPlan]:
    path = bp.path
    artifact_class = getattr(bp, "artifact_class", "unknown")
    runtime = execution_path or recommended.name

    if verdict == "not_applicable":
        return ExecutionPlan(
            strategy="ignore",
            runtime="none",
            command=None,
            args=[],
            env={},
            working_directory=os.path.dirname(path) or None,
            notes=[
                f"Artifact class '{artifact_class}' is not bridge-relevant.",
                "No execution plan generated.",
            ],
        )

    if runtime == "wine":
        return ExecutionPlan(
            strategy="compat_layer",
            runtime="wine",
            command="wine",
            args=[path],
            env={"WINEPREFIX": os.path.expanduser("~/.wine")},
            working_directory=os.path.dirname(path) or None,
            notes=[
                "Validate DLL/runtime dependencies before production use.",
                "Prefer a dedicated Wine prefix for app-specific testing.",
            ],
        )

    if runtime == "native":
        return ExecutionPlan(
            strategy="native",
            runtime="host",
            command=path,
            args=[],
            env={},
            working_directory=os.path.dirname(path) or None,
            notes=["Run directly on the host with native dependencies available."],
        )

    if runtime == "native_multiarch":
        return ExecutionPlan(
            strategy="native_multiarch",
            runtime="host",
            command=path,
            args=[],
            env={},
            working_directory=os.path.dirname(path) or None,
            notes=[
                "Requires 32-bit userspace/runtime support on the host.",
                "Validate required 32-bit libraries before execution.",
            ],
        )

    if runtime == "containerize":
        container_runtime = "podman" if getattr(sys, "podman_available", False) else ("docker" if getattr(sys, "docker_available", False) else "container")
        image = "python:3.11-slim" if (bp.format == "SCRIPT" and (bp.script_interpreter or "").startswith("python")) else "ubuntu:24.04"
        filename = os.path.basename(path)
        mounted_dir = os.path.dirname(path) or "."
        command = container_runtime
        args = ["run", "--rm", "-v", f"{mounted_dir}:/workspace:Z", "-w", "/workspace", image]
        if bp.format == "SCRIPT":
            interp = os.path.basename(bp.script_interpreter or "sh")
            args.extend([interp, f"/workspace/{filename}"])
        else:
            args.extend([f"/workspace/{filename}"])
        return ExecutionPlan(
            strategy="containerize",
            runtime=container_runtime,
            command=command,
            args=args,
            env={},
            working_directory=mounted_dir,
            notes=[
                "Pin dependencies inside the container image.",
                "Adjust image selection for the actual runtime requirements.",
            ],
        )

    if runtime == "emulate":
        arch = bp.arch or "unknown"
        qemu_map = {
            "x86": "qemu-i386",
            "x86_64": "qemu-x86_64",
            "arm": "qemu-arm",
            "arm64": "qemu-aarch64",
        }
        qemu_bin = qemu_map.get(arch, "qemu-ARCH")
        return ExecutionPlan(
            strategy="emulate",
            runtime=qemu_bin,
            command=qemu_bin,
            args=[path],
            env={},
            working_directory=os.path.dirname(path) or None,
            notes=[
                "Provide the matching target userspace and dynamic libraries.",
                "User-space emulation may be slower than native or remote execution.",
            ],
        )

    if runtime == "remote_execute":
        return ExecutionPlan(
            strategy="remote_execute",
            runtime="ssh",
            command="ssh",
            args=["user@remote-host", path],
            env={},
            working_directory=os.path.dirname(path) or None,
            notes=[
                "Replace 'user@remote-host' with a real execution target.",
                "Use a host with matching architecture, OS, and runtime support.",
            ],
        )

    if runtime == "manual_review":
        return ExecutionPlan(
            strategy="manual_review",
            runtime="host",
            command="file",
            args=[path],
            env={},
            working_directory=os.path.dirname(path) or None,
            notes=[
                "Follow with readelf/objdump/strings as needed.",
                "Extend the detector when this format becomes important.",
            ],
        )

    if runtime == "ignore":
        return ExecutionPlan(
            strategy="ignore",
            runtime="none",
            command=None,
            args=[],
            env={},
            working_directory=os.path.dirname(path) or None,
            notes=["No execution plan generated for ignored artifacts."],
        )

    return ExecutionPlan(
        strategy=recommended.name,
        runtime=runtime,
        command=path if verdict in ("compatible", "compatible_with_changes") else None,
        args=[],
        env={},
        working_directory=os.path.dirname(path) or None,
        notes=["Generic execution plan generated; review before use."],
    )

def _evaluate_binary(sys: SystemProfile, bp: BinaryProfile) -> BinaryCompatibilityReport:
    host_os_linux = _system_is_linux(sys)
    host_arch = _system_arch(sys)
    host_bits = getattr(sys, "os_bitness", "unknown")

    fmt = bp.format or "UNKNOWN"
    bitness = bp.bitness or "unknown"
    arch = bp.arch or "unknown"

    blockers: List[CompatibilityBlocker] = []
    remediation_steps: List[str] = []
    risks: List[str] = []
    verdict: Literal["compatible", "compatible_with_changes", "incompatible_local", "remote_only", "unsupported", "not_applicable", "unknown"] = "unknown"

    if _has_translation_risk_flags(bp):
        risks.append("Binary flagged as packed/high-entropy; translation or introspection may be difficult.")

    rec = StrategyOption(
        name="unknown",
        confidence=0.30,
        rationale="Format/host combination not yet supported in v0.2 rule set.",
    )
    score = 0.30
    execution_path = None
    alts: List[StrategyOption] = []

    artifact_class = getattr(bp, "artifact_class", "unknown")
    should_evaluate = bool(getattr(bp, "should_evaluate", True))
    is_exec_candidate = bool(getattr(bp, "is_executable_candidate", False))

    if not should_evaluate:
        return BinaryCompatibilityReport(
            path=bp.path,
            format=fmt,
            bitness=bitness,
            arch=arch,
            script_interpreter=bp.script_interpreter,
            artifact_class=artifact_class,
            should_evaluate=False,
            verdict="not_applicable",
            compatibility_score=0.0,
            recommended=StrategyOption(
                name="reject",
                confidence=0.95,
                rationale="Artifact is not bridge-relevant for compatibility evaluation.",
            ),
            alternatives=[],
            blockers=[
                CompatibilityBlocker(
                    code="non_bridge_relevant_artifact",
                    message=f"Artifact class '{artifact_class}' is not a supported executable format.",
                    severity="soft",
                    remediation="Hide non-executable artifacts or scan an executable-focused directory.",
                )
            ],
            risks=risks,
            remediation_steps=["Ignore this artifact for bridge analysis."],
            execution_path="ignore",
            execution_plan=_build_execution_plan(sys, bp, StrategyOption(name="reject", confidence=0.95, rationale="Artifact is not bridge-relevant for compatibility evaluation."), "ignore", "not_applicable"),
        )

    if fmt == "UNKNOWN" and is_exec_candidate:
        return BinaryCompatibilityReport(
            path=bp.path,
            format=fmt,
            bitness=bitness,
            arch=arch,
            script_interpreter=bp.script_interpreter,
            artifact_class=artifact_class,
            should_evaluate=True,
            verdict="unsupported",
            compatibility_score=0.10,
            recommended=StrategyOption(
                name="reject",
                confidence=0.90,
                rationale="This artifact looks executable but its format is not recognized by the current detector.",
            ),
            alternatives=[],
            blockers=[
                CompatibilityBlocker(
                    code="unsupported_format",
                    message=f"Unsupported or unrecognized binary format: {fmt}.",
                    remediation="Inspect the binary manually or extend the detector for this format.",
                )
            ],
            risks=risks,
            remediation_steps=[
                "Inspect with file/readelf/objdump or extend the detector to classify this artifact."
            ],
            execution_path="manual_review",
            execution_plan=_build_execution_plan(
                sys,
                bp,
                StrategyOption(
                    name="reject",
                    confidence=0.90,
                    rationale="This artifact looks executable but its format is not recognized by the current detector.",
                ),
                "manual_review",
                "unsupported",
            ),
        )

    if fmt == "UNKNOWN" and not is_exec_candidate:
        return BinaryCompatibilityReport(
            path=bp.path,
            format=fmt,
            bitness=bitness,
            arch=arch,
            script_interpreter=bp.script_interpreter,
            artifact_class=artifact_class,
            should_evaluate=False,
            verdict="not_applicable",
            compatibility_score=0.0,
            recommended=StrategyOption(
                name="reject",
                confidence=0.95,
                rationale="Artifact is not bridge-relevant for compatibility evaluation.",
            ),
            alternatives=[],
            blockers=[
                CompatibilityBlocker(
                    code="non_executable_unknown_artifact",
                    message=f"Artifact class '{artifact_class}' is not a supported executable format.",
                    severity="soft",
                    remediation="Hide non-executable artifacts or scan an executable-focused directory.",
                )
            ],
            risks=risks,
            remediation_steps=["Ignore this artifact for bridge analysis."],
            execution_path="ignore",
            execution_plan=_build_execution_plan(
                sys,
                bp,
                StrategyOption(
                    name="reject",
                    confidence=0.95,
                    rationale="Artifact is not bridge-relevant for compatibility evaluation.",
                ),
                "ignore",
                "not_applicable",
            ),
        )

    elif fmt == "ELF":
        if not host_os_linux:
            verdict = "incompatible_local"
            blockers.append(CompatibilityBlocker(
                code="unsupported_host_os",
                message="ELF binaries in this rule set are only evaluated for Linux hosts.",
                remediation="Use a Linux host, Linux VM, or remote Linux execution target.",
            ))
            rec = StrategyOption(
                name="remote_execute",
                confidence=0.75,
                rationale="ELF binary detected on a non-Linux host; route to a Linux execution target.",
            )
            score = 0.25
            execution_path = "remote_execute"
            remediation_steps.append("Route this binary to a Linux VM or remote Linux host.")
        elif arch == host_arch and not (bitness == "64-bit" and host_bits == "32-bit"):
            verdict = "compatible"
            rec = StrategyOption(
                name="native",
                confidence=0.95,
                rationale="ELF binary matches host OS, architecture, and OS bitness constraints.",
            )
            score = 0.95
            execution_path = "native"
            alts = [
                StrategyOption(
                    name="containerize",
                    confidence=0.55,
                    rationale="Containerize for isolation or reproducibility.",
                ),
            ]
        elif host_arch == "x86_64" and arch == "x86" and bitness == "32-bit":
            if getattr(sys, "multiarch_available", False):
                verdict = "compatible_with_changes"
                rec = StrategyOption(
                    name="native_multiarch",
                    confidence=0.90,
                    rationale="32-bit x86 ELF detected on x86_64 Linux host with multiarch support available.",
                )
                score = 0.90
                execution_path = "native_multiarch"
                remediation_steps.append("Ensure required 32-bit userland libraries are installed.")
                alts = [
                    StrategyOption(
                        name="containerize",
                        confidence=0.65,
                        rationale="Containerize with a known-good 32-bit userspace and dependencies.",
                    ),
                ]
            else:
                verdict = "compatible_with_changes"
                blockers.append(CompatibilityBlocker(
                    code="multiarch_missing",
                    message="32-bit x86 ELF on x86_64 host requires 32-bit runtime support that does not appear to be installed.",
                    severity="soft",
                    remediation="Install 32-bit userspace libraries or run in a 32-bit container.",
                ))
                rec = StrategyOption(
                    name="containerize",
                    confidence=0.82,
                    rationale="Containerize with a 32-bit userspace because host multiarch support appears absent.",
                )
                score = 0.82
                execution_path = "containerize"
                remediation_steps.extend([
                    "Install 32-bit runtime support on the host if native execution is desired.",
                    f"Otherwise package the workload in {_container_runtime_name(sys)} with the required 32-bit libraries." if _has_container_runtime(sys) else "Install Podman or Docker and package the workload in a 32-bit userspace.",
                ])
                alts = [
                    StrategyOption(
                        name="emulate",
                        confidence=0.45,
                        rationale="Use emulation only if containerization or multiarch runtime support is not feasible.",
                    ),
                ]
        elif bitness == "64-bit" and host_bits == "32-bit":
            verdict = "remote_only"
            blockers.append(CompatibilityBlocker(
                code="os_bitness_mismatch",
                message="64-bit ELF cannot run on a 32-bit operating system.",
                remediation="Upgrade to a 64-bit OS if the CPU supports it, or route execution to a 64-bit host.",
            ))
            if getattr(sys, "cpu_supports_64bit", False):
                remediation_steps.append("This CPU appears to support 64-bit execution; reinstall or migrate to a 64-bit OS.")
            remediation_steps.append("Use remote execution on a 64-bit Linux system for this workload.")
            rec = StrategyOption(
                name="remote_execute",
                confidence=0.96,
                rationale="64-bit ELF on a 32-bit OS is a hard local blocker; route to a 64-bit execution target.",
            )
            score = 0.10
            execution_path = "remote_execute"
            alts = [
                StrategyOption(
                    name="vm",
                    confidence=0.40,
                    rationale="A local VM only helps if the host OS and hardware stack can actually support 64-bit virtualization.",
                ),
            ]
        elif arch != "unknown" and host_arch != "unknown" and arch != host_arch:
            if getattr(sys, "qemu_user_available", False):
                verdict = "compatible_with_changes"
                blockers.append(CompatibilityBlocker(
                    code="arch_mismatch",
                    message=f"ELF architecture mismatch: binary is {arch}, host is {host_arch}.",
                    severity="soft",
                    remediation="Use qemu-user or a compatible execution environment for this architecture.",
                ))
                rec = StrategyOption(
                    name="emulate",
                    confidence=0.78,
                    rationale="Architecture mismatch detected; qemu-user appears available for user-space emulation.",
                )
                score = 0.78
                execution_path = "emulate"
                remediation_steps.append("Use qemu-user with the correct target userspace and libraries.")
                alts = [
                    StrategyOption(
                        name="remote_execute",
                        confidence=0.72,
                        rationale="Remote execution on a native host remains a strong alternative.",
                    ),
                ]
            else:
                verdict = "remote_only"
                blockers.append(CompatibilityBlocker(
                    code="arch_mismatch",
                    message=f"ELF architecture mismatch: binary is {arch}, host is {host_arch}.",
                    remediation="Install qemu-user for this architecture or route execution to a native host.",
                ))
                rec = StrategyOption(
                    name="remote_execute",
                    confidence=0.88,
                    rationale="Architecture mismatch detected and qemu-user does not appear to be available locally.",
                )
                score = 0.22
                execution_path = "remote_execute"
                remediation_steps.append("Route execution to a host with native support for this architecture.")
                alts = [
                    StrategyOption(
                        name="containerize",
                        confidence=0.35,
                        rationale="Containerization alone will not solve a CPU architecture mismatch.",
                    ),
                ]
        else:
            verdict = "unknown"
            blockers.append(CompatibilityBlocker(
                code="insufficient_arch_data",
                message="Could not fully determine a safe local ELF execution path from available metadata.",
                severity="soft",
                remediation="Inspect binary dependencies, loader requirements, and host architecture details.",
            ))
            rec = StrategyOption(
                name="containerize",
                confidence=0.55,
                rationale="Package the runtime to reduce dependency uncertainty while you inspect the binary further.",
            )
            score = 0.55
            execution_path = "containerize"

    elif fmt == "PE":
        wine_ok = getattr(sys, "wine_available", False)
        if host_os_linux and wine_ok and not (bitness == "64-bit" and host_bits == "32-bit"):
            verdict = "compatible_with_changes"
            rec = StrategyOption(
                name="compat_layer",
                confidence=0.80,
                rationale="Windows PE detected on Linux host and Wine appears available.",
            )
            score = 0.80
            execution_path = "wine"
            remediation_steps.append("Validate DLL/runtime dependencies under Wine before production use.")
            risks.append("Windows binaries may require specific DLLs, registry expectations, services, or kernel-mode components.")
            alts = [
                StrategyOption(
                    name="vm",
                    confidence=0.62,
                    rationale="Use a Windows VM if Wine compatibility is insufficient.",
                ),
            ]
        else:
            verdict = "remote_only" if bitness == "64-bit" and host_bits == "32-bit" else "incompatible_local"
            if bitness == "64-bit" and host_bits == "32-bit":
                blockers.append(CompatibilityBlocker(
                    code="os_bitness_mismatch",
                    message="64-bit Windows binaries cannot run through local compat paths on a 32-bit OS.",
                    remediation="Use a 64-bit Windows or Linux host with the required compatibility tooling.",
                ))
            if not wine_ok:
                blockers.append(CompatibilityBlocker(
                    code="wine_unavailable",
                    message="Wine does not appear to be installed on this host.",
                    severity="soft",
                    remediation="Install Wine or route the workload to a Windows environment.",
                ))
            rec = StrategyOption(
                name="remote_execute",
                confidence=0.78,
                rationale="Local Windows compatibility path is not currently viable; route to a Windows host or VM.",
            )
            score = 0.28
            execution_path = "remote_execute"
            remediation_steps.extend([
                "Use a Windows VM or remote Windows host for the most reliable execution path.",
                "Install Wine only if this workload is user-space and known to be compatible.",
            ])
            risks.append("Some PE binaries depend on kernel drivers, COM registration, services, or exact Windows behavior.")

    elif fmt == "SCRIPT":
        interp_raw = getattr(bp, "script_interpreter", None)
        interp = _norm_interp(interp_raw)

        if not interp:
            verdict = "compatible_with_changes"
            blockers.append(CompatibilityBlocker(
                code="interpreter_unknown",
                message="Script detected but the interpreter could not be determined from the shebang.",
                severity="soft",
                remediation="Add an explicit shebang or package the script with a known-good runtime.",
            ))
            rec = StrategyOption(
                name="containerize",
                confidence=0.72,
                rationale="Interpreter is unknown; package a known runtime and dependencies.",
            )
            score = 0.72
            execution_path = "containerize"
            remediation_steps.append("Add a shebang and pin the interpreter/runtime in a container image.")
        elif _interpreter_available(interp_raw):
            verdict = "compatible" if interp not in ("python2", "python") else "compatible_with_changes"
            if interp in ("python2", "python"):
                blockers.append(CompatibilityBlocker(
                    code="legacy_interpreter",
                    message=f"Legacy interpreter detected ({interp_raw}).",
                    severity="soft",
                    remediation="Prefer an isolated or containerized runtime because legacy Python stacks are frequently brittle.",
                ))
                rec = StrategyOption(
                    name="containerize",
                    confidence=0.84,
                    rationale=f"Legacy interpreter detected ({interp_raw}); containerize to pin runtime and dependencies.",
                )
                score = 0.84
                execution_path = "containerize"
                remediation_steps.append("Package the legacy interpreter and dependencies in a dedicated container image.")
                alts = [
                    StrategyOption(
                        name="native",
                        confidence=0.55,
                        rationale="Run natively only if the required legacy interpreter is installed and isolated.",
                    ),
                ]
                risks.append("Legacy Python scripts may rely on EOL packages and may conflict with the system interpreter.")
            else:
                rec = StrategyOption(
                    name="native",
                    confidence=0.92 if interp == "python3" else 0.88,
                    rationale=f"Script interpreter appears to be installed locally ({interp_raw}).",
                )
                score = rec.confidence
                execution_path = "native"
                alts = [
                    StrategyOption(
                        name="containerize",
                        confidence=0.58,
                        rationale="Containerize to pin interpreter version and dependency graph.",
                    ),
                ]
                if interp == "perl":
                    risks.append("Perl scripts may rely on system Perl modules; verify module availability.")
        else:
            verdict = "compatible_with_changes"
            blockers.append(CompatibilityBlocker(
                code="missing_interpreter",
                message=f"Required interpreter does not appear to be installed locally ({interp_raw}).",
                remediation=f"Install the required interpreter ({interp}) or package the script with its runtime.",
            ))
            rec = StrategyOption(
                name="containerize",
                confidence=0.86,
                rationale=f"Required interpreter is missing locally; package the script with the {interp} runtime.",
            )
            score = 0.86
            execution_path = "containerize"
            remediation_steps.extend([
                f"Install the required interpreter locally: {interp_raw}.",
                f"Otherwise package the script using {_container_runtime_name(sys)} with a pinned runtime." if _has_container_runtime(sys) else "Install Podman or Docker and package the script with a pinned runtime.",
            ])
            alts = [
                StrategyOption(
                    name="native",
                    confidence=0.42,
                    rationale="Native execution is possible only after the required interpreter is installed.",
                ),
            ]

    else:
        verdict = "unknown"
        blockers.append(CompatibilityBlocker(
            code="unsupported_format",
            message=f"Unsupported or unrecognized binary format: {fmt}.",
            severity="soft",
            remediation="Inspect the binary manually or extend the detector for this format.",
        ))
        rec = StrategyOption(
            name="unknown",
            confidence=0.25,
            rationale="The format is unsupported or unrecognized by the current rule engine.",
        )
        score = 0.25

    if any(f.severity == "high" for f in (bp.flags or [])):
        score = max(0.0, score - 0.15)
        risks.append("High-severity flags present; reduce confidence and validate before execution.")
    elif any(f.severity == "warn" for f in (bp.flags or [])):
        score = max(0.0, score - 0.05)

    if verdict == "compatible" and blockers:
        verdict = "compatible_with_changes"
    if execution_path is None:
        execution_path = rec.name

    return BinaryCompatibilityReport(
        path=bp.path,
        format=fmt,
        bitness=bitness,
        arch=arch,
        script_interpreter=bp.script_interpreter,
        artifact_class=getattr(bp, "artifact_class", "unknown"),
        should_evaluate=bool(getattr(bp, "should_evaluate", True)),
        verdict=verdict,
        compatibility_score=round(score, 2),
        recommended=rec,
        alternatives=alts,
        blockers=blockers,
        risks=risks,
        remediation_steps=remediation_steps,
        execution_path=execution_path,
        execution_plan=_build_execution_plan(sys, bp, rec, execution_path, verdict),
    )
