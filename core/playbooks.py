# core/playbooks.py

import subprocess
from typing import Callable, Dict
from core.policy import is_allowed

# ------------------------------------------------------
# PLAYBOOK IMPLEMENTATIONS
# ------------------------------------------------------

def cpu_emergency():
    print("[PLAYBOOK] CPU EMERGENCY: Throttling non-essential processes")

def cpu_mitigation():
    print("[PLAYBOOK] CPU MITIGATION: Soft optimization triggered")

def memory_emergency():
    print("[PLAYBOOK] MEMORY EMERGENCY: Clearing caches")
    subprocess.call(["sync"])
    subprocess.call(
        ["bash", "-c", "echo 3 > /proc/sys/vm/drop_caches"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

def memory_mitigation():
    print("[PLAYBOOK] MEMORY MITIGATION: GC suggested")

def disk_mitigation():
    print("[PLAYBOOK] DISK MITIGATION: IO pressure detected")

def network_mitigation():
    print("[PLAYBOOK] NETWORK MITIGATION: Spike detected")

def process_cleanup():
    print("[PLAYBOOK] PROCESS CLEANUP: Zombie process escalation")

# ------------------------------------------------------
# PLAYBOOK REGISTRY
# ------------------------------------------------------

PLAYBOOKS: Dict[str, Callable] = {
    "cpu_emergency": cpu_emergency,
    "cpu_mitigation": cpu_mitigation,
    "memory_emergency": memory_emergency,
    "memory_mitigation": memory_mitigation,
    "disk_mitigation": disk_mitigation,
    "network_mitigation": network_mitigation,
    "process_cleanup": process_cleanup,
}

# ------------------------------------------------------
# EXECUTION INTERFACE
# ------------------------------------------------------

def execute_playbook(name: str):
    action = PLAYBOOKS.get(name)
    if not action:
        print(f"[PLAYBOOK ERROR] Unknown playbook: {name}")
        return

    if not is_allowed(name):
        print(f"[POLICY] Playbook '{name}' requires SUPERVISED approval")
        return

    try:
        print(f"[POLICY] Executing playbook automatically: {name}")
        action()
    except Exception as e:
        print(f"[PLAYBOOK FAILURE] {name}: {e}")
