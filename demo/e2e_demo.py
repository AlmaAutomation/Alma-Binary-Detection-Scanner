#!/usr/bin/env python3
"""End-to-end Alma demo script.

Scenario:
  1) Snapshot EWS telemetry
  2) Simulate a CPU spike
  3) Detect risk and authorize advisory action
  4) Scan /usr/bin for binaries
  5) Run Alma Core compatibility evaluation
  6) Apply execution policy checks
  7) Execute a safe native binary plan via /execute
  8) Report success and verification results
"""

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BACKEND_URL = os.environ.get("ALMA_BACKEND_URL", "http://127.0.0.1:8001")
SCAN_FOLDER = os.environ.get("ALMA_DEMO_FOLDER", "/usr/bin")
SCAN_LIMIT = int(os.environ.get("ALMA_DEMO_LIMIT", "1000"))
CPU_STRESS_SECONDS = int(os.environ.get("ALMA_DEMO_CPU_SECONDS", "8"))


class DemoError(Exception):
    pass


def url(path: str, params: dict | None = None) -> str:
    result = urllib.parse.urljoin(BACKEND_URL, path)
    if params:
        result += "?" + urllib.parse.urlencode(params)
    return result


def http_get(path: str, params: dict | None = None) -> dict:
    req = urllib.request.Request(url(path, params), method="GET")
    req.add_header("Accept", "application/json")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def http_post(path: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url(path), data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def compute_risk(snapshot: dict | None) -> dict:
    if not snapshot:
        return {"band": "unknown", "score": 0}
    cpu = snapshot.get("cpu", 0)
    mem_pct = snapshot.get("memory", {}).get("percent", 0)
    zombies = snapshot.get("processes", {}).get("zombie_processes", 0)
    score = float(cpu or 0)
    score = max(score, float(mem_pct or 0))
    if zombies > 0:
        score += 10
    score = min(score, 100)
    if score >= 80:
        band = "critical"
    elif score >= 60:
        band = "high"
    elif score >= 30:
        band = "elevated"
    else:
        band = "low"
    return {"band": band, "score": round(score, 1)}


def start_cpu_stress(duration: int) -> list[ subprocess.Popen]:
    print(f"[demo] Starting CPU stress for {duration}s...")
    procs = []
    cpu_count = os.cpu_count() or 1
    body = (
        "import time\n"
        "end = time.time() + %d\n"
        "x = 0\n"
        "while time.time() < end:\n"
        "    x += 1\n"
    ) % duration
    for _ in range(cpu_count):
        proc = subprocess.Popen(
            [sys.executable, "-c", body],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        procs.append(proc)
    return procs


def stop_cpu_stress(procs: list[ subprocess.Popen]):
    for p in procs:
        try:
            p.terminate()
        except Exception:
            pass
    for p in procs:
        try:
            p.wait(timeout=2)
        except Exception:
            try:
                p.kill()
            except Exception:
                pass


def sample_high_cpu_snapshot(max_wait: int = 20) -> dict | None:
    print("[demo] Polling telemetry until CPU spike is observed...")
    start = time.time()
    while time.time() - start < max_wait:
        snapshot = http_get("/api/ews/telemetry")
        if snapshot and snapshot.get("cpu", 0) >= 60:
            print(f"[demo] CPU spike detected: {snapshot.get('cpu')}%")
            return snapshot
        time.sleep(1)
    return http_get("/api/ews/telemetry")


SAFE_EXECUTION_NAMES = [
    "true",
    "false",
    "ls",
    "uname",
    "id",
    "echo",
    "date",
    "cat",
    "pwd",
]


def choose_execution_candidate(core_eval: dict) -> dict | None:
    items = core_eval.get("binaries", []) or []
    for item in items:
        name = os.path.basename(item.get("path", ""))
        if name in SAFE_EXECUTION_NAMES and item.get("verdict") in ("compatible", "compatible_with_changes"):
            plan = item.get("execution_plan")
            if plan and plan.get("command"):
                return {"binary": item, "plan": plan}

    for item in items:
        if item.get("verdict") in ("compatible", "compatible_with_changes"):
            plan = item.get("execution_plan")
            if plan and plan.get("command"):
                return {"binary": item, "plan": plan}

    return {"binary": items[0], "plan": items[0].get("execution_plan")} if items else None


def pretty(obj: object) -> str:
    return json.dumps(obj, indent=2, sort_keys=True)


def main() -> int:
    print("=== Alma End-to-End Demo ===")
    print("Backend URL:", BACKEND_URL)
    print("Scan folder:", SCAN_FOLDER)
    print()

    try:
        snapshot = http_get("/api/ews/telemetry")
        print("Initial telemetry snapshot:")
        print(pretty(snapshot))
        risk = compute_risk(snapshot)
        print("Initial risk band:", risk)

        procs = start_cpu_stress(CPU_STRESS_SECONDS)
        try:
            spiked = sample_high_cpu_snapshot(max_wait=CPU_STRESS_SECONDS + 8)
            risk = compute_risk(spiked)
            print("Spike telemetry snapshot:")
            print(pretty(spiked))
            print("Computed risk:", risk)
        finally:
            stop_cpu_stress(procs)

        auth_payload = {"risk_band": risk["band"], "risk_score": risk["score"]}
        auth = http_post("/api/ews/authorize", auth_payload)
        print("Authorization response:")
        print(pretty(auth))

        print("\n[demo] Starting binary scan and compatibility evaluation...")
        insight = http_post("/insight/scan", {
            "folder": SCAN_FOLDER,
            "arch_filter": "all",
            "limit": SCAN_LIMIT,
            "forensic": False,
        })
        print(f"Insight scan returned {len(insight.get('binaries', []))} binaries")

        core_eval = http_post("/core/evaluate", insight)
        print("Core evaluation summary:")
        print(pretty({
            "evaluated_count": core_eval.get("evaluated_count"),
            "recommended_counts": core_eval.get("recommended_counts"),
            "artifact_class_counts": core_eval.get("artifact_class_counts"),
        }))

        candidate = choose_execution_candidate(core_eval)
        if not candidate:
            raise DemoError("No execution candidate found in core evaluation.")

        binary = candidate["binary"]
        plan = candidate["plan"]
        print("Selected execution candidate:")
        print(pretty({
            "path": binary.get("path"),
            "verdict": binary.get("verdict"),
            "recommended": binary.get("recommended"),
            "execution_plan": plan,
        }))

        policy_req = {
            "file_path": binary.get("path"),
            "runtime": plan.get("command") or binary.get("path"),
            "error_signature": None,
        }
        policy = http_post("/policy/execution", policy_req)
        print("Policy check:")
        print(pretty(policy))

        if policy.get("allow_execution") is False:
            raise DemoError("Policy blocked execution: " + json.dumps(policy))

        exec_payload = plan
        exec_result = http_post("/execute", exec_payload)
        print("Execution result:")
        print(pretty(exec_result))

        metrics = http_get("/metrics")
        cache = http_get("/cache")
        print("\nSummary:")
        print(pretty({
            "risk": risk,
            "authorization": auth,
            "selected_path": binary.get("path"),
            "execution_plan": plan,
            "execution_result": exec_result,
            "metrics": metrics,
            "cache": cache,
        }))

        return 0

    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="ignore")
        print(f"HTTP error {exc.code}: {body}")
        return 1
    except urllib.error.URLError as exc:
        print("Connection error:", exc)
        return 1
    except DemoError as exc:
        print("Demo failure:", exc)
        return 1
    except Exception:
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
