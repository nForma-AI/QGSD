---
created: 2026-04-02T19:05:21.734Z
title: Fix D→C sweep glob pattern resolution
area: tooling
files:
  - bin/nf-solve.cjs:sweepDtoC
---

## Problem

The D→C sweep in `sweepDtoC()` checks file existence with literal `fs.existsSync()`. When a doc references a glob pattern like `seed_data/*.json`, the scanner flags it as "file not found" even though matching files exist (e.g., `seed_data/orders.json`, `seed_data/leases.json`).

User report: nForma user's `/nf:resolve` session showed `seed_data/*.json` flagged as a broken claim when the actual files existed under that glob.

## Solution

In `sweepDtoC()`, when a claimed file path contains glob characters (`*`, `?`, `**`), expand the glob using `fs.readdirSync` or a lightweight glob matcher before checking existence. If any files match the expanded pattern, treat the claim as valid (not broken).

Pattern: detect `*` or `?` in the path string → use `Glob.sync()` or manual directory listing → if matches > 0, mark as valid.
