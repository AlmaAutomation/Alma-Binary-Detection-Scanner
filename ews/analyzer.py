# almasysdet/ews/analyzer.py

import hashlib
from datetime import datetime, timezone
from typing import Dict, Optional

from ews.dispatcher import dispatch
from ews.models import EWSEvent
from ews.autonomy import handle_snapshot

# =========================
# DEFAULT DETECTION THRESHOLDS
# =========================

CPU_HIGH_THRESHOLD = 85.0          # %
CPU_CRITICAL_THRESHOLD = 95.0      # %

MEMORY_HIGH_THRESHOLD = 85.0       # %
MEMORY_CRITICAL_THRESHOLD = 92.0   # %

DISK_WRITE_HIGH_MB = 250.0         # MB between samples
NETWORK_SPIKE_MB = 200.0           # MB between samples

ZOMBIE_PROCESS_THRESHOLD = 5       # count

# =========================
# INTERNAL STATE (DELTA TRACKING)
# =========================

_last_disk_write: Optional[float] = None
_last_network_sent: Optional[float] = None
_last_network_recv: Optional[float] = None


# =========================
# EVENT FACTORY
# =========================

def _build_event(
    category: str,
    severity: str,
    snapshot: Dict,
    message: str
) -> EWSEvent:
    """
    Creates a standardized EWS Event object.
    """
    raw = f"{category}{severity}{snapshot.get('timestamp')}{message}"
    event_id = hashlib.sha256(raw.encode()).hexdigest()

    return EWSEvent(
        id=event_id,
        timestamp=datetime.now(timezone.utc),
        category=category,
        severity=severity,
        source="EWS_LOCAL",
        metrics=snapshot,
        message=message,
        acknowledged=False,
    )


# =========================
# DETECTORS
# =========================

def _detect_cpu(snapshot: Dict):
    cpu = snapshot.get("cpu", 0)

    if cpu >= CPU_CRITICAL_THRESHOLD:
        dispatch(_build_event(
            category="CPU_SATURATION",
            severity="CRITICAL",
            snapshot=snapshot,
            message=f"CPU usage at {cpu}%"
        ))

    elif cpu >= CPU_HIGH_THRESHOLD:
        dispatch(_build_event(
            category="CPU_PRESSURE",
            severity="HIGH",
            snapshot=snapshot,
            message=f"CPU usage elevated at {cpu}%"
        ))

def _detect_memory(snapshot: Dict):
    memory = snapshot.get("memory", {})
    percent = memory.get("percent", 0)

    if percent >= MEMORY_CRITICAL_THRESHOLD:
        dispatch(_build_event(
            category="MEMORY_EXHAUSTION",
            severity="CRITICAL",
            snapshot=snapshot,
            message=f"Memory usage critical at {percent}%"
        ))

    elif percent >= MEMORY_HIGH_THRESHOLD:
        dispatch(_build_event(
            category="MEMORY_PRESSURE",
            severity="HIGH",
            snapshot=snapshot,
            message=f"Memory usage elevated at {percent}%"
        ))


def _detect_disk(snapshot: Dict):
    global _last_disk_write

    disk = snapshot.get("disk", {})
    write_mb = disk.get("write_mb")

    if write_mb is None:
        return

    if _last_disk_write is not None:
        delta = write_mb - _last_disk_write
        if delta >= DISK_WRITE_HIGH_MB:
            dispatch(_build_event(
                category="DISK_WRITE_SPIKE",
                severity="HIGH",
                snapshot=snapshot,
                message=f"Disk write spike: +{round(delta,2)} MB"
            ))

    _last_disk_write = write_mb


def _detect_network(snapshot: Dict):
    global _last_network_sent, _last_network_recv

    net = snapshot.get("network", {})
    sent = net.get("sent_mb")
    recv = net.get("recv_mb")

    if sent is not None and _last_network_sent is not None:
        delta_sent = sent - _last_network_sent
        if delta_sent >= NETWORK_SPIKE_MB:
            dispatch(_build_event(
                category="NETWORK_SPIKE_OUTBOUND",
                severity="HIGH",
                snapshot=snapshot,
                message=f"Outbound spike: +{round(delta_sent,2)} MB"
            ))

    if recv is not None and _last_network_recv is not None:
        delta_recv = recv - _last_network_recv
        if delta_recv >= NETWORK_SPIKE_MB:
            dispatch(_build_event(
                category="NETWORK_SPIKE_INBOUND",
                severity="HIGH",
                snapshot=snapshot,
                message=f"Inbound spike: +{round(delta_recv,2)} MB"
            ))

    _last_network_sent = sent
    _last_network_recv = recv


def _detect_zombies(snapshot: Dict):
    processes = snapshot.get("processes", {})
    zombies = processes.get("zombie_processes", 0)

    if zombies >= ZOMBIE_PROCESS_THRESHOLD:
        dispatch(_build_event(
            category="ZOMBIE_PROCESS_ACCUMULATION",
            severity="WARNING",
            snapshot=snapshot,
            message=f"{zombies} zombie processes detected"
        ))


# =========================
# PUBLIC ENTRY POINT
# =========================

def process(snapshot: Dict):
    """
    Main EWS analyzer entry point.
    """
    # First, always update autonomy baseline + risk engine
    handle_snapshot(snapshot)

    """
    Main entry point for telemetry snapshots.
    Applies all anomaly detection rules.
    """
    if not snapshot:
        return

    _detect_cpu(snapshot)
    _detect_memory(snapshot)
    _detect_disk(snapshot)
    _detect_network(snapshot)
    _detect_zombies(snapshot)
