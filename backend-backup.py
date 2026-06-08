from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import platform
import os
import subprocess

app = FastAPI()

# Allow frontend to access API
app.add_middleware(
    CORSMiddleware,

    allow_origins=["http://localhost:3000", "https://your-production-domain.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_system_info():
    system_info = {
        "architecture": platform.architecture()[0],
        "machine": platform.machine(),
        "cpu": platform.processor(),
        "cpu_cores": os.cpu_count(),
        "os": platform.system(),
        "os_version": platform.version(),
        "distribution": "Unknown",
    }

    if system_info["os"] == "Linux":
        try:
            import distro
            system_info["distribution"] = distro.name(pretty=True)
        except ImportError:
            try:
                distro_info = subprocess.getoutput("lsb_release -ds").strip('"')
                if distro_info:
                    system_info["distribution"] = distro_info
            except Exception:
                pass

    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if "MemTotal" in line:
                    system_info["ram_total_mb"] = int(line.split()[1]) // 1024
                    break
    except Exception:
        pass

    return system_info


def detect_binary_architecture(file_path):
    try:
        output = subprocess.check_output(["file", file_path], text=True)
        if "64-bit" in output:
            return "64-bit"
        elif "32-bit" in output:
            return "32-bit"
        else:
            return "Unknown"
    except Exception:
        return "Unreadable"


def scan_binaries(directory, arch_filter="all", limit=100):
    binaries = []
    count = 0
    for root, dirs, files in os.walk(directory):
        for file in files:
            if count >= limit:
                return binaries
            full_path = os.path.join(root, file)
            if os.path.isfile(full_path) and os.access(full_path, os.X_OK):
                arch = detect_binary_architecture(full_path)
                # Normalize casing for reliable comparison
                if arch_filter.lower() == "all" or arch.lower() == arch_filter.lower():
                    binaries.append({
                        "file": file,
                        "path": full_path,
                        "architecture": arch
                    })
                    count += 1
    return binaries



@app.get("/scan")
def scan(
    folder: str,
    arch_filter: str = "all",
    limit: int = Query(100, gt=0, le=5000)  # Cap max to 5000 for safety
):
    try:
        binaries = scan_binaries(folder, arch_filter, limit)
        return {
            "system_info": get_system_info(),
            "binary_scan_path": folder,
            "filtered_by": arch_filter,
            "binary_count": len(binaries),
            "binaries": binaries,
        }
    except Exception as e:
        return {"error": f"Scan failed: {str(e)}"}
