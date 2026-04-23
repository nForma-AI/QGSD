#!/usr/bin/env python3
# scripts/benchmark-secrets-sync.py
# Reads /tmp/benchmark_secrets.json and sets each as a GitHub secret via gh CLI.
import json, re, subprocess, sys

# Characters that could enable shell injection in secret keys
SHELL_METACHAR_PATTERN = re.compile(r'[$(){}[\]<>`;|&\*?#~!\\"\']')


def main():
    with open("/tmp/benchmark_secrets.json") as f:
        secrets = json.load(f)

    for key, val in secrets.items():
        key_str = str(key)
        if SHELL_METACHAR_PATTERN.search(key_str):
            print(f"SKIP {key}: key contains shell metacharacters")
            continue
        escaped = str(val).replace("'", "'\\''")
        cmd = f"gh secret set {key_str} --body '{escaped}'"
        try:
            r = subprocess.run(cmd, shell=True, capture_output=True, timeout=30)
            status = "SET" if r.returncode == 0 else "SKIP"
            print(f"{status} {key}={val}")
        except Exception as e:
            print(f"SKIP {key}: {e}")
    print("Secrets sync done.")


if __name__ == "__main__":
    main()
