# core/orchestrator.py

from typing import Any
from core.playbooks import execute_playbook

def route_event(event: Any):
    """
    Central routing point for all EWS events.
    Maps events to playbooks.
    """
    category = getattr(event, "category", None)
    severity = getattr(event, "severity", None)

    if not category or not severity:
        return

    # --- CPU EVENTS ---
    if category == "CPU_SATURATION":
        execute_playbook("cpu_emergency")

    elif category == "CPU_PRESSURE":
        execute_playbook("cpu_mitigation")

    # --- MEMORY EVENTS ---
    elif category == "MEMORY_EXHAUSTION":
        execute_playbook("memory_emergency")

    elif category == "MEMORY_PRESSURE":
        execute_playbook("memory_mitigation")

    # --- DISK EVENTS ---
    elif category == "DISK_WRITE_SPIKE":
        execute_playbook("disk_mitigation")

    # --- NETWORK EVENTS ---
    elif category.startswith("NETWORK_SPIKE"):
        execute_playbook("network_mitigation")

    # --- PROCESS EVENTS ---
    elif category == "ZOMBIE_PROCESS_ACCUMULATION":
        execute_playbook("process_cleanup")
