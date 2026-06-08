# ews/autonomy.py
"""
Autonomy engine (baseline + drift + risk scoring) for Alma EWS.

Modes:
  - observe: learn + score, but do not suggest actions
  - advise:  learn + score + suggest actions (no auto execution)
  - execute: learn + score + suggest + (future) execute playbooks

Right now we only implement observe/advise behavior.
"""

from __future__ import annotations
import os
import threading
import math
import time
from typing import Dict, Optional, Any

_BASELINE_LOCK = threading.Lock()

# We keep a simple rolling baseline per metric
_BASELINE: Dict[str, Dict[str, float]] = {
    # keys: mean, m2 (for variance), count
    "cpu": {"mean": 0.0, "m2": 0.0, "count": 0.0},
    "mem_percent": {"mean": 0.0, "m2": 0.0, "count": 0.0},
    "net_sent_mb": {"mean": 0.0, "m2": 0.0, "count": 0.0},
    "net_recv_mb": {"mean": 0.0, "m2": 0.0, "count": 0.0},
    "procs": {"mean": 0.0, "m2": 0.0, "count": 0.0},
}

_LAST_REPORT: Optional[Dict[str, Any]] = None


def _welford_update(state: Dict[str, float], value: float) -> None:
    """
    Online mean/std update using Welford's algorithm.
    """
    count = state["count"] + 1.0
    delta = value - state["mean"]
    mean = state["mean"] + delta / count
    delta2 = value - mean
    m2 = state["m2"] + delta * delta2

    state["count"] = count
    state["mean"] = mean
    state["m2"] = m2


def _welford_stats(state: Dict[str, float]) -> Dict[str, float]:
    count = state["count"]
    if count < 2:
        return {"mean": state["mean"], "std": 0.0}
    variance = state["m2"] / (count - 1.0)
    std = math.sqrt(variance) if variance > 0 else 0.0
    return {"mean": state["mean"], "std": std}


def _safe_z(value: float, mean: float, std: float) -> float:
    if std <= 1e-6:
        # If std is ~0, treat tiny deviations as z≈0, large as big spike
        delta = abs(value - mean)
        if delta < 1.0:
            return 0.0
        # crude fallback: each 10% away from mean ~ 1σ
        return math.copysign(delta / max(abs(mean), 1.0) * 10.0, value - mean)
    return (value - mean) / std


def _env_profile() -> str:
    return os.environ.get("ALMA_POLICY_PROFILE", "school").lower()


def _env_mode() -> str:
    return os.environ.get("ALMA_AUTONOMY_MODE", "observe").lower()


def update_baseline(snapshot: Dict[str, Any]) -> None:
    """
    Feed telemetry snapshots into the baseline model.
    Safe to call on every snapshot, regardless of profile.
    """
    cpu = float(snapshot.get("cpu") or 0.0)

    mem = snapshot.get("memory") or {}
    mem_percent = float(mem.get("percent") or 0.0)

    net = snapshot.get("network") or {}
    sent_mb = float(net.get("sent_mb") or 0.0)
    recv_mb = float(net.get("recv_mb") or 0.0)

    procs = snapshot.get("processes") or {}
    total_procs = float(procs.get("total_processes") or 0.0)

    with _BASELINE_LOCK:
        _welford_update(_BASELINE["cpu"], cpu)
        _welford_update(_BASELINE["mem_percent"], mem_percent)
        _welford_update(_BASELINE["net_sent_mb"], sent_mb)
        _welford_update(_BASELINE["net_recv_mb"], recv_mb)
        _welford_update(_BASELINE["procs"], total_procs)


def get_baseline() -> Dict[str, Dict[str, float]]:
    """
    Returns current mean/std baseline snapshot.
    """
    with _BASELINE_LOCK:
        out: Dict[str, Dict[str, float]] = {}
        for k, st in _BASELINE.items():
            stats = _welford_stats(st)
            out[k] = {"mean": round(stats["mean"], 3), "std": round(stats["std"], 3), "count": st["count"]}
        return out


