from __future__ import annotations

from typing import Any, Dict, List


REMEDIATION_PROFILES = {
    "file_not_found": {
        "profile": "validate_path_before_launch",
        "confidence": 0.95,
        "severity": "low",
        "actions": [
            "Verify the target file path exists before execution.",
            "Use an absolute path instead of a relative path.",
            "Check whether the execution plan placed the executable path in the wrong argument field.",
            "Confirm the file has not been moved, deleted, or renamed.",
        ],
    },

    "missing_dll": {
        "profile": "install_missing_windows_dependency",
        "confidence": 0.85,
        "severity": "medium",
        "actions": [
            "Identify the missing DLL from stderr.",
            "Install the related dependency with winetricks.",
            "Retry execution in the same WINEPREFIX.",
            "If the issue persists, create a clean isolated prefix.",
        ],
    },

    "missing_visual_c_runtime": {
        "profile": "install_visual_c_runtime",
        "confidence": 0.9,
        "severity": "medium",
        "actions": [
            "Install Visual C++ runtimes using winetricks.",
            "Try vcrun2010, vcrun2015, vcrun2019, or vcrun2022.",
            "Retry execution after dependency installation.",
        ],
    },

    "nsis_installer_failure": {
        "profile": "nsis_installer_recovery",
        "confidence": 0.8,
        "severity": "medium",
        "actions": [
            "Verify installer integrity or redownload the installer.",
            "Try running the installer with /NCRC.",
            "Retry inside a clean 32-bit WINEPREFIX.",
            "Install common runtime dependencies before retrying.",
        ],
    },

    "architecture_mismatch": {
        "profile": "select_matching_runtime_architecture",
        "confidence": 0.9,
        "severity": "high",
        "actions": [
            "Match runtime architecture to binary architecture.",
            "Use WINEARCH=win32 for 32-bit Windows binaries.",
            "Use separate prefixes for 32-bit and 64-bit execution.",
        ],
    },

    "unknown_error": {
        "profile": "collect_diagnostics",
        "confidence": 0.4,
        "severity": "unknown",
        "actions": [
            "Collect full stdout and stderr.",
            "Run dependency inspection.",
            "Retry in an isolated runtime environment.",
            "Create a new signature if this error repeats.",
        ],
    },
}


def get_remediation_profile(signature: str | None) -> Dict[str, Any]:
    key = signature or "unknown_error"
    profile = REMEDIATION_PROFILES.get(key, REMEDIATION_PROFILES["unknown_error"])

    return {
        "signature": key,
        **profile,
    }


def build_remediation_summary(signature_counts: Dict[str, int]) -> List[Dict[str, Any]]:
    summaries = []

    for signature, count in sorted(
        signature_counts.items(),
        key=lambda item: item[1],
        reverse=True,
    ):
        if signature in ("none", None):
            continue

        profile = get_remediation_profile(signature)
        summaries.append({
            "signature": signature,
            "count": count,
            "profile": profile["profile"],
            "confidence": profile["confidence"],
            "severity": profile["severity"],
            "actions": profile["actions"],
        })

    return summaries
