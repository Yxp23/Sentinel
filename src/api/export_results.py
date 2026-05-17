"""
export_results.py — runs the Sentinel synthesis agent and exports results.json.

Usage:
    python src/api/export_results.py
    python src/api/export_results.py --check   # just verify output/results.json exists
"""

import subprocess
import sys
import os
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def run_synthesis():
    print("Running Sentinel synthesis agent (200 providers — this takes ~10-20 minutes)...")
    result = subprocess.run(
        ["jac", "run", "src/agents/synthesis_agent.jac"],
        cwd=ROOT,
        capture_output=False,   # stream output so user sees progress
        text=True,
    )
    if result.returncode != 0:
        print(f"\n[export] ERROR: synthesis agent exited with code {result.returncode}")
        sys.exit(1)


def verify_output():
    out = ROOT / "output" / "results.json"
    if not out.exists():
        print(f"[export] ERROR: {out} not found after synthesis run")
        sys.exit(1)
    with open(out) as f:
        data = json.load(f)
    meta = data.get("meta", {})
    print(f"\n[export] ── results.json written ──────────────────────────")
    print(f"  Providers scanned : {meta.get('provider_count', '?')}")
    print(f"  Case files        : {meta.get('case_count', '?')}")
    print(f"  HIGH risk         : {meta.get('high_risk_count', '?')}")
    print(f"  MEDIUM risk       : {meta.get('medium_risk_count', '?')}")
    print(f"  Est. fraud (HIGH) : ${meta.get('estimated_fraud_total', 0):,.0f}")
    print(f"  Collusion rings   : {meta.get('collusion_rings', '?')}")
    print(f"  Temporal anomalies: {meta.get('temporal_anomalies', '?')}")
    print(f"[export] ──────────────────────────────────────────────────")
    print(f"[export] Dashboard: open dashboard/index.html in Chrome")


if __name__ == "__main__":
    if "--check" in sys.argv:
        verify_output()
    else:
        run_synthesis()
        verify_output()
