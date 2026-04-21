#!/usr/bin/env python3
# scripts/benchmark-compare.py
# Parses nf-benchmark report JSON, compares vs baseline, auto-advances baseline.
# Returns: 0 if improved (baseline updated), non-zero if no change or regression.
import json, math, os, sys, datetime


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

    current_rate = float(report["passRate"])
    if math.isinf(current_rate) or math.isnan(current_rate):
        print("FAIL: passRate must be a finite number (Infinity/NaN not allowed)")
        sys.exit(1)
    prev_rate = baseline.get("pass_rate", 0)
    if math.isinf(prev_rate) or math.isnan(prev_rate):
        print(
            "FAIL: baseline pass_rate must be a finite number (Infinity/NaN not allowed)"
        )
        sys.exit(1)
    delta = current_rate - prev_rate
    if math.isinf(delta) or math.isnan(delta):
        print("FAIL: delta overflow or invalid (Infinity/NaN not allowed)")
        sys.exit(1)
    improved = current_rate > prev_rate

    print(f"Current : {current_rate:.1f}%")
    print(f"Baseline: {prev_rate:.1f}%")
    print(f"Delta   : {delta:+.1f}pp")
    print(f"Improved: {improved}")

    updated = dict(baseline)
    updated["pass_rate"] = current_rate
    updated["total"] = report["total"]
    updated["passed"] = report["passed"]
    updated["updated_at"] = datetime.date.today().isoformat()
    updated["by_category"] = {}
    updated["by_difficulty"] = {}
    updated["by_layer"] = {}

    for cat, data in report.get("byCategory", {}).items():
        rate = round(data["passed"] / data["total"] * 100) if data["total"] > 0 else 0
        updated["by_category"][cat] = {
            "passed": data["passed"],
            "total": data["total"],
            "rate": rate,
        }

    for diff, data in report.get("byDifficulty", {}).items():
        rate = round(data["passed"] / data["total"] * 100) if data["total"] > 0 else 0
        updated["by_difficulty"][diff] = {
            "passed": data["passed"],
            "total": data["total"],
            "rate": rate,
        }

    for layer, data in report.get("byLayer", {}).items():
        rate = round(data["passed"] / data["total"] * 100) if data["total"] > 0 else 0
        updated["by_layer"][layer] = {
            "passed": data["passed"],
            "total": data["total"],
            "rate": rate,
        }

    with open(baseline_path, "w") as f:
        json.dump(updated, f, indent=2)
        f.write("\n")

    home = os.environ.get("HOME", "/root")
    nf_bench_baseline = os.path.join(home, "code", "nf-benchmark", "baseline.json")
    try:
        with open(nf_bench_baseline, "w") as f:
            json.dump(updated, f, indent=2)
            f.write("\n")
    except Exception as e:
        print(f"Warning: could not sync nf-benchmark baseline: {e}")

    with open(github_output, "a") as f:
        f.write(f"current_rate={current_rate:.1f}\n")
        f.write(f"prev_rate={prev_rate:.1f}\n")
        f.write(f"delta={delta:.1f}\n")
        f.write(f"improved={str(improved).lower()}\n")
        f.write(f"passed={report['passed']}\n")
        f.write(f"total={report['total']}\n")

    secrets = {}
    secrets["BENCH_PASS_RATE"] = f"{current_rate:.1f}"
    secrets["BENCH_TOTAL"] = report["total"]
    secrets["BENCH_PASSED"] = report["passed"]
    secrets["BENCH_TIMESTAMP"] = datetime.datetime.now().isoformat()
    for cat, data in report.get("byCategory", {}).items():
        rate = round(data["passed"] / data["total"] * 100) if data["total"] > 0 else 0
        key = "BENCH_" + cat.upper().replace("-", "_") + "_RATE"
        secrets[key] = rate
    for diff, data in report.get("byDifficulty", {}).items():
        rate = round(data["passed"] / data["total"] * 100) if data["total"] > 0 else 0
        secrets["BENCH_DIFF_" + diff.upper() + "_RATE"] = rate

    with open("/tmp/benchmark_secrets.json", "w") as f:
        json.dump(secrets, f)

    sys.exit(0 if improved else 1)


if __name__ == "__main__":
    main()
