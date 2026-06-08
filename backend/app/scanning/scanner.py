from __future__ import annotations

import os, time, threading
from typing import Literal, List, Dict, Any, Tuple
from app.schemas.models import ScanPolicy, InsightScanResult, ScanRunMetadata, BinaryProfile
from app.scanning.detectors import (EXCLUDE_DIRS, is_excluded, _iter_files, _detect_binary_header, _os_type_entropy, _classify_artifact, _flags_from_anomalies)
from app.core.system import _system_info_dict, _system_profile

_CACHE: Dict[str, Any] = {}
_CACHE_LOCK = threading.Lock()
_STATS = {"tp": 0, "fp": 0, "fn": 0}
_STATS_LOCK = threading.Lock()

def _record_detection(arch: str) -> None:
    with _STATS_LOCK:
        if arch in ("32-bit", "64-bit"):
            _STATS["tp"] += 1
        elif arch == "unknown":
            _STATS["fp"] += 1
        else:
            _STATS["fn"] += 1

def _recompute_metrics() -> Dict[str, float]:
    tp, fp, fn = _STATS["tp"], _STATS["fp"], _STATS["fn"]
    precision = (tp / (tp + fp)) if (tp + fp) else 0.0
    recall    = (tp / (tp + fn)) if (tp + fn) else 0.0
    f1        = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return {"precision": round(precision, 2), "recall": round(recall, 2), "f1": round(f1, 2)}

def _scan_files_legacy(
    folder: str,
    arch_filter: Literal["all","32-bit","64-bit","unknown"],
    limit: int,
    forensic: bool = False,
) -> Tuple[Dict[str, Any], bool, int]:
    """
    Returns (legacy_result, used_cache, duration_ms)
    """
    limit = max(0, int(limit))
    cache_key = f"{folder}|{arch_filter}|{limit}|{forensic}"

    if not forensic:
        with _CACHE_LOCK:
            cached = _CACHE.get(cache_key)
        if cached:
            return cached, True, 0

    start = time.time()

    bins: List[Dict[str, Any]] = []
    if is_excluded(folder) or not os.path.isdir(folder):
        return {
            "system_info": _system_info_dict(),
            "binary_count": 0,
            "total_seen": 0,
            "binaries": [],
        }, False, int((time.time() - start) * 1000)

    total_seen = 0
    kept = 0

    for path in _iter_files(folder, forensic=forensic):
        try:
            st = os.stat(path)
            if st.st_size < 5:
                continue
        except Exception:
            continue

        total_seen += 1

        fmt, bitness, arch_norm, interp = _detect_binary_header(path)
        arch = bitness  # preserve existing behavior for filters + UI

        _record_detection(arch)

        if arch_filter != "all" and not (
            arch.lower() == arch_filter.lower()
            or (arch_filter == "unknown" and arch not in ("64-bit", "32-bit"))
        ):
            continue

        if fmt == "SCRIPT":
            os_guess, file_type, entropy, anomalies = ("Linux", "Script", None, [])
        else:
            os_guess, file_type, entropy, anomalies = _os_type_entropy(path)

        try:
            if (arch == "64-bit") and (st.st_size < 1024):
                anomalies.append("Unusually small file for 64-bit binary (<1 KB)")
        except Exception:
            pass

        artifact_class, is_exec_candidate, should_evaluate = _classify_artifact(path, fmt, interp, st)

        bins.append({
            # legacy fields
            "architecture": arch,
            "path": path,
            "file": os.path.basename(path),
            "os": os_guess,
            "file_type": file_type,
            "file_entropy": entropy,
            "anomalies": anomalies,
            # new additive fields (should not break UI)
            "format": fmt,
            "arch_norm": arch_norm,
            "bitness": bitness,
            "size_bytes": getattr(st, "st_size", None),
            "mtime_epoch": getattr(st, "st_mtime", None),
            "script_interpreter": interp,
            "artifact_class": artifact_class,
            "is_executable_candidate": is_exec_candidate,
            "should_evaluate": should_evaluate,
        })

        kept += 1
        if limit and kept >= limit:
            break

    result = {
        "system_info": _system_info_dict(),
        "binary_count": len(bins),
        "total_seen": total_seen,
        "binaries": bins,
    }

    duration_ms = int((time.time() - start) * 1000)

    if not forensic:
        with _CACHE_LOCK:
            _CACHE[cache_key] = result

    return result, False, duration_ms

def _legacy_to_insight(
    legacy: Dict[str, Any],
    policy: ScanPolicy,
    used_cache: bool,
    duration_ms: int,
) -> InsightScanResult:
    sys = _system_profile()
    meta = ScanRunMetadata(
        total_seen=int(legacy.get("total_seen") or 0),
        binary_count=int(legacy.get("binary_count") or 0),
        duration_ms=duration_ms,
        used_cache=used_cache,
        errors=[],
    )

    binaries: List[BinaryProfile] = []
    for b in (legacy.get("binaries") or []):
        anomalies = b.get("anomalies") or []
        
        flags = _flags_from_anomalies(anomalies)

        binaries.append(BinaryProfile(
            path=str(b.get("path") or ""),
            filename=str(b.get("file") or os.path.basename(str(b.get("path") or ""))),
            size_bytes=b.get("size_bytes"),
            last_modified_epoch=b.get("mtime_epoch"),
            format=b.get("format") or "UNKNOWN",
            bitness=b.get("bitness") or b.get("architecture") or "unknown",
            arch=b.get("arch_norm") or "unknown",
            target_os_guess=b.get("os"),
            format_detail=b.get("file_type"),
            entropy=b.get("file_entropy"),
            script_interpreter=b.get("script_interpreter"),
            artifact_class=b.get("artifact_class") or "unknown",
            is_executable_candidate=bool(b.get("is_executable_candidate")),
            should_evaluate=bool(b.get("should_evaluate", True)),
            flags=flags,
        ))

    return InsightScanResult(
        system=sys,
        policy=policy,
        metadata=meta,
        binaries=binaries,
    )
