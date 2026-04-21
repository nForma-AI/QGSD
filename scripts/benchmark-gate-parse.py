#!/usr/bin/env python3
# scripts/benchmark-gate-parse.py
# Parses nf-benchmark report JSON and checks for category regressions.
# Writes outputs to GITHUB_OUTPUT and exits non-zero if regressions found.
import json, math, os, sys


def main():
    report_path = os.environ.get("REPORT") or sys.argv[1]
    baseline_path = os.environ.get("BASELINE") or sys.argv[2]
    github_output = os.environ.get("GITHUB_OUTPUT", "/tmp/gha_output.txt")

    with open(report_path) as f:
        report = json.load(f)["report"]
    try:
        with open(baseline_path) as f:
            baseline = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        baseline = {
            "pass_rate": 0,
            "by_category": {},
            "by_difficulty": {},
            "by_layer": {},
        }

    TOLERANCE = 3.0
    regressions = []

    pass_rate_value = report["passRate"]
    if isinstance(pass_rate_value, bool):
        print("FAIL: passRate cannot be a boolean")
        sys.exit(1)
    if isinstance(pass_rate_value, str):
        stripped = pass_rate_value.strip()
        if pass_rate_value != stripped:
            print("FAIL: passRate string cannot have leading/trailing whitespace")
            sys.exit(1)
        pass_rate_value = stripped
    try:
        current_rate = float(pass_rate_value)
    except (ValueError, TypeError):
        print("FAIL: passRate must be a number")
        sys.exit(1)
    if math.isinf(current_rate) or math.isnan(current_rate):
        print("FAIL: passRate must be a finite number (Infinity/NaN not allowed)")
        sys.exit(1)
    baseline_rate = baseline.get("pass_rate", 0)
    delta = current_rate - baseline_rate

    print(f"Current : {current_rate:.1f}%")
    print(f"Baseline: {baseline_rate:.1f}%")
    print(f"Delta   : {delta:+.1f}pp")

    outputs = {}
    outputs["pass_rate"] = current_rate
    outputs["baseline_rate"] = baseline_rate
    outputs["passed"] = report["passed"]
    outputs["total"] = report["total"]
    outputs["delta"] = delta

    print("\nPer-category:")
    for cat, data in report.get("byCategory", {}).items():
        rate = round(data["passed"] / data["total"] * 100) if data["total"] > 0 else 0
        base = baseline.get("by_category", {}).get(cat, {}).get("rate", None)
        key = "cat_" + cat.replace("-", "_") + "_rate"
        outputs[key] = rate
        print(f"  {cat:35s} {rate:3d}%  (baseline: {base}%)")
        if base is not None and rate < base - TOLERANCE:
            regressions.append(
                f"{cat}: {rate}% (baseline: {base}%, tolerance: {TOLERANCE}pp)"
            )

    print("\nPer-difficulty:")
    for diff, data in report.get("byDifficulty", {}).items():
        rate = round(data["passed"] / data["total"] * 100) if data["total"] > 0 else 0
        key = "diff_" + diff + "_rate"
        outputs[key] = rate
        print(f"  {diff:15s} {rate:3d}%")

    with open(github_output, "a") as f:
        for k, v in outputs.items():
            f.write(f"{k}={v}\n")

    if regressions:
        print("\n=== CATEGORY REGRESSIONS ===")
        for r in regressions:
            print(f"  FAIL: {r}")
        sys.exit(1)
    else:
        print("\nNo regressions detected.")


if __name__ == "__main__":
    main()
