from __future__ import annotations

import inspect
import os
import time
import threading
import traceback

from fastapi import APIRouter
from app.schemas.models import EWSSnapshot, EWSAuthorizeRequest

try:
    import ews.telemetry as telemetry_module

    from ews.analyzer import process as analyze
    from ews.autonomy import get_latest_report

    telemetry_start = telemetry_module.start
    telemetry_stop = telemetry_module.stop
    stream = telemetry_module.stream
    get_latest_snapshot = telemetry_module.get_latest_snapshot

    print("EWS telemetry module loaded from:", inspect.getfile(telemetry_module))

    EWS_AVAILABLE = True
    EWS_IMPORT_ERROR = None

except Exception as exc:
    EWS_AVAILABLE = False
    EWS_IMPORT_ERROR = str(exc)

    analyze = None

    def get_latest_report():
        return None

    def telemetry_start(interval=3.0):
        return None

    def telemetry_stop():
        return None

    def stream():
        return []

    def get_latest_snapshot():
        return None


router = APIRouter(tags=["ews"])

_EWS_THREAD_STARTED = False
_EWS_THREAD_LOCK = threading.Lock()


def _ews_loop():
    if analyze is None:
        print("EWS analyzer unavailable. Loop not started.")
        return

    try:
        print("EWS analyzer loop started.")
        for snapshot in stream():
            if snapshot is None:
                continue
            analyze(snapshot)

    except Exception as exc:
        print("EWS LOOP ERROR:", exc)
        traceback.print_exc()


def start_ews_background():
    global _EWS_THREAD_STARTED

    with _EWS_THREAD_LOCK:
        if _EWS_THREAD_STARTED:
            print("EWS background thread already started.")
            return

        if not EWS_AVAILABLE:
            print("EWS unavailable:", EWS_IMPORT_ERROR)
            return

        print("Starting telemetry subsystem...")
        telemetry_start(interval=3.0)
        print("Telemetry subsystem started.")

        initial_snapshot = get_latest_snapshot()
        print("Initial telemetry snapshot:", initial_snapshot)

        thread = threading.Thread(
            target=_ews_loop,
            name="EWS-Analyzer-Thread",
            daemon=True,
        )
        thread.start()

        _EWS_THREAD_STARTED = True


def stop_ews_background():
    try:
        telemetry_stop()
        print("Telemetry subsystem stopped.")
    except Exception as exc:
        print("Telemetry stop error:", exc)


@router.get("/api/ews/autonomy")
def api_ews_autonomy():
    report = get_latest_report()
    if not report:
        return {"detail": "no autonomy report yet"}
    return report


@router.post("/api/ews/authorize")
def ews_authorize(payload: EWSAuthorizeRequest):
    if payload.risk_band == "low":
        return {"detail": "Authorization ignored: risk level is LOW. No action required."}

    if payload.risk_band == "critical":
        return {"detail": "Authorization blocked: CRITICAL risk requires manual review."}

    approval_record = {
        "approved": True,
        "risk_band": payload.risk_band,
        "risk_score": payload.risk_score,
        "timestamp": time.time(),
        "mode": "advisory_only",
    }

    return {
        "detail": (
            f"Authorization accepted in ADVISORY MODE. "
            f"Risk={payload.risk_band.upper()} | Score={payload.risk_score}. "
            f"No automatic system actions were executed."
        ),
        "record": approval_record,
    }


@router.get("/api/ews/telemetry", response_model=EWSSnapshot | None)
async def api_ews_telemetry():
    snapshot = get_latest_snapshot()

    if snapshot is None:
        print("Telemetry endpoint called, but latest snapshot is None.")

    return snapshot


@router.get("/api/ews/profile")
async def api_ews_profile():
    return {"profile": os.getenv("ALMA_POLICY_PROFILE", "lab")}
