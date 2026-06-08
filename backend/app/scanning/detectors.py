from __future__ import annotations

import os, re, math
from pathlib import Path
from typing import Optional, Tuple, Iterable, List, Dict
from app.schemas.models import BinaryFlag

try:
    import magic
    _MAGIC = magic.Magic(mime=False)
except Exception:
    _MAGIC = None

EXCLUDE_DIRS: set[str] = {"/proc", "/sys", "/dev", "/run", "/snap"}
ENTROPY_HIGH_THRESHOLD = 7.5
ENTROPY_VERY_HIGH_THRESHOLD = 7.9
MAX_BYTES_FOR_ENTROPY = 8 * 1024 * 1024

PE_MACHINE_MAP = {
    0x014c: "x86",
    0x8664: "x86_64",
    0x01c0: "arm",
    0x01c4: "arm",
    0xaa64: "arm64",
    0x0200: "ia64",
}

ELF_MACHINE_MAP = {
    3: "x86",
    62: "x86_64",
    40: "arm",
    183: "arm64",
    8: "mips",
}

_MAGIC_OS_PATTERNS = [
    (r"PE32\+? executable|MS-DOS executable", "Windows"),
    (r"ELF", "Linux"),
    (r"Mach-O", "macOS"),
    (r"Android", "Android"),
    (r"WebAssembly|wasm", "WASM"),
    (r"Python script", "Python Script"),
    (r"shell script|Bourne-Again|POSIX shell", "Shell Script"),
]
_MAGIC_TYPE_PATTERNS = [
    (r"ELF\s+64-bit", "ELF 64-bit"),
    (r"ELF\s+32-bit", "ELF 32-bit"),
    (r"PE32\+", "PE32+ (64-bit)"),
    (r"PE32", "PE32 (32-bit)"),
    (r"Mach-O\s+64-bit", "Mach-O 64-bit"),
    (r"Mach-O", "Mach-O"),
    (r"shared object", "Shared Object"),
    (r"relocatable", "Relocatable Object"),
    (r"dynamically linked", "Dynamically Linked"),
    (r"statically linked", "Statically Linked"),
    (r"script", "Script"),
]

def is_excluded(path: str) -> bool:
    return any(path == ex or path.startswith(ex + os.sep) for ex in EXCLUDE_DIRS)

def _detect_shebang(path: str) -> Optional[str]:
    """
    Returns an interpreter hint from a shebang line, e.g. 'python3.12', 'bash', 'sh', 'perl'.
    Handles:
      - #!/usr/bin/env python3
      - #!/usr/bin/env -S python3 -O
      - #! /usr/bin/python3.12   (note the space after #!)
    """
    try:
        with open(path, "rb") as f:
            line = f.readline(256)

        if not line.startswith(b"#!"):
            return None

        # Decode and strip, then remove "#!" and any whitespace after it
        s = line.decode("utf-8", errors="ignore").strip()
        rest = s[2:].lstrip()  # tolerates "#! /path" and "#!/path"
        if not rest:
            return None

        parts = rest.split()
        if not parts:
            return None

        exe0 = os.path.basename(parts[0])

        # env forms (optionally with -S)
        if exe0 == "env":
            for tok in parts[1:]:
                if tok == "-S":
                    continue
                if tok.startswith("-"):
                    continue
                return os.path.basename(tok)
            return None

        return exe0
    except Exception:
        return None

