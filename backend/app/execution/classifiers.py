from typing import List, Optional, Tuple

def classify_execution_error(stdout: str, stderr: str) -> Tuple[Optional[str], List[str]]:
    text = f"{stdout}\n{stderr}".lower()
    if "nsis error" in text or "error launching installer" in text:
        return "nsis_installer_launch_failure", [
            "Installer may be corrupted or incomplete.",
            "NSIS extraction may be failing under Wine.",
            "32-bit Wine dependencies may be missing.",
            "WINEPREFIX architecture may be incorrect.",
        ]
    if "bad exe format" in text:
        return "architecture_mismatch", ["Program architecture does not match the selected runtime."]
    if "dll" in text and "not found" in text:
        return "missing_dll", ["A required Windows DLL dependency is missing."]
    if "vcruntime" in text or "msvcr" in text or "msvcp" in text:
        return "missing_visual_c_runtime", ["Microsoft Visual C++ runtime dependency is missing."]
    if "wine: could not load" in text:
        return "wine_loader_failure", ["Wine failed to load the target executable."]
    if "failed to open" in text or "c0000135" in text:
        return "file_not_found", [
        "Target file path may not exist.",
        "Wine could not open the requested executable.",
        ]        
    return None, []
