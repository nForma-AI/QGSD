---
phase: quick-397
plan: "01"
subsystem: benchmark
tags: [benchmark, nf-solve, validation, cli]
dependency_graph:
  requires: []
  provides: [benchmark:solve CLI command, solve-benchmark-fixtures.json]
  affects: [package.json scripts, bin/nf-solve.cjs (invoked)]
tech_stack:
  added: []
  patterns: [spawnSync subprocess runner, fail-open JSON parse, pre-flight file check]
key_files:
  created:
    - bin/nf-benchmark-solve.cjs
    - .planning/formal/solve-benchmark-fixtures.json
  modified:
    - package.json
decisions:
  - "Added 6th edge-case fixture (invalid --focus value) per quorum improvement constraint"
  - "spawnSync timeout set to 300000ms to prevent indefinite hangs per quorum improvements"
  - "null residual bounds: min/max_residual assertions are skipped when value is null per quorum improvements"
  - "--verbose uses stdio inherit for stderr; normal mode uses pipe"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-13"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Quick Task 397: Build nf-benchmark-solve command for nf:solve validation

**One-liner:** benchmark runner invoking nf-solve via spawnSync against 6 versioned fixture definitions with per-fixture PASS/FAIL reporting and aggregate pass rate

## What Was Built

`bin/nf-benchmark-solve.cjs` — a CLI tool that runs `nf-solve.cjs` against a JSON fixture set, reports PASS/FAIL per fixture, and outputs aggregate metrics (pass rate, total duration). Supports `--dry-run`, `--fixture`, `--verbose`, and `--json` flags.

`.planning/formal/solve-benchmark-fixtures.json` — 6 versioned fixture definitions covering:
1. `report-only-fast` — fast sweep skipping proximity rebuild
2. `report-only-full` — full single-iteration diagnostic sweep
3. `skip-layers-r2f` — single iteration with R->F layer skipped
4. `focus-formal` — focus-filtered sweep on "formal model" topic
5. `zero-residual-check` — asserts numeric (non-error) residual returned
6. `invalid-focus-value` — edge case: invalid --focus value exits cleanly

`package.json` — added `"benchmark:solve": "node bin/nf-benchmark-solve.cjs"` script entry.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 9bff8291 | feat(397-01): add solve-benchmark-fixtures.json with 6 synthetic fixtures |
| Task 2 | 93cc7575 | feat(397-01): add nf-benchmark-solve.cjs runner and package.json script |

## Verification Results

1. `node bin/nf-benchmark-solve.cjs --dry-run` exits 0, prints 6 [dry-run] fixture lines
2. `package.json` scripts.benchmark:solve = "node bin/nf-benchmark-solve.cjs"
3. All 6 fixtures have id/label/args/pass_condition fields validated
4. Script has shebang, `'use strict'`, CommonJS require/module.exports pattern
5. `--fixture /nonexistent/path.json` exits 1 with "ERROR: fixture file not found"

## Quorum Improvements Incorporated

- `timeout: 300000` added to spawnSync options
- `--verbose` uses `stdio: ['pipe', 'pipe', 'inherit']`; normal mode uses full pipe
- null residual: min/max_residual assertions skipped when value is null
- 6th fixture added: `invalid-focus-value` with pass_condition `exits_zero`

## Deviations from Plan

None — plan executed exactly as written, plus quorum improvements from constraints incorporated as enhancements.

## Formal Modeling

INFO: No formal coverage intersections found -- Loop 2 not needed (GATE-03)
Both commits had no formal model intersections.

## Self-Check: PASSED

- bin/nf-benchmark-solve.cjs: FOUND
- .planning/formal/solve-benchmark-fixtures.json: FOUND
- Commit 9bff8291: FOUND
- Commit 93cc7575: FOUND
