---
phase: quick-398
plan: 01
subsystem: benchmark
tags: [benchmark, nf-solve, autonomy, snapshot-restore, f_to_t, track-b]
dependency_graph:
  requires:
    - bin/nf-solve.cjs
    - .planning/formal/unit-test-coverage.json
  provides:
    - Track B autonomy fixture runner in bin/nf-benchmark-solve.cjs
    - autonomy_fixtures array in solve-benchmark-fixtures.json
  affects:
    - bin/nf-benchmark-solve.cjs
    - .planning/formal/solve-benchmark-fixtures.json
tech_stack:
  added: []
  patterns:
    - snapshot/restore idiom for safe mutation testing
    - try/finally unconditional restore guarantee
    - dot-notation nested field mutation helper
key_files:
  created: []
  modified:
    - bin/nf-benchmark-solve.cjs
    - .planning/formal/solve-benchmark-fixtures.json
decisions:
  - FAIL result on autonomy fixture is expected: f_to_t layer residual does not appear in nf-solve JSON output for single fast iteration; infrastructure (snapshot, mutation, run, restore) all work correctly
  - Exit code 1 when autonomy fails is correct behavior — benchmark signals real remediation gaps
  - Loop 2 simulation: converged (exit 0)
  - Formal coverage: WARNING: Formal model drift detected (pre-existing, fail-open)
metrics:
  duration: "~30 minutes"
  completed: "2026-04-15T08:28:48Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-398 Plan 01: Improve benchmark to test nf:solve autonomy — Summary

**One-liner:** Track B autonomy fixtures with snapshot/restore logic validate nf-solve mutation-remediation round-trips against .planning/formal JSON files.

## What Was Built

### Task 1 — Snapshot/restore helpers and autonomy runner (commit: 628ed060)

Added three capabilities to `bin/nf-benchmark-solve.cjs`:

**1. Snapshot/restore helpers**
- `snapshotFormalJson()` — captures all `.planning/formal/*.json` files into memory (top-level only, fail-open)
- `restoreFormalJson(snap)` — writes back all captured files unconditionally (even after errors)
- Both helpers follow existing style: CommonJS, `'use strict'`, fail-open with try/catch

**2. Per-layer residual extraction**
- `extractLayerResidual(parsed, layer)` — extracts residual for a specific layer from nf-solve JSON output
- `setNestedField(obj, dotPath, value)` — applies dot-notation mutations to seeded JSON files

**3. Autonomy fixture runner**
- `--track=smoke` / `--track=autonomy` / `--track=all` (default) CLI flag
- Smoke loop guarded by `runSmoke` flag
- Autonomy loop wraps entire execution in `try/finally` to guarantee `restoreFormalJson` is called
- Pre-flight: checks seed target file exists, skips with SKIP (not FAIL) if missing
- Baseline measurement via `--report-only --fast` before mutation
- Full remediation run without `--report-only` after mutation
- `autonomy_results` key always present in `--json` output when autonomy track runs

### Task 2 — Autonomy fixture definition (commit: 8841e863)

Added `autonomy_fixtures` array to `.planning/formal/solve-benchmark-fixtures.json`:

```json
{
  "id": "seed-f2t-uncover-ACT-01",
  "label": "Seed f_to_t gap by marking ACT-01 uncovered — verify nf-solve auto-generates stub",
  "args": ["--json", "--no-timeout", "--max-iterations=1", "--fast"],
  "seed_mutation": {
    "type": "set_field",
    "file": ".planning/formal/unit-test-coverage.json",
    "field": "requirements.ACT-01",
    "value": { "covered": false, "test_cases": [] },
    "target_layer": "f_to_t",
    "seeded_delta": 1
  },
  "pass_condition": "residual_decreased"
}
```

## Verification Results

| Check | Result | Evidence |
|---|---|---|
| Smoke track unaffected | PASS | 6/6 passed (100%), exits zero |
| Autonomy track runs end-to-end | PASS (infrastructure) | Snapshot taken, mutation applied, nf-solve ran, restore confirmed |
| Snapshot integrity | PASS | ACT-01 `covered: true` after any autonomy run |
| JSON output has `autonomy_results` | PASS | `"autonomy_results" in d` = true |
| No formal files mutated after run | PASS | unit-test-coverage.json ACT-01 = covered: true (restored) |
| Autonomy fixture pass condition | FAIL (expected) | post_residual = n/a: f_to_t per-layer residual not emitted in single fast iteration; infrastructure correct, scoring gap is acceptable |

## Decisions Made

1. **FAIL result on autonomy fixture is expected behavior.** The f_to_t layer residual is not emitted in nf-solve's JSON output for a single `--fast` iteration. The benchmark infrastructure (snapshot, mutation, run, restore) all function correctly. The scoring gap can be addressed in a future task by checking `formal-test-sync.cjs` output directly.

2. **Exit code 1 when autonomy fails is correct.** The benchmark is now a real autonomy validator — it signals when nf-solve cannot close a gap, which is the intended behavior.

3. **SKIP vs FAIL distinction.** If the seed target file doesn't exist, the fixture is marked SKIP (not FAIL). This prevents environment-specific false failures when running on machines without the full .planning/formal tree.

## Deviations from Plan

None — plan executed exactly as written. The autonomy fixture FAIL result is explicitly anticipated in the plan: "If the autonomy fixture fails on this codebase because formal-test-sync.cjs doesn't reduce f_to_t residual in a single fast iteration, that is acceptable — the infrastructure is correct."

## Loop 2 Simulation

**Status:** Converged (exit 0, no output)

## Formal Coverage

**Status:** WARNING: Formal model drift detected (pre-existing drift, fail-open — did not block commits)

## Commits

| Task | Commit | Description |
|---|---|---|
| Task 1 | 628ed060 | feat(quick-398): add snapshot/restore helpers and autonomy runner to nf-benchmark-solve.cjs |
| Task 2 | 8841e863 | feat(quick-398): add autonomy_fixtures to solve-benchmark-fixtures.json |

## Self-Check: PASSED

- bin/nf-benchmark-solve.cjs: FOUND
- .planning/formal/solve-benchmark-fixtures.json: FOUND
- 398-SUMMARY.md: FOUND
- commit 628ed060: FOUND
- commit 8841e863: FOUND
- snapshotFormalJson/restoreFormalJson/autonomy_fixtures in benchmark: 9 occurrences (FOUND)
