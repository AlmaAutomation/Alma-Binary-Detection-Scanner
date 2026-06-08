# almasysdet/ews/telemetry.py

from __future__ import annotations

import os
import socket
import threading
import time
from datetime import datetime, timezone
from typing import Dict, Generator, Optional

import psutil

DEFAULT_INTERVAL_SECONDS = 3.0

_TELEMETRY_RUNNING = False
_TELEMETRY_THREAD: Optional[threading.Thread] = None
_LATEST_SNAPSHOT: Optional[Dict] = None
_LOCK = threading.Lock()

_HOSTNAME = socket.gethostname()
_PID = os.getpid()


def _collect_cpu() -> float:
    try:
        return psutil.cpu_percent(interval=None)
    except Exception:
        return 0.0


def _collect_memory() -> Dict:
    try:
        vm = psutil.virtual_memory()
        return {
            "total_mb": round(vm.total / 1024 / 1024, 2),
            "used_mb": round(vm.used / 1024 / 1024, 2),
            "percent": vm.percent,
        }
    except Exception:
        return {}


def _collect_disk() -> Dict:
    try:
        io = psutil.disk_io_counters()
        if not io:
            return {}

        return {
            "read_mb": round(io.read_bytes / 1024 / 1024, 2),
            "write_mb": round(io.write_bytes / 1024 / 1024, 2),
            "read_count": io.read_count,
            "write_count": io.write_count,
        }
    except Exception:
        return {}


def _collect_network() -> Dict:
    try:
        net = psutil.net_io_counters()
        return {
            "sent_mb": round(net.bytes_sent / 1024 / 1024, 2),
            "recv_mb": round(net.bytes_recv / 1024 / 1024, 2),
            "packets_sent": net.packets_sent,
            "packets_recv": net.packets_recv,
        }
    except Exception:
        return {}


def _collect_process_summary() -> Dict:
    total = 0
    zombies = 0

    try:
        for proc in psutil.process_iter(attrs=["pid", "status"]):
            total += 1
            if proc.info.get("status") == psutil.STATUS_ZOMBIE:
                zombies += 1
    except Exception:
        pass

    return {
        "total_processes": total,
        "zombie_processes": zombies,
    }


def _build_snapshot() -> Dict:
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "host": _HOSTNAME,
        "pid": _PID,
        "cpu": _collect_cpu(),
        "memory": _collect_memory(),
        "disk": _collect_disk(),
        "network": _collect_network(),
        "processes": _collect_process_summary(),
    }


def _telemetry_loop(interval: float):
    global _LATEST_SNAPSHOT

    print("EWS telemetry loop started.")

    while _TELEMETRY_RUNNING:
        try:
            snapshot = _build_snapshot()

            with _LOCK:
                _LATEST_SNAPSHOT = snapshot

        except Exception as exc:
            print("EWS telemetry collection error:", exc)

        time.sleep(interval)

    print("EWS telemetry loop stopped.")


def start(interval: float = DEFAULT_INTERVAL_SECONDS):
    """
    Starts the EWS telemetry background collector.
    """
    global _TELEMETRY_RUNNING
    global _TELEMETRY_THREAD
    global _LATEST_SNAPSHOT

    if _TELEMETRY_RUNNING:
        return

    print("Starting EWS telemetry collector...")

    try:
        first_snapshot = _build_snapshot()

        with _LOCK:
            _LATEST_SNAPSHOT = first_snapshot

        print("Initial EWS telemetry snapshot created.")

    except Exception as exc:
        print("Initial EWS telemetry snapshot failed:", exc)

    _TELEMETRY_RUNNING = True

    _TELEMETRY_THREAD = threading.Thread(
        target=_telemetry_loop,
        args=(interval,),
        daemon=True,
        name="EWS-Telemetry-Thread",
    )

    _TELEMETRY_THREAD.start()

    print("EWS telemetry thread started.")


def stop():
    """
    Stops telemetry collection gracefully.
    """
    global _TELEMETRY_RUNNING
    global _TELEMETRY_THREAD

    print("Stopping EWS telemetry collector...")

    _TELEMETRY_RUNNING = False

    if _TELEMETRY_THREAD and _TELEMETRY_THREAD.is_alive():
        _TELEMETRY_THREAD.join(timeout=2.0)

    _TELEMETRY_THREAD = None


def get_latest_snapshot() -> Optional[Dict]:
    """
    Returns the most recent telemetry snapshot.
    """
    with _LOCK:
        return dict(_LATEST_SNAPSHOT) if _LATEST_SNAPSHOT else None


def stream() -> Generator[Dict, None, None]:
    """
    Generator for real-time streaming consumers.
    """
    last_seen = None

    while _TELEMETRY_RUNNING:
        with _LOCK:
            current = dict(_LATEST_SNAPSHOT) if _LATEST_SNAPSHOT else None

        if current and current != last_seen:
            last_seen = current
            yield current

        time.sleep(0.5)
