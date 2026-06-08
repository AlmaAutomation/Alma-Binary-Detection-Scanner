# backend.py
from __future__ import annotations
import os, platform, multiprocessing, asyncio, logging
import math, hashlib, re
try:
    import magic  # from python-magic
    _MAGIC = magic.Magic(mime=False)
except Exception:
    _MAGIC = None
from typing import Literal, List, Dict, Any, Iterable
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# --- Tiny cache + metrics (in-memory) ---
import threading

_CACHE: Dict[str, Any] = {}           # key: f"{folder}|{arch_filter}|{limit}" -> result payload
_CACHE_LOCK = threading.Lock()

_STATS = {"tp": 0, "fp": 0, "fn": 0}  # running counters across scans
_STATS_LOCK = threading.Lock()

def _recompute_metrics() -> Dict[str, float]:
    tp, fp, fn = _STATS["tp"], _STATS["fp"], _STATS["fn"]
    precision = (tp / (tp + fp)) if (tp + fp) else 0.0
    recall    = (tp / (tp + fn)) if (tp + fn) else 0.0
    f1        = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return {"precision": round(precision, 2), "recall": round(recall, 2), "f1": round(f1, 2)}

app = FastAPI(title="Alma System Optimization & Diagnostics - Scanner API", version="1.0.0")

# --- CORS (simple, permissive for dev) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

# --- Serve SPA at /app ---
UI_DIR = os.environ.get("BDS_UI_DIR", "/home/joshua/Desktop/almasysdet/alma-frontend/build")
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("bds")
log.info("UI_DIR=%s index.html exists? %s", UI_DIR, os.path.exists(os.path.join(UI_DIR, "index.html")))
if os.path.isdir(UI_DIR):
    app.mount("/app", StaticFiles(directory=UI_DIR, html=True), name="app")

    @app.get("/app/{path:path}")
    async def app_spa(path: str):
        return FileResponse(os.path.join(UI_DIR, "index.html"))

# --- Helpers ---
EXCLUDE_DIRS: set[str] = {"/proc", "/sys", "/dev", "/run", "/snap"}

def _record_detection(arch: str) -> None:
    with _STATS_LOCK:
        if arch in ("32-bit", "64-bit"):
            _STATS["tp"] += 1
        elif arch == "unknown":
            _STATS["fp"] += 1
        else:
            _STATS["fn"] += 1

def is_excluded(path: str) -> bool:
    return any(path == ex or path.startswith(ex + os.sep) for ex in EXCLUDE_DIRS)

def _system_info() -> Dict[str, Any]:
    try:
        import distro  # optional
        dist = distro.name(pretty=True)
    except Exception:
        dist = None
    return {
        "os": platform.system(),
        "os_version": platform.version(),
        "architecture": platform.machine() or platform.processor() or "unknown",
        "machine": platform.machine(),
        "cpu": platform.processor() or "Unknown CPU",
        "cpu_cores": multiprocessing.cpu_count(),
        "ram_total_mb": None,
        "distribution": dist,
    }

def _detect_architecture(path: str) -> str:
    try:
        with open(path, "rb") as f:
            head = f.read(5)
        if len(head) >= 5 and head[0:4] == b"\x7fELF":
            return "32-bit" if head[4] == 1 else ("64-bit" if head[4] == 2 else "unknown")
        return "unknown"
    except Exception:
        return "unknown"

def _iter_files(folder: str) -> Iterable[str]:
    # direct files
    try:
        with os.scandir(folder) as it:
            for ent in it:
                # FOLLOW symlinks so /usr/bin entries are included
                if ent.is_file(follow_symlinks=True):
                    yield ent.path
    except Exception:
        return
    # peek one level
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

ENTROPY_HIGH_THRESHOLD = 7.5
ENTROPY_VERY_HIGH_THRESHOLD = 7.9
MAX_BYTES_FOR_ENTROPY = 8 * 1024 * 1024  # read up to 8MB for entropy to stay fast

# Patterns to classify OS / type from magic output
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
    for b in data: freq[b] += 1
    n = len(data)
    ent = 0.0
    for c in freq:
        if c:
            p = c / n
            ent -= p * math.log2(p)
    return ent

def _file_entropy_limited(path: str, max_bytes: int = MAX_BYTES_FOR_ENTROPY) -> float:
    # read at most max_bytes to keep scans quick
    try:
        size = os.path.getsize(path)
        read_n = min(size, max_bytes)
        with open(path, "rb") as f:
            data = f.read(read_n)
        return round(_shannon_entropy(data), 2)
    except Exception:
        return 0.0

