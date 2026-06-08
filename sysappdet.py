import platform
import os
import subprocess
import json
from datetime import datetime

def get_system_info():
    system_info = {
        "architecture": platform.architecture()[0],
        "machine": platform.machine(),
        "cpu": platform.processor(),
        "cpu_cores": os.cpu_count(),
        "os": platform.system(),
        "os_version": platform.version(),
        "distribution": "Unknown"
    }

    if system_info["os"] == "Linux":
        try:
            import distro
            system_info["distribution"] = distro.name(pretty=True)
        except ImportError:
            system_info["distribution"] = subprocess.getoutput("lsb_release -ds").strip('"')

    if os.path.exists("/proc/meminfo"):
        with open("/proc/meminfo") as f:
            for line in f:
                if "MemTotal" in line:
                    system_info["ram_total_mb"] = int(line.split()[1]) // 1024
                    break

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
    except:
        return "Unreadable or Not a Binary"

def scan_binaries(directory, limit=100):
    binaries = []
    count = 0
    for root, dirs, files in os.walk(directory):
        for file in files:
            if count >= limit:
                return binaries
            full_path = os.path.join(root, file)
            if os.path.isfile(full_path) and os.access(full_path, os.X_OK):
                arch = detect_binary_architecture(full_path)
                binaries.append({
                    "file": file,
                    "path": full_path,
                    "architecture": arch
                })
                count += 1
    return binaries

def export_to_json(data, filename="alma_report.json"):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_file = f"{filename.replace('.json', '')}_{timestamp}.json"
    with open(out_file, "w") as f:
        json.dump(data, f, indent=4)
    print(f"\n📄 Report saved to: {out_file}")

def main():
    print("🔍 Alma Full System + Binary Scan")

    system_info = get_system_info()
    print("\n🧠 System Information:")
    for k, v in system_info.items():
        print(f"{k}: {v}")

    scan_path = input("\n📁 Enter directory to scan for binaries (e.g., /usr/bin): ").strip()
    binary_data = scan_binaries(scan_path)
    print(f"✅ Scanned {len(binary_data)} binaries")

    # Combine and export
    full_report = {
        "system_info": system_info,
        "binary_scan_path": scan_path,
        "binaries": binary_data
    }

    export_to_json(full_report)

if __name__ == "__main__":
    main()
