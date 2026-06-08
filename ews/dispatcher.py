# ews/dispatcher.py

from typing import Any

def dispatch(event: Any):
    """
    Dispatches EWS events into the Alma Core Orchestrator.
    Runtime import prevents circular dependency.
    """
    try:
        from core.orchestrator import route_event
        route_event(event)
    except Exception as e:
        # Failsafe: EWS should never crash the main system
        print(f"[EWS DISPATCH ERROR] {e}")