def _os_type_entropy(path: str):
    """Returns (os, file_type, file_entropy, anomalies) using magic + entropy"""
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

    # tiny but 64-bit (basic sanity check)
    try:
        size = os.path.getsize(path)
        if size < 1024:  # <1KB and we claim 64-bit later → suspicious
            # We don't yet know arch here; caller can add this condition after _detect_architecture
            pass
    except Exception:
        pass

    return os_guess, type_guess, ent, anomalies


def _scan_files(folder: str, arch_filter: Literal["all","32-bit","64-bit","unknown"], limit: int) -> Dict[str, Any]:
    limit = max(0, int(limit))
    cache_key = f"{folder}|{arch_filter}|{limit}"

    # serve from cache if available
    with _CACHE_LOCK:
        cached = _CACHE.get(cache_key)
    if cached:
        return cached

    # NOTE: bins now carries richer data → Dict[str, Any]
    bins: List[Dict[str, Any]] = []
    if is_excluded(folder) or not os.path.isdir(folder):
        return {"system_info": _system_info(), "binary_count": 0, "total_seen": 0, "binaries": []}

    total_seen = 0  # files we examined (after size check), regardless of whether we keep them
    kept = 0        # files that passed the arch filter (bounded by 'limit')

    for path in _iter_files(folder):
        # skip tiny files quickly
        try:
            if os.stat(path).st_size < 5:
                continue
        except Exception:
            continue

        total_seen += 1

        arch = _detect_architecture(path)
        _record_detection(arch)

        # Filter by arch
        if arch_filter != "all" and not (
            arch.lower() == arch_filter.lower()
            or (arch_filter == "unknown" and arch not in ("64-bit", "32-bit"))
        ):
            # not kept, but still counted in total_seen
            continue

        # --- Advanced detection (Step 1): OS + type + entropy + anomalies ---
        os_guess, file_type, entropy, anomalies = _os_type_entropy(path)

        # Sanity check: unusually small 64-bit file
        try:
            if (arch == "64-bit") and (os.path.getsize(path) < 1024):
                anomalies.append("Unusually small file for 64-bit binary (<1 KB)")
        except Exception:
            pass

        bins.append({
            "architecture": arch,
            "path": path,
            "file": os.path.basename(path),
            "os": os_guess,
            "file_type": file_type,
            "file_entropy": entropy,
            "anomalies": anomalies,
        })

        kept += 1
        if limit and kept >= limit:
            break

    result = {
        "system_info": _system_info(),
        "binary_count": len(bins),
        "total_seen": total_seen,
        "binaries": bins,
    }

    # cache the result
    with _CACHE_LOCK:
        _CACHE[cache_key] = result
    return result

# --- Routes ---
@app.get("/healthz")
def healthz():
    return {"status": "ok"}

@app.get("/metrics")
def metrics():
    m = _recompute_metrics()
    return {"precision": m["precision"], "recall": m["recall"], "f1": m["f1"]}

@app.get("/cache")
def view_cache():
    with _CACHE_LOCK:
        return {"count": len(_CACHE), "keys": list(_CACHE.keys())[:10]}

@app.delete("/cache")
def clear_cache():
    with _CACHE_LOCK:
        _CACHE.clear()
    return {"detail": "Cache cleared."}

@app.get("/scan")
async def scan(
    folder: str = Query(..., description="Folder to scan, e.g. /usr/bin"),
    arch_filter: Literal["all", "32-bit", "64-bit", "unknown"] = "all",
    limit: int = 100000,
):
    if not folder or not os.path.isdir(folder) or is_excluded(folder):
        return {"system_info": _system_info(), "binaries": []}

    log.info("SCAN start folder=%s filter=%s limit=%s", folder, arch_filter, limit)
    
    try:
        res = await asyncio.wait_for(
            asyncio.to_thread(_scan_files, folder, arch_filter, limit),
            timeout=20
        )
        log.info("SCAN done (%d items)", len(res.get("binaries", [])))
        return res
    except (asyncio.TimeoutError, TimeoutError):
        log.warning("SCAN timeout folder=%s", folder)
        return {"system_info": _system_info(), "binaries": []}
    except Exception as e:
        log.exception("SCAN error: %s", e)
        return {"system_info": _system_info(), "binaries": []}

# debug: proves we’re running this file + shows mounted routes
@app.get("/__whoami__")
def __whoami__():
    import sys
    return {
        "file": __file__,
        "cwd": os.getcwd(),
        "python": sys.version,
        "executable": sys.executable,
        "ui_dir": UI_DIR if os.path.isdir(UI_DIR) else None,
        "routes": [getattr(r, "path", None) for r in app.routes],
    }