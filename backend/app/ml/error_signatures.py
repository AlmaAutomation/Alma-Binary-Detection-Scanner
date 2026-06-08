from __future__ import annotations

SIGNATURE_PATTERNS = {
    "missing_dll": [
        "import_dll",
        "dll not found",
        "failed to load dll",
        "msvcp",
        "vcruntime",
    ],

    "nsis_installer_failure": [
        "NSIS Error",
        "installer integrity check has failed",
    ],

    "architecture_mismatch": [
        "bad EXE format",
        "wrong ELF class",
        "Exec format error",
    ],

    "permission_denied": [
        "Permission denied",
        "access denied",
    ],

    "missing_dependency": [
        "No such file or directory",
        "cannot open shared object file",
    ],

    "wine_prefix_problem": [
        "wine prefix",
        "WINEPREFIX",
        "wine configuration",
    ],

    "file_not_found": [
        "failed to open",
        "file not found",
        "c0000135",
    ],
}


def detect_error_signature(stderr: str, stdout: str) -> str:
    stderr = (stderr or "").lower()
    stdout = (stdout or "").lower()

    combined = f"{stderr}\n{stdout}"

    for signature, patterns in SIGNATURE_PATTERNS.items():
        for pattern in patterns:
            if pattern.lower() in combined:
                return signature

    return "unknown_error"
