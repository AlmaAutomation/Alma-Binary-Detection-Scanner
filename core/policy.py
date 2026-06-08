# core/policy.py

import os
from typing import Dict

# ------------------------------------------------------
# POLICY PROFILES
# ------------------------------------------------------

POLICY_PROFILES: Dict[str, Dict[str, str]] = {
    "lab": {
        "cpu_emergency": "auto",
        "cpu_mitigation": "auto",
        "memory_emergency": "auto",
        "memory_mitigation": "auto",
        "disk_mitigation": "auto",
        "network_mitigation": "auto",
        "process_cleanup": "auto",
    },
    "school": {
        "cpu_emergency": "auto",
        "cpu_mitigation": "auto",
        "memory_emergency": "auto",
        "memory_mitigation": "auto",
        "disk_mitigation": "auto",
        "network_mitigation": "supervised",
        "process_cleanup": "supervised",
    },
    "enterprise": {
        "cpu_emergency": "supervised",
        "cpu_mitigation": "auto",
        "memory_emergency": "supervised",
        "memory_mitigation": "auto",
        "disk_mitigation": "supervised",
        "network_mitigation": "supervised",
        "process_cleanup": "supervised",
    },
}

# ------------------------------------------------------
# ACTIVE PROFILE
# ------------------------------------------------------

ACTIVE_PROFILE = os.getenv("ALMA_POLICY_PROFILE", "lab")

# ------------------------------------------------------
# POLICY CHECK
# ------------------------------------------------------

def is_allowed(playbook_name: str) -> bool:
    profile = POLICY_PROFILES.get(ACTIVE_PROFILE, {})
    mode = profile.get(playbook_name, "supervised")

    return mode == "auto"
