---
phase: quick-404
plan: 01
subsystem: benchmark
tags: [benchmark, debug, autonomy, stubs, scoring]
dependency_graph:
  requires: [bin/debug-formal-context.cjs, bin/call-quorum-slot.cjs]
  provides: [bin/nf-debug-runner.cjs, bin/nf-benchmark-debug.cjs, benchmarks/debug/tests/]
  affects: [benchmarks/debug/baseline.json]
tech_stack:
  added: []
  patterns: [spawnSync fix-cycle, try/finally stub restoration, CommonJS bin scripts]
key_files:
  created:
    - bin/nf-debug-runner.cjs
    - bin/nf-benchmark-debug.cjs
    - bin/bench-buggy-medium-dedup.cjs
    - bin/bench-buggy-medium-accumulator.cjs
    - bin/bench-buggy-hard-parser.cjs
    - bin/bench-buggy-hard-scheduler.cjs
    - benchmarks/debug/tests/sort.test.cjs
    - benchmarks/debug/tests/filter.test.cjs
    - benchmarks/debug/tests/counter.test.cjs
    - benchmarks/debug/tests/dedup.test.cjs
    - benchmarks/debug/tests/accumulator.test.cjs
    - benchmarks/debug/tests/parser.test.cjs
    - benchmarks/debug/tests/scheduler.test.cjs
  modified:
    - bin/bench-buggy-sort.cjs
    - benchmarks/debug/baseline.json
decisions:
  - "sort stub replaced with reverse-comparator bug (definitively wrong output) vs old unobservable equal-swap bug"
  - "baseline.json pass_rate set to 43 (3/7 easy stubs = realistic AI pipeline floor)"
  - "nf-debug-runner uses new Function() for syntax pre-validation before writing fixed code to disk"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  files_created: 15
  files_modified: 2
---

# Phase quick-404 Plan 01: nf:debug Autonomy Benchmark Summary

**One-liner:** 7 graded buggy stubs (3 easy/2 medium/2 hard) with paired failing tests, fix-cycle runner, and 0-100 standalone scorer for nf:debug pipeline autonomy measurement.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace sort stub + create medium/hard stubs + paired test files | b3c74d0f | 12 files (5 stubs + 7 tests) |
| 2 | Create nf-debug-runner.cjs, nf-benchmark-debug.cjs, update baseline.json | 7d591385 | 3 files |

## What Was Built

### Buggy Stubs (7 total)

| ID | Tier | File | Bug |
|----|------|------|-----|
| sort | easy | bin/bench-buggy-sort.cjs | Comparator reversed: sorts descending (< instead of >) |
| filter | easy | bin/bench-buggy-filter.cjs | Excludes threshold value (> instead of >=) |
| counter | easy | bin/bench-buggy-counter.cjs | Misses upper boundary (< instead of <=) |
| dedup | medium | bin/bench-buggy-medium-dedup.cjs | String coercion treats 1 and "1" as duplicates |
| accumulator | medium | bin/bench-buggy-medium-accumulator.cjs | Uses + instead of * for product |
| parser | hard | bin/bench-buggy-hard-parser.cjs | Off-by-one slice drops last char of each token |
| scheduler | hard | bin/bench-buggy-hard-scheduler.cjs | Inverted priority comparison returns max instead of min |

### Test Files

All 7 test files in `benchmarks/debug/tests/` exit 1 when run against their paired stub. Each uses `'use strict'`, CommonJS require, and pure assertion + process.exit (no test framework dependency).

### Runner: bin/nf-debug-runner.cjs

Fix-cycle runner for a single stub. Protocol:
1. Run test — if passes, exit 0 (already fixed)
2. Assemble formal context via debug-formal-context.cjs
3. Build prompt with stub source + failure output + formal context
4. Dispatch to quorum via call-quorum-slot.cjs (default 150s timeout)
5. Extract code block with robust regex `/```(?:js|javascript)?\n?([\s\S]*?)\n?```/`
6. Validate syntax with `new Function()` before writing
7. Apply fix (overwrite stub), re-run test, return `{fixed, error, elapsed_ms}`

Safety guardrails: pre-flight dependency check, try/finally restoration, syntax validation, timeout error propagation.

### Scorer: bin/nf-benchmark-debug.cjs

Standalone scorer that runs all 7 stubs through nf-debug-runner.cjs and produces a 0-100 score. Each stub call is wrapped in try/finally to restore original source even if runner crashes or times out. Supports --dry-run, --json, --verbose, --timeout.

### baseline.json

Updated to `pass_rate: 43` — realistic floor representing 3 easy stubs fixed by AI pipeline (3/7 = 43%).

## Verification Results

All 10 verification checks passed:
- Tests 1-7: all 7 test files exit 1 (fail against buggy stubs)
- Test 8: `--dry-run` lists all 7 stubs, exits 0
- Test 9: `--dry-run --json` emits valid JSON with `total: 7`
- Test 10: nf-debug-runner `--dry-run` exits 0 with `dry_run: true`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- bin/nf-debug-runner.cjs: FOUND
- bin/nf-benchmark-debug.cjs: FOUND
- bin/bench-buggy-medium-dedup.cjs: FOUND
- bin/bench-buggy-medium-accumulator.cjs: FOUND
- bin/bench-buggy-hard-parser.cjs: FOUND
- bin/bench-buggy-hard-scheduler.cjs: FOUND
- benchmarks/debug/tests/sort.test.cjs: FOUND
- benchmarks/debug/tests/filter.test.cjs: FOUND
- benchmarks/debug/tests/counter.test.cjs: FOUND
- benchmarks/debug/tests/dedup.test.cjs: FOUND
- benchmarks/debug/tests/accumulator.test.cjs: FOUND
- benchmarks/debug/tests/parser.test.cjs: FOUND
- benchmarks/debug/tests/scheduler.test.cjs: FOUND

Commits verified:
- b3c74d0f: FOUND (feat: add 5 buggy stubs and 7 paired failing test files)
- 7d591385: FOUND (feat: add nf-debug-runner, nf-benchmark-debug scorer, update baseline)
