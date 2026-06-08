from typing import List, Optional

def recommend_actions(detected_error: Optional[str], file_path: str, runtime: str) -> List[str]:
    if detected_error == "nsis_installer_launch_failure":
        return [
            "Retry with a clean 32-bit WINEPREFIX.",
            "Install common Wine dependencies using winetricks.",
            "Try running the installer with /NCRC.",
            "Verify the installer checksum or redownload the installer.",
        ]
    if detected_error == "missing_visual_c_runtime":
        return ["Install Visual C++ runtimes with winetricks.", "Try vcrun2010, vcrun2015, vcrun2019, or vcrun2022."]
    if detected_error == "architecture_mismatch":
        return ["Use WINEARCH=win32 for 32-bit binaries.", "Use a separate clean prefix per architecture."]
    if detected_error == "missing_dll":
        return ["Identify the missing DLL from stderr.", "Install the related dependency through winetricks or package the DLL into the prefix."]
    return ["Collect full Wine debug logs.", "Retry in an isolated WINEPREFIX.", "Run dependency inspection before launch."]