def analyze_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compute drift z-scores and a unified risk score.
    Stores and returns a structured "autonomy report".
    """
    cpu = float(snapshot.get("cpu") or 0.0)
    mem = float((snapshot.get("memory") or {}).get("percent") or 0.0)
    net = snapshot.get("network") or {}
    sent_mb = float(net.get("sent_mb") or 0.0)
    recv_mb = float(net.get("recv_mb") or 0.0)
    procs = float((snapshot.get("processes") or {}).get("total_processes") or 0.0)

    baseline = get_baseline()

    cpu_z = _safe_z(cpu, baseline["cpu"]["mean"], baseline["cpu"]["std"])
    mem_z = _safe_z(mem, baseline["mem_percent"]["mean"], baseline["mem_percent"]["std"])
    sent_z = _safe_z(sent_mb, baseline["net_sent_mb"]["mean"], baseline["net_sent_mb"]["std"])
    recv_z = _safe_z(recv_mb, baseline["net_recv_mb"]["mean"], baseline["net_recv_mb"]["std"])
    procs_z = _safe_z(procs, baseline["procs"]["mean"], baseline["procs"]["std"])

    # crude risk weighting; tune as needed
    risk = 0.0
    contrib = {}

    def add_risk(name: str, z: float, weight: float):
        nonlocal risk
        score = max(0.0, min(weight * max(0.0, abs(z) - 1.0), weight * 3.0))
        risk += score
        contrib[name] = round(score, 1)

    add_risk("cpu", cpu_z, 20.0)
    add_risk("memory", mem_z, 20.0)
    add_risk("net_sent", sent_z, 20.0)
    add_risk("net_recv", recv_z, 20.0)
    add_risk("procs", procs_z, 20.0)

    # normalize to 0–100
    risk_score = max(0.0, min(risk, 100.0))

    # high-level band
    if risk_score < 15:
        band = "low"
    elif risk_score < 40:
        band = "elevated"
    elif risk_score < 70:
        band = "high"
    else:
        band = "critical"

    advice: list[Dict[str, str]] = []

    def add_advice(cond: bool, severity: str, msg: str):
        if cond:
            advice.append({"severity": severity, "message": msg})

    add_advice(
        abs(cpu_z) >= 3.0,
        "warn",
        f"CPU usage drift is high (z={cpu_z:.1f}); recommend inspecting top processes before load increases further.",
    )
    add_advice(
        abs(mem_z) >= 3.0,
        "warn",
        f"Memory usage drift is high (z={mem_z:.1f}); consider checking for leaks or runaway services.",
    )
    add_advice(
        abs(sent_z) >= 3.0 or abs(recv_z) >= 3.0,
        "warn",
        f"Network activity shows strong deviation (sent_z={sent_z:.1f}, recv_z={recv_z:.1f}); verify no unexpected data transfer.",
    )
    add_advice(
        abs(procs_z) >= 3.0,
        "warn",
        f"Process count drift is high (z={procs_z:.1f}); review new or unexpected processes.",
    )

    # Baseline not "mature" yet?
    warmup = baseline["cpu"]["count"] < 30  # ~30 samples
    if warmup:
        advice.insert(0, {
            "severity": "info",
            "message": "Autonomy baseline is still warming up; risk judgments may be noisy.",
        })

    report = {
        "timestamp": snapshot.get("timestamp"),
        "mode": _env_mode(),
        "profile": _env_profile(),
        "risk_score": round(risk_score, 1),
        "risk_band": band,
        "z_scores": {
            "cpu": round(cpu_z, 2),
            "memory": round(mem_z, 2),
            "net_sent": round(sent_z, 2),
            "net_recv": round(recv_z, 2),
            "procs": round(procs_z, 2),
        },
        "contributions": contrib,
        "baseline": baseline,
        "advice": advice,
    }

    global _LAST_REPORT
    _LAST_REPORT = report
    return report


def handle_snapshot(snapshot: Dict[str, Any]) -> None:
    """
    Called by the analyzer for each telemetry snapshot.
    In advisory mode, this will print what Alma *would* do.
    """
    update_baseline(snapshot)

    if _env_profile() != "auto":
        return  # autonomy is only "active" in auto profile

    mode = _env_mode()
    report = analyze_snapshot(snapshot)

    # observe: just keep latest report, do not log noisy spam
    if mode == "observe":
        return

    if mode == "advise":
        # For now, advisory = log-only, no automatic playbooks.
        msg = (f"[AUTONOMY-ADVISE] risk={report['risk_score']:.1f} "
               f"band={report['risk_band']} advice_count={len(report['advice'])}")
        print(msg)
        for item in report["advice"][:3]:
            print(f"    - ({item['severity']}) {item['message']}")
        return

    if mode == "execute":
        # Future: here we would translate report into concrete playbook calls.
        # For now, behave like advise (log only) to stay safe.
        print(f"[AUTONOMY-EXECUTE-STUB] risk={report['risk_score']:.1f} band={report['risk_band']}")
        for item in report["advice"][:3]:
            print(f"    - ({item['severity']}) {item['message']}")
        return


def get_latest_report() -> Optional[Dict[str, Any]]:
    return _LAST_REPORT
