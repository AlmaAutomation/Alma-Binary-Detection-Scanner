from __future__ import annotations

from typing import Dict, Any, List

def _summarize_scan_for_ai(
    scan: Dict[str, Any],
    folder: str,
    arch_filter: str,
    limit: int,
    forensic: bool = False,
) -> Dict[str, Any]:
    binaries = scan.get("binaries") or []
    suspicious = [b for b in binaries if b.get("anomalies")]
    total = len(binaries)
    suspicious_count = len(suspicious)
    density = (suspicious_count / total) * 100 if total else 0.0

    if suspicious_count == 0:
        risk = "none"
    elif density < 3:
        risk = "low"
    elif density < 10:
        risk = "medium"
    else:
        risk = "high"

    highlights = []
    for b in suspicious[:20]:
        for issue in (b.get("anomalies") or []):
            highlights.append({"path": b.get("path"), "issue": issue, "severity": "info"})

    return {
        "summary": f"{suspicious_count} out of {total} binaries have anomaly warnings (density ~{density:.1f}%).",
        "risk_level": risk,
        "total_binaries": total,
        "suspicious_binaries": suspicious_count,
        "highlights": highlights,
        "scan_context": {
            "folder": folder,
            "arch_filter": arch_filter,
            "limit": limit,
            "forensic": forensic,
        },
    }

def _classify_path(path: str) -> str:
    if not path:
        return "unknown"
    if path.startswith(("/boot/", "/boot")):
        return "system_boot"
    if path.startswith(("/usr/bin", "/usr/sbin", "/bin", "/sbin")):
        return "system_binary"
    if path.startswith(("/lib", "/usr/lib")):
        return "system_library"
    if path.startswith(("/home", "/root", "/mnt", "/media")):
        return "user_space"
    if path.startswith(("/tmp", "/var/tmp", "/dev/shm")):
        return "temp_space"
    return "other"

async def _ai_analyze_scan(summary: Dict[str, Any], scan: Dict[str, Any]) -> str:
    folder = summary["scan_context"]["folder"]
    line = summary["summary"]
    risk = summary["risk_level"]
    binaries = scan.get("binaries") or []

    suspicious: List[Dict[str, Any]] = [b for b in binaries if b.get("anomalies")]

    by_zone: Dict[str, List[Dict[str, Any]]] = {}
    for b in suspicious:
        z = _classify_path(b.get("path") or "")
        by_zone.setdefault(z, []).append(b)

    parts: List[str] = []
    parts.append(f"Scan summary for {folder or 'N/A'}")
    parts.append(f"- {line}")
    parts.append(f"- Assessed risk level: {risk.upper()}")

    if not suspicious:
        parts.append("")
        parts.append("No binaries with anomalies were detected.")
        parts.append("Recommended next step: optionally rescan after system updates or when new software is installed.")
        return "\n".join(parts)

    if by_zone.get("user_space") or by_zone.get("temp_space"):
        parts.append("")
        parts.append("Anomalies were detected in user or temporary locations, which is more suspicious than system directories.")
    elif by_zone.get("system_boot") or by_zone.get("system_binary"):
        parts.append("")
        parts.append("Anomalies were mostly found in system / boot paths. High entropy and packed images are common here, but you should still verify integrity if this system is high value.")

    parts.append("")
    parts.append("Example flagged binaries:")
    shown = 0
    for zone, files in by_zone.items():
        if shown >= 6:
            break
        label = {
            "system_boot": "Boot / kernel files",
            "system_binary": "Core system binaries",
            "system_library": "System libraries",
            "user_space": "User-space binaries",
            "temp_space": "Temp / ephemeral locations",
            "other": "Other locations",
            "unknown": "Unclassified",
        }.get(zone, zone)

        parts.append(f"- {label}:")
        for b in files[:2]:
            for issue in (b.get("anomalies") or []):
                parts.append(f"    • {b.get('path')}: {issue}")
                shown += 1
                if shown >= 6:
                    break
            if shown >= 6:
                break

    parts.append("")
    parts.append("Suggested next actions:")

    if by_zone.get("user_space") or by_zone.get("temp_space"):
        parts.append("1) Inspect user/temp anomalies first (paths in /home, /tmp, /var/tmp, /dev/shm).")
        parts.append("2) For anything unexpected, check file owner, size, and modification time (ls -l, stat).")
        parts.append("3) If suspicious, detach the system from the network and preserve evidence.")
    else:
        parts.append("1) Verify integrity of core packages using your package manager (e.g. rpm -V, debsums).")
        parts.append("2) Compare kernel and bootloader hashes against a known-good baseline where possible.")
        parts.append("3) Reboot from a trusted medium if tampering is suspected.")

    parts.append("4) Re-run this scan after any remediation steps to confirm the environment is stable.")
    return "\n".join(parts)
