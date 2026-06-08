from __future__ import annotations

import os, asyncio
from typing import Literal
from fastapi import APIRouter, Query
from app.schemas.models import InsightScanRequest, ScanPolicy, InsightScanResult
from app.scanning.detectors import is_excluded, EXCLUDE_DIRS
from app.scanning.scanner import _scan_files_legacy, _legacy_to_insight
from app.core.system import _system_info_dict

router = APIRouter(tags=["scan"])

@router.get("/scan")
async def scan(folder: str = Query(..., description="Folder to scan, e.g. /usr/bin"), arch_filter: Literal["all", "32-bit", "64-bit", "unknown"] = "all", limit: int = 100000, forensic: bool = False):
    if not folder or not os.path.isdir(folder) or is_excluded(folder):
        return {"system_info": _system_info_dict(), "binaries": []}
    timeout = 900 if forensic else 300
    try:
        legacy, used_cache, _dur = await asyncio.wait_for(asyncio.to_thread(_scan_files_legacy, folder, arch_filter, limit, forensic), timeout=timeout)
        return legacy
    except Exception:
        return {"system_info": _system_info_dict(), "binaries": []}

@router.post("/insight/scan", response_model=InsightScanResult)
async def insight_scan(payload: InsightScanRequest):
    policy = ScanPolicy(folder=payload.folder, arch_filter=payload.arch_filter, limit=payload.limit, forensic=payload.forensic, exclude_dirs=sorted(list(EXCLUDE_DIRS)))
    if not payload.folder or not os.path.isdir(payload.folder) or is_excluded(payload.folder):
        empty = {"system_info": _system_info_dict(), "binary_count": 0, "total_seen": 0, "binaries": []}
        return _legacy_to_insight(empty, policy, used_cache=False, duration_ms=0)
    timeout = 900 if payload.forensic else 300
    try:
        legacy, used_cache, duration_ms = await asyncio.wait_for(asyncio.to_thread(_scan_files_legacy, payload.folder, payload.arch_filter, payload.limit, payload.forensic), timeout=timeout)
        return _legacy_to_insight(legacy, policy, used_cache=used_cache, duration_ms=duration_ms)
    except Exception as e:
        empty = {"system_info": _system_info_dict(), "binary_count": 0, "total_seen": 0, "binaries": []}
        res = _legacy_to_insight(empty, policy, used_cache=False, duration_ms=0)
        res.metadata.errors.append(str(e))
        return res

@router.get("/scan/health")
def scan_health():
    return {"module": "scan", "status": "ready"}
