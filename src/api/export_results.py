"""
export_results.py — runs the Sentinel synthesis agent and exports results.json.

Usage:
    python src/api/export_results.py
    python src/api/export_results.py --check
    python src/api/export_results.py --upload_dir /path/to/uploads
"""

import subprocess
import sys
import os
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def run_synthesis(upload_dir: str | None = None):
    label = f"uploaded data from {upload_dir}" if upload_dir else "default dataset"
    print(f"[export] Running Sentinel fraud pipeline on {label}...", flush=True)
    cmd = [sys.executable, "-u", "src/api/run_agents.py"]
    if upload_dir:
        cmd += ["--upload_dir", upload_dir]
    result = subprocess.run(cmd, cwd=ROOT, capture_output=False, text=True)
    if result.returncode != 0:
        print(f"\n[export] ERROR: agent pipeline exited with code {result.returncode}", flush=True)
        sys.exit(1)


def verify_output():
    out = ROOT / "output" / "results.json"
    if not out.exists():
        print(f"[export] ERROR: {out} not found after synthesis run", flush=True)
        sys.exit(1)
    with open(out) as f:
        data = json.load(f)
    meta = data.get("meta", {})
    print(f"\n[export] ── results.json written ──────────────────────────", flush=True)
    print(f"  Providers scanned : {meta.get('provider_count', '?')}", flush=True)
    print(f"  Case files        : {meta.get('case_count', '?')}", flush=True)
    print(f"  HIGH risk         : {meta.get('high_risk_count', '?')}", flush=True)
    print(f"  MEDIUM risk       : {meta.get('medium_risk_count', '?')}", flush=True)
    print(f"  Est. fraud (HIGH) : ${meta.get('estimated_fraud_total', 0):,.0f}", flush=True)
    print(f"  Collusion rings   : {meta.get('collusion_rings', '?')}", flush=True)
    print(f"  Temporal anomalies: {meta.get('temporal_anomalies', '?')}", flush=True)
    print(f"[export] ──────────────────────────────────────────────────", flush=True)


if __name__ == "__main__":
    if "--check" in sys.argv:
        verify_output()
    else:
        upload_dir = None
        for i, arg in enumerate(sys.argv[1:], 1):
            if arg == "--upload_dir" and i < len(sys.argv) - 1:
                upload_dir = sys.argv[i + 1]
        run_synthesis(upload_dir=upload_dir)
        verify_output()
