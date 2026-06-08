from __future__ import annotations

import os, platform, multiprocessing, shutil
from typing import Literal, Dict, Any, Optional
from app.schemas.models import SystemProfile

def _normalize_arch(value: Optional[str]) -> str:
    a = (value or "").lower()
    if "x86_64" in a or "amd64" in a:
        return "x86_64"
    if a in ("x86", "i386", "i686"):
        return "x86"
    if "aarch64" in a or "arm64" in a:
        return "arm64"
    if "arm" in a:
        return "arm"
    if "mips" in a:
        return "mips"
    return "unknown"

def _os_bitness() -> Literal["32-bit", "64-bit", "unknown"]:
    arch_bits = platform.architecture()[0]
    if arch_bits in ("32bit", "64bit"):
        return "64-bit" if arch_bits == "64bit" else "32-bit"
    machine = platform.machine().lower()
    if any(x in machine for x in ("x86_64", "amd64", "aarch64", "arm64")):
        return "64-bit"
    if any(x in machine for x in ("i386", "i686", "x86", "armv7", "armv6")):
        return "32-bit"
    return "unknown"

def _cpu_supports_64bit() -> Optional[bool]:
    machine = platform.machine().lower()
    if any(x in machine for x in ("x86_64", "amd64", "aarch64", "arm64", "ppc64", "mips64")):
        return True
    if any(x in machine for x in ("i386", "i686", "x86", "armv7", "armv6")):
        return False
    return None

def _probe_multiarch_support(host_arch: str, os_bitness: str) -> Optional[bool]:
    if os_bitness != "64-bit":
        return False
    if host_arch != "x86_64":
        return None
    candidates = [
        "/lib/ld-linux.so.2",
        "/lib32/ld-linux.so.2",
        "/usr/lib32",
        "/lib/i386-linux-gnu/ld-linux.so.2",
        "/usr/lib/i386-linux-gnu",
    ]
    return any(os.path.exists(p) for p in candidates)

def _host_capabilities() -> Dict[str, Any]:
    cpu_arch = _normalize_arch(platform.machine() or platform.processor() or "")
    os_bits = _os_bitness()
    return {
        "wine_available": shutil.which("wine") is not None,
        "qemu_user_available": any(shutil.which(x) for x in ("qemu-x86_64", "qemu-i386", "qemu-aarch64", "qemu-arm")),
        "qemu_system_available": any(shutil.which(x) for x in ("qemu-system-x86_64", "qemu-system-aarch64", "qemu-system-arm")),
        "docker_available": shutil.which("docker") is not None,
        "podman_available": shutil.which("podman") is not None,
        "multiarch_available": _probe_multiarch_support(cpu_arch, os_bits),
        "cpu_supports_64bit": _cpu_supports_64bit(),
        "os_bitness": os_bits,
        "cpu_arch_normalized": cpu_arch,
    }

def _system_info_dict() -> Dict[str, Any]:
    try:
        import distro
        dist = distro.name(pretty=True)
    except Exception:
        dist = None

    caps = _host_capabilities()
    return {
        "os": platform.system(),
        "os_version": platform.version(),
        "architecture": platform.machine() or platform.processor() or "unknown",
        "machine": platform.machine(),
        "cpu": platform.processor() or "Unknown CPU",
        "cpu_cores": multiprocessing.cpu_count(),
        "ram_total_mb": None,
        "distribution": dist,
        **caps,
    }

def _system_profile() -> SystemProfile:
    d = _system_info_dict()
    return SystemProfile(
        os=d["os"],
        os_version=d["os_version"],
        architecture=d["architecture"],
        machine=d.get("machine"),
        cpu=d["cpu"],
        cpu_cores=d["cpu_cores"],
        ram_total_mb=d.get("ram_total_mb"),
        distribution=d.get("distribution"),
        cpu_arch_normalized=d.get("cpu_arch_normalized", "unknown"),
        os_bitness=d.get("os_bitness", "unknown"),
        cpu_supports_64bit=d.get("cpu_supports_64bit"),
        multiarch_available=d.get("multiarch_available"),
        wine_available=bool(d.get("wine_available", False)),
        qemu_user_available=bool(d.get("qemu_user_available", False)),
        qemu_system_available=bool(d.get("qemu_system_available", False)),
        docker_available=bool(d.get("docker_available", False)),
        podman_available=bool(d.get("podman_available", False)),
    )
