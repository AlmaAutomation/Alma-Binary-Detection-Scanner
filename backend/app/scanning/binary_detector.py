from app.scanning.scanner import _scan_files_legacy, _legacy_to_insight
from app.scanning.detectors import _detect_binary_header, _classify_artifact

def analyze_binary(file_path: str):
    fmt, bitness, arch, interp = _detect_binary_header(file_path)
    artifact_class, is_exec_candidate, should_evaluate = _classify_artifact(file_path, fmt, interp)
    return {
        "path": file_path,
        "format": fmt,
        "bitness": bitness,
        "arch": arch,
        "script_interpreter": interp,
        "artifact_class": artifact_class,
        "is_executable_candidate": is_exec_candidate,
        "should_evaluate": should_evaluate,
    }
