#!/usr/bin/env python3
# scripts/benchmark-check.py
# Checks if current pass rate is within tolerance of baseline.
# Usage: python3 scripts/benchmark-check.py <current_rate> <baseline_rate> [tolerance]
import math, sys


def main():
    if len(sys.argv) < 3:
        print(
            "FAIL: missing required arguments: <current_rate> <baseline_rate> [tolerance]"
        )
        sys.exit(1)

    current_arg = sys.argv[1]
    if isinstance(current_arg, bool):
        print("FAIL: current rate must be a number")
        sys.exit(1)
    if isinstance(current_arg, str):
        current_arg = current_arg.strip()
    try:
        current = float(current_arg)
    except (ValueError, TypeError):
        print("FAIL: current rate must be a number")
        sys.exit(1)

    baseline_arg = sys.argv[2]
    if isinstance(baseline_arg, bool):
        print("FAIL: baseline rate must be a number")
        sys.exit(1)
    if isinstance(baseline_arg, str):
        baseline_arg = baseline_arg.strip()
    try:
        baseline = float(baseline_arg)
    except (ValueError, TypeError):
        print("FAIL: baseline rate must be a number")
        sys.exit(1)

    if math.isinf(current) or math.isnan(current):
        print("FAIL: current rate must be a finite number (Infinity/NaN not allowed)")
        sys.exit(1)

    if math.isinf(baseline) or math.isnan(baseline):
        print("FAIL: baseline rate must be a finite number (Infinity/NaN not allowed)")
        sys.exit(1)

    if current < 0 or current > 100:
        print(
            "FAIL: current rate {:.1f}% is out of valid range [0, 100]".format(current)
        )
        sys.exit(1)

    tolerance_arg = sys.argv[3] if len(sys.argv) > 3 else "3.0"
    if isinstance(tolerance_arg, bool):
        print("FAIL: tolerance must be a number")
        sys.exit(1)
    if isinstance(tolerance_arg, str):
        tolerance_arg = tolerance_arg.strip()
    try:
        tolerance = float(tolerance_arg)
    except (ValueError, TypeError):
        print("FAIL: tolerance must be a number")
        sys.exit(1)
    if tolerance < 0:
        print("FAIL: tolerance {:.1f} cannot be negative".format(tolerance))
        sys.exit(1)

    delta = current - baseline

    print("")
    print(
        "Overall: current={:.1f}%  baseline={:.1f}%  delta={:+.1f}pp".format(
            current, baseline, delta
        )
    )
    if current < baseline - tolerance:
        print(
            "FAIL: regression of {:.1f}pp (tolerance: {:.1f}pp)".format(
                baseline - current, tolerance
            )
        )
        sys.exit(1)
    elif delta < 0:
        print(
            "WARN: drop of {:.1f}pp (within {:.1f}pp tolerance -- not blocking)".format(
                abs(delta), tolerance
            )
        )
    else:
        print("PASS: no regression")


if __name__ == "__main__":
    main()