def _detect_binary_header(path: str) -> Tuple[str, str, str, Optional[str]]:
    """
    Returns (format, bitness, arch)
      format: "ELF" | "PE" | "SCRIPT" | "UNKNOWN"
      bitness: "32-bit" | "64-bit" | "unknown"
      arch: normalized arch string (x86, x86_64, arm64, ...) or "unknown"
    """
    try:
        # Resolve symlinks so wrappers like /usr/bin/pydoc3.12 can be interpreted correctly
        real_path = os.path.realpath(path)

        # Shebang check first (covers python, shell, perl, etc.)
        interp = _detect_shebang(real_path)
        if interp:
            # Script "arch" can be treated as host-arch or left unknown; v0 keeps it conservative.
            return ("SCRIPT", "unknown", "unknown", interp)

        with open(real_path, "rb") as f:
            head = f.read(4096)
        if len(head) < 5:
            return ("UNKNOWN", "unknown", "unknown", None)

        # ELF
        if head[0:4] == b"\x7fELF":
            ei_class = head[4]
            bitness = "32-bit" if ei_class == 1 else ("64-bit" if ei_class == 2 else "unknown")

            arch = "unknown"
            if len(head) >= 20:
                e_machine = int.from_bytes(head[18:20], "little", signed=False)
                arch = ELF_MACHINE_MAP.get(e_machine, "unknown")

            return ("ELF", bitness, arch, None)

        # PE
        if head[0:2] == b"MZ" and len(head) >= 0x40:
            e_lfanew = int.from_bytes(head[0x3C:0x40], "little", signed=False)
            if e_lfanew > 0 and e_lfanew + 24 <= len(head):
                if head[e_lfanew:e_lfanew + 4] == b"PE\x00\x00":
                    coff_off = e_lfanew + 4
                    machine = int.from_bytes(head[coff_off:coff_off + 2], "little", signed=False)
                    arch = PE_MACHINE_MAP.get(machine, "unknown")

                    opt_off = coff_off + 20
                    bitness = "unknown"
                    if opt_off + 2 <= len(head):
                        magic = int.from_bytes(head[opt_off:opt_off + 2], "little", signed=False)
                        if magic == 0x10B:
                            bitness = "32-bit"
                        elif magic == 0x20B:
                            bitness = "64-bit"

                    return ("PE", bitness, arch, None)

        return ("UNKNOWN", "unknown", "unknown", None)
    except Exception:
        return ("UNKNOWN", "unknown", "unknown", None)

def _iter_files(folder: str, forensic: bool = False) -> Iterable[str]:
    if forensic:
        for root, dirs, files in os.walk(folder, followlinks=False):
            dirs[:] = [d for d in dirs if not is_excluded(os.path.join(root, d))]
            for name in files:
                path = os.path.join(root, name)
                try:
                    if os.path.isfile(path):
                        yield path
                except Exception:
                    continue
        return

    # fast/shallow mode
    try:
        with os.scandir(folder) as it:
            for ent in it:
                if ent.is_file(follow_symlinks=True):
                    yield ent.path
    except Exception:
        return

    try:
        with os.scandir(folder) as it:
            for ent in it:
                if ent.is_dir(follow_symlinks=False):
                    sub = ent.path
                    if is_excluded(sub):
                        continue
                    try:
                        with os.scandir(sub) as it2:
                            for ent2 in it2:
                                if ent2.is_file(follow_symlinks=True):
                                    yield ent2.path
                    except Exception:
                        continue
    except Exception:
        pass

def _classify_os_and_type_from_magic(magic_str: str):
    os_guess, type_guess = None, None
    for pat, label in _MAGIC_OS_PATTERNS:
        if re.search(pat, magic_str, re.IGNORECASE):
            os_guess = label
            break
    for pat, label in _MAGIC_TYPE_PATTERNS:
        if re.search(pat, magic_str, re.IGNORECASE):
            type_guess = label
            break
    if os_guess is None and "executable" in magic_str.lower():
        os_guess = "Unknown OS"
    if type_guess is None:
        if "ELF" in magic_str: type_guess = "ELF"
        elif "PE" in magic_str or "MS-DOS" in magic_str: type_guess = "PE"
        elif "Mach-O" in magic_str: type_guess = "Mach-O"
        elif "script" in magic_str.lower(): type_guess = "Script"
    return os_guess, type_guess

def _shannon_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    freq = [0]*256
    for b in data:
        freq[b] += 1
    n = len(data)
    ent = 0.0
    for c in freq:
        if c:
            p = c / n
            ent -= p * math.log2(p)
    return ent

def _file_entropy_limited(path: str, max_bytes: int = MAX_BYTES_FOR_ENTROPY) -> float:
    try:
        size = os.path.getsize(path)
        read_n = min(size, max_bytes)
        with open(path, "rb") as f:
            data = f.read(read_n)
        return round(_shannon_entropy(data), 2)
    except Exception:
        return 0.0

