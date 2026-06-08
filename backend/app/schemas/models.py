from __future__ import annotations

from typing import Literal, List, Dict, Optional
from pydantic import BaseModel, Field

SchemaVersion = Literal["0.2"]

class SystemProfile(BaseModel):
    schema_version: SchemaVersion = "0.2"
    os: str
    os_version: str
    distribution: Optional[str] = None
    architecture: str
    machine: Optional[str] = None
    cpu: str
    cpu_cores: int
    ram_total_mb: Optional[int] = None

    cpu_arch_normalized: str = "unknown"
    os_bitness: Literal["32-bit", "64-bit", "unknown"] = "unknown"
    cpu_supports_64bit: Optional[bool] = None
    multiarch_available: Optional[bool] = None
    wine_available: bool = False
    qemu_user_available: bool = False
    qemu_system_available: bool = False
    docker_available: bool = False
    podman_available: bool = False

class ScanPolicy(BaseModel):
    folder: str
    arch_filter: Literal["all", "32-bit", "64-bit", "unknown"] = "all"
    limit: int = 100000
    forensic: bool = False
    exclude_dirs: List[str] = Field(default_factory=list)

class BinaryFlag(BaseModel):
    code: str
    message: str
    severity: Literal["info", "warn", "high"] = "info"
    category: Literal["compat", "security", "translation", "unknown"] = "unknown"

class BinaryProfile(BaseModel):
    schema_version: SchemaVersion = "0.2"
    path: str
    filename: str
    size_bytes: Optional[int] = None
    last_modified_epoch: Optional[float] = None

    format: Literal["ELF", "PE", "SCRIPT", "UNKNOWN"] = "UNKNOWN"
    bitness: Literal["32-bit", "64-bit", "unknown"] = "unknown"
    arch: str = "unknown"  # normalized: x86, x86_64, arm64, etc.
    script_interpreter: Optional[str] = None
    target_os_guess: Optional[str] = None
    format_detail: Optional[str] = None  # magic-derived label (e.g. "ELF 64-bit", "PE32+")
    entropy: Optional[float] = None

    artifact_class: str = "unknown"
    is_executable_candidate: bool = False
    should_evaluate: bool = True

    flags: List[BinaryFlag] = Field(default_factory=list)

class ScanRunMetadata(BaseModel):
    schema_version: SchemaVersion = "0.2"
    total_seen: int = 0
    binary_count: int = 0
    duration_ms: Optional[int] = None
    used_cache: bool = False
    errors: List[str] = Field(default_factory=list)

class InsightScanResult(BaseModel):
    schema_version: SchemaVersion = "0.2"
    system: SystemProfile
    policy: ScanPolicy
    metadata: ScanRunMetadata
    binaries: List[BinaryProfile] = Field(default_factory=list)

class StrategyOption(BaseModel):
    name: Literal[
        "native",
        "native_multiarch",
        "compat_layer",
        "containerize",
        "emulate",
        "translate",
        "remote_execute",
        "vm",
        "rebuild",
        "reject",
        "unknown",
    ]
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    rationale: str

class CompatibilityBlocker(BaseModel):
    code: str
    message: str
    severity: Literal["hard", "soft"] = "hard"
    remediation: Optional[str] = None

class ExecutionPlan(BaseModel):
    strategy: str
    runtime: Optional[str] = None
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    env: Dict[str, str] = Field(default_factory=dict)
    working_directory: Optional[str] = None
    notes: List[str] = Field(default_factory=list)

class BinaryCompatibilityReport(BaseModel):
    schema_version: SchemaVersion = "0.2"
    path: str
    format: str
    bitness: str
    arch: str

    script_interpreter: Optional[str] = None
    artifact_class: str = "unknown"
    should_evaluate: bool = True

    verdict: Literal[
        "compatible",
        "compatible_with_changes",
        "incompatible_local",
        "remote_only",
        "unsupported",
        "not_applicable",
        "unknown",
    ] = "unknown"
    compatibility_score: float = Field(ge=0.0, le=1.0, default=0.0)
    recommended: StrategyOption
    alternatives: List[StrategyOption] = Field(default_factory=list)
    blockers: List[CompatibilityBlocker] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    remediation_steps: List[str] = Field(default_factory=list)
    execution_path: Optional[str] = None
    execution_plan: Optional[ExecutionPlan] = None

class CompatibilityReport(BaseModel):
    schema_version: SchemaVersion = "0.2"
    system: SystemProfile
    evaluated_count: int
    recommended_counts: Dict[str, int]

    # breakdown of SCRIPT interpreter families + non-script bucket
    interpreter_counts: Dict[str, int] = Field(default_factory=dict)
    artifact_class_counts: Dict[str, int] = Field(default_factory=dict)
    bridge_relevant_count: int = 0

    binaries: List[BinaryCompatibilityReport] = Field(default_factory=list)

class HostCapabilities(BaseModel):
    schema_version: SchemaVersion = "0.2"
    wine_available: bool = False
    qemu_user_available: bool = False
    qemu_system_available: bool = False
    docker_available: bool = False
    podman_available: bool = False
    multiarch_available: Optional[bool] = None
    cpu_supports_64bit: Optional[bool] = None
    os_bitness: Literal["32-bit", "64-bit", "unknown"] = "unknown"
    cpu_arch_normalized: str = "unknown"

class EWSSnapshot(BaseModel):
    timestamp: str
    cpu: float
    memory: Dict[str, float | int]
    disk: Dict[str, float | int]
    network: Dict[str, float | int]
    processes: Dict[str, int]

class EWSAuthorizeRequest(BaseModel):
    risk_band: Literal["low", "elevated", "high", "critical"]
    risk_score: float

class AIScanRequest(BaseModel):
    folder: str
    arch_filter: Literal["all", "32-bit", "64-bit", "unknown"] = "all"
    limit: int = 100000
    forensic: bool = False

class InsightScanRequest(BaseModel):
    folder: str
    arch_filter: Literal["all", "32-bit", "64-bit", "unknown"] = "all"
    limit: int = 100000
    forensic: bool = False
