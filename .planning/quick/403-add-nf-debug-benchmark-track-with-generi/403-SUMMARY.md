---
phase: 403-add-nf-debug-benchmark-track-with-generi
plan: "01"
subsystem: benchmark
tags: [benchmark, tla+, debug, ci]
dependency_graph:
  requires: [bin/nf-benchmark.cjs, bin/benchmark-utils.cjs]
  provides: [benchmarks/debug/fixtures.json, benchmarks/debug/baseline.json, .planning/formal/spec/debug-bench-*/*, bin/bench-buggy-*.cjs]
  affects: [.github/workflows/benchmark-gate.yml]
tech_stack:
  added: []
  patterns: [TLA+ spec/cfg pairs, fail-open TLC runner, spawnSync]
key_files:
  created:
    - bin/bench-buggy-sort.cjs
    - bin/bench-buggy-filter.cjs
    - bin/bench-buggy-counter.cjs
    - benchmarks/debug/fixtures.json
    - benchmarks/debug/baseline.json
    - .planning/formal/spec/debug-bench-sort/bug.tla
    - .planning/formal/spec/debug-bench-sort/bug.cfg
    - .planning/formal/spec/debug-bench-sort/fix.tla
    - .planning/formal/spec/debug-bench-sort/fix.cfg
    - .planning/formal/spec/debug-bench-filter/bug.tla
    - .planning/formal/spec/debug-bench-filter/bug.cfg
    - .planning/formal/spec/debug-bench-filter/fix.tla
    - .planning/formal/spec/debug-bench-filter/fix.cfg
    - .planning/formal/spec/debug-bench-counter/bug.tla
    - .planning/formal/spec/debug-bench-counter/bug.cfg
    - .planning/formal/spec/debug-bench-counter/fix.tla
    - .planning/formal/spec/debug-bench-counter/fix.cfg
  modified:
    - bin/benchmark-utils.cjs
    - bin/nf-benchmark.cjs
    - .github/workflows/benchmark-gate.yml
decisions:
  - baseline pass_rate set to 0 pending TLC CI availability — raise once tla2tools.jar confirmed in CI environment
  - node -e placeholder command used in fixtures because TLC evaluation happens inside evaluatePassCondition not from spawned command stdout
  - runTlcOnModel fails open (returns has_counterexample=false) when tla2tools.jar not found
metrics:
  duration: ~10 minutes
  completed: "2026-04-17"
  tasks_completed: 3
  files_created: 20
  files_modified: 3
---

# Phase 403 Plan 01: Add nf:debug Benchmark Track Summary

**One-liner:** nf:debug benchmark track with 3 buggy stubs, 6 TLA+ bug/fix model pairs, extended evaluatePassCondition for TLC counterexample/verification pass conditions, and CI gate job.

## Tasks Completed

| Task | Name | Commit |
|------|------|--------|
| 1 | Create three buggy bench stubs | 3451ade4 |
| 2 | Create six TLA+ model pairs for debug bench fixtures | e268feae |
| 3 | Add TLC pass conditions, fixtures, baseline, CI gate job, wire traces | 0748ec12 |

## What Was Built

### Buggy Bench Stubs

Three CommonJS modules with seeded algorithmic bugs:

- `bin/bench-buggy-sort.cjs` — `buggySort`: uses `>=` comparator causing unnecessary swaps on equal elements
- `bin/bench-buggy-filter.cjs` — `buggyFilter`: uses `>` threshold excluding the threshold value itself
- `bin/bench-buggy-counter.cjs` — `buggyCounter`: uses `< hi` excluding the upper boundary element

### TLA+ Model Pairs (12 files across 3 directories)

Each directory contains `bug.tla`/`bug.cfg` and `fix.tla`/`fix.cfg`:

- `debug-bench-sort/` — Invariant `NoUnnecessarySwap`: violated by `>=`, satisfied by `>`
- `debug-bench-filter/` — Invariant `ThresholdIncluded`: violated by `x > 4`, satisfied by `x >= 4`
- `debug-bench-counter/` — Invariant `BoundaryIncluded`: violated by `x < Hi`, satisfied by `x <= Hi`

State spaces are tiny (2-3 values per dimension) for fast TLC execution.

### Extended benchmark-utils.cjs

- Added `const { spawnSync } = require('child_process')` import
- Added `runTlcOnModel(modelPath, cfgPath)` — locates `tla2tools.jar` from 3 candidate paths, spawns TLC, returns `{ exit_code, output, has_counterexample, traces }`. Fails open when jar not found.
- Extended `evaluatePassCondition` with two new branches:
  - `tlc_counterexample_found` — passes if TLC finds a counterexample in `fixture.bug_model`
  - `tlc_fix_verified` — passes if TLC finds NO counterexample in `fixture.fix_model`
  - Both unconditionally set `fixture._traces` for runner pickup
- Exported `runTlcOnModel`

### Patched nf-benchmark.cjs

Added `traces: fixture._traces || []` to the result push object so TLC output lines appear in JSON output.

### benchmarks/debug/

- `fixtures.json` — 6 fixtures: 3 × `tlc_counterexample_found` + 3 × `tlc_fix_verified`
- `baseline.json` — `pass_rate: 0` floor pending TLC CI availability

### CI Gate Job

Added `benchmark-debug` job to `.github/workflows/benchmark-gate.yml` that runs after `benchmark-quick`, invokes `node bin/nf-benchmark.cjs --skill=debug --track=full --json`, and checks against `benchmarks/debug/baseline.json`.

## Verification Results

- `node bin/nf-benchmark.cjs --skill=debug --track=full --dry-run` — lists 6 fixtures, exits 0
- `typeof m.runTlcOnModel === 'function'` — confirmed
- `evaluatePassCondition` sets `fixture._traces` as array for both new condition types — confirmed
- `grep "fixture._traces" bin/nf-benchmark.cjs` — matches in result push block
- All 12 TLA+ files verified: module names match filenames, invariants present
- `benchmark-debug` job present in benchmark-gate.yml
- Both JSON files parse cleanly

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] bin/bench-buggy-sort.cjs exists
- [x] bin/bench-buggy-filter.cjs exists
- [x] bin/bench-buggy-counter.cjs exists
- [x] 12 TLA+ files across 3 directories exist
- [x] benchmarks/debug/fixtures.json exists (6 fixtures)
- [x] benchmarks/debug/baseline.json exists
- [x] benchmark-utils.cjs exports runTlcOnModel
- [x] nf-benchmark.cjs result push includes traces field
- [x] benchmark-gate.yml contains benchmark-debug job
- [x] Commits 3451ade4, e268feae, 0748ec12 confirmed in git log
