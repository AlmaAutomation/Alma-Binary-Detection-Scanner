from __future__ import annotations

import os, asyncio
from fastapi import APIRouter
from app.schemas.models import AIScanRequest
from app.scanning.detectors import is_excluded
from app.core.system import _system_info_dict
from app.scanning.scanner import _scan_files_legacy
from app.ml.analysis import _summarize_scan_for_ai, _ai_analyze_scan

router = APIRouter(tags=["ml"] )

@router.get("/ml/health")
def ml_health():
    return {"module": "ml", "status": "ready"}

@router.post("/ai/scan_and_analyze")
async def ai_scan_and_analyze(payload: AIScanRequest):
    if not payload.folder or not os.path.isdir(payload.folder) or is_excluded(payload.folder):
        empty_scan = {"system_info": _system_info_dict(), "binary_count": 0, "total_seen": 0, "binaries": []}
        summary = _summarize_scan_for_ai(empty_scan, payload.folder, payload.arch_filter, payload.limit, forensic=payload.forensic)
        text = await _ai_analyze_scan(summary, empty_scan)
        return {"scan": empty_scan, "summary": summary, "ai_analysis": text}
    timeout = 900 if payload.forensic else 300
    try:
        legacy, used_cache, _dur = await asyncio.wait_for(asyncio.to_thread(_scan_files_legacy, payload.folder, payload.arch_filter, payload.limit, payload.forensic), timeout=timeout)
        summary = _summarize_scan_for_ai(legacy, payload.folder, payload.arch_filter, payload.limit, forensic=payload.forensic)
        text = await _ai_analyze_scan(summary, legacy)
        return {"scan": legacy, "summary": summary, "ai_analysis": text}
    except Exception:
        empty_scan = {"system_info": _system_info_dict(), "binary_count": 0, "total_seen": 0, "binaries": []}
        summary = _summarize_scan_for_ai(empty_scan, payload.folder, payload.arch_filter, payload.limit, forensic=payload.forensic)
        text = await _ai_analyze_scan(summary, empty_scan)
        return {"scan": empty_scan, "summary": summary, "ai_analysis": text}
