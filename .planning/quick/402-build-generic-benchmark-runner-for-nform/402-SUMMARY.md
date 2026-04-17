---
phase: quick-402
plan: "01"
subsystem: benchmarks
tags: [benchmark, ci, generic-runner, benchmark-utils, smoke]
dependency_graph:
  requires: [bin/nf-benchmark-solve.cjs, scripts/check-benchmark-gate.cjs, benchmarks/solve-baseline.json]
  provides: [bin/benchmark-utils.cjs, bin/nf-benchmark.cjs, benchmarks/quick/fixtures.json, benchmarks/quick/baseline.json]
  affects: [.github/workflows/benchmark-gate.yml]
tech_stack:
  added: []
  patterns: [shared-utils extraction, generic benchmark runner, CI gate with sequential jobs]
key_files:
  created:
    - bin/benchmark-utils.cjs
    - bin/nf-benchmark.cjs
    - benchmarks/quick/fixtures.json
    - benchmarks/quick/baseline.json
  modified:
    - bin/nf-benchmark-solve.cjs
    - .github/workflows/benchmark-gate.yml
decisions:
  - "Extracted 6 shared utility functions from nf-benchmark-solve.cjs into benchmark-utils.cjs to avoid re-inlining"
  - "Generic runner (nf-benchmark.cjs) loads fixtures from benchmarks/<skill>/fixtures.json by convention"
  - "Quick smoke fixtures invoke node with deterministic bench helper stubs — no LLM API key needed"
  - "benchmark-gate.yml uses needs: benchmark-solve to sequence the two CI jobs"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-04-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
---

# Phase quick-402 Plan 01: Build Generic Benchmark Runner Summary

**One-liner:** Generic benchmark runner (nf-benchmark.cjs) with shared utility extraction from nf-benchmark-solve.cjs and CI gate enforcing both solve and quick smoke baselines.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extract benchmark-utils, create nf-benchmark.cjs, add quick skill fixtures and baseline | 32888145 | bin/benchmark-utils.cjs, bin/nf-benchmark.cjs, bin/nf-benchmark-solve.cjs, benchmarks/quick/fixtures.json, benchmarks/quick/baseline.json |
| 2 | Update benchmark-gate.yml to enforce both solve and quick baselines | aa9c535c | .github/workflows/benchmark-gate.yml |

## What Was Built

### bin/benchmark-utils.cjs
Shared benchmark utility module exporting 6 functions extracted verbatim from nf-benchmark-solve.cjs:
- `evaluatePassCondition(fixture, spawnResult, parsed, residual)` — evaluates pass_condition string
- `extractResidual(parsed)` — extracts total residual from nf-solve JSON output
- `extractLayerResidual(parsed, layer)` — extracts per-layer residual
- `snapshotFormalJson()` — captures .planning/formal/ JSON files
- `restoreFormalJson(snap)` — restores captured formal JSON files
- `setNestedField(obj, dotPath, value)` — sets dot-path field on object

### bin/nf-benchmark.cjs
Generic benchmark runner supporting any skill. CLI: `--skill=<name> --track=<name> --json --dry-run --verbose`. Loads fixtures from `benchmarks/<skill>/fixtures.json`. Pre-flight env_required check skips fixtures missing required env vars (enforces no-API-key constraint for smoke track). JSON output matches nf-benchmark-solve.cjs shape with `skill`, `track`, and `pass_rate` fields. Exits 1 only on actual failures (not skips).

### benchmarks/quick/fixtures.json
Three smoke fixtures for nf:quick — all `exits_zero`, all `env_required: []`. Tests: identity function, processFeature returns processed:true, benchTransform filters empty lines. All invoke deterministic node inline scripts against existing bench helper stubs.

### benchmarks/quick/baseline.json
Pass rate floor of 100 for the quick smoke gate.

### .github/workflows/benchmark-gate.yml
Updated to two sequential jobs: `benchmark-solve` (existing) and `benchmark-quick` (new, `needs: benchmark-solve`). Both use explicit baseline paths passed as the second argument to `check-benchmark-gate.cjs`. Gate blocks merge if either benchmark drops below its baseline floor.

## Acceptance Criteria Results

| AC | Check | Result |
|----|-------|--------|
| AC-1 | `node bin/nf-benchmark.cjs --skill=quick --track=smoke --json` exits 0, pass_rate=100 | PASS |
| AC-2 | fixtures.json has at least one exits_zero fixture | PASS |
| AC-3 | benchmarks/quick/baseline.json exists | PASS |
| AC-4 | benchmark-gate.yml references nf-benchmark.cjs | PASS |
| AC-5 | benchmark-utils.cjs exports evaluatePassCondition as function | PASS |
| AC-6 | No fixture in quick smoke track has env_required entries | PASS |

## Deviations from Plan

None — plan executed exactly as written. The bench helper stubs (bench-pure-util.cjs, bench-feature-handler.cjs, bench-utility.cjs) referenced by fixtures already existed in bin/ from a prior commit.

## Self-Check: PASSED

All created files verified on disk. Both task commits (32888145, aa9c535c) found in git log.