def _os_type_entropy(path: str):
    anomalies = []
    os_guess, type_guess = None, None

    if _MAGIC is not None:
        try:
            m = _MAGIC.from_file(path)
            os_guess, type_guess = _classify_os_and_type_from_magic(m or "")
        except Exception:
            pass

    ent = _file_entropy_limited(path)

    if ent >= ENTROPY_VERY_HIGH_THRESHOLD:
        anomalies.append(f"Very high file entropy ({ent:.2f}) — likely packed/encrypted")
    elif ent >= ENTROPY_HIGH_THRESHOLD:
        anomalies.append(f"High file entropy ({ent:.2f}) — possibly packed")

    return os_guess, type_guess, ent, anomalies

def _flags_from_anomalies(anomalies: List[str]) -> List[BinaryFlag]:
    flags: List[BinaryFlag] = []
    for a in anomalies or []:
        msg = str(a)
        if "Very high file entropy" in msg:
            flags.append(BinaryFlag(
                code="entropy_very_high",
                message=msg,
                severity="high",
                category="translation",
            ))
        elif "High file entropy" in msg:
            flags.append(BinaryFlag(
                code="entropy_high",
                message=msg,
                severity="warn",
                category="translation",
            ))
        elif "Unusually small file for 64-bit binary" in msg:
            flags.append(BinaryFlag(
                code="size_unusual_64bit_small",
                message=msg,
                severity="warn",
                category="compat",
            ))
        else:
            flags.append(BinaryFlag(
                code="flag_generic",
                message=msg,
                severity="info",
                category="unknown",
            ))
    return flags

def _looks_like_text(path: str, sample_size: int = 2048) -> bool:
    try:
        with open(path, "rb") as f:
            data = f.read(sample_size)
        if not data:
            return False
        if b"\x00" in data:
            return False
        text_chars = sum(1 for b in data if 9 <= b <= 13 or 32 <= b <= 126)
        return (text_chars / max(1, len(data))) >= 0.85
    except Exception:
        return False

def _classify_artifact(
    path: str,
    fmt: str,
    interp: Optional[str],
    st: Optional[os.stat_result] = None,
) -> Tuple[str, bool, bool]:
    """
    Returns:
      (artifact_class, is_executable_candidate, should_evaluate)
    """
    name = os.path.basename(path).lower()
    ext = Path(path).suffix.lower()
    parent = os.path.dirname(path).lower()

    # Known executable formats
    if fmt == "ELF":
        if name.endswith(".so") or ".so." in name or "/lib" in parent:
            return ("shared_library", True, True)
        return ("elf_binary", True, True)

    if fmt == "PE":
        if ext in (".dll", ".ocx"):
            return ("windows_library", True, True)
        return ("pe_binary", True, True)

    if fmt == "SCRIPT":
        return ("script", True, True)

    # History / shell artifacts
    history_names = (
        ".bash_history",
        ".zsh_history",
        ".python_history",
        ".lesshst",
        ".sqlite_history",
    )
    if name.startswith(history_names) or name.endswith(".history"):
        return ("shell_history", False, False)

    # Temp / editor junk
    if ext in (".tmp", ".temp", ".swp", ".swo", ".bak", ".old", ".orig"):
        return ("temp_file", False, False)

    # Plain text / config / structured data
    if ext in (
        ".log", ".txt", ".md", ".rst", ".json", ".yaml", ".yml",
        ".toml", ".ini", ".cfg", ".conf", ".csv"
    ):
        return ("text_data", False, False)

    # Archives / packages
    if ext in (
        ".zip", ".tar", ".gz", ".tgz", ".xz", ".bz2",
        ".7z", ".rar", ".deb", ".rpm", ".pkg"
    ):
        return ("archive_or_package", False, False)

    # Databases
    if ext in (".db", ".sqlite", ".sqlite3"):
        return ("database_file", False, False)

    # Unknown but executable-looking
    try:
        is_exec = os.access(path, os.X_OK)
    except Exception:
        is_exec = False

    if is_exec:
        return ("executable_candidate", True, True)

    # Unknown text-ish file
    if _looks_like_text(path):
        return ("non_executable_text", False, False)

    # Unknown binary blob / opaque artifact
    return ("opaque_binary_blob", False, False)
