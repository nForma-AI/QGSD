---
phase: quick-187
plan: 01
subsystem: solver
tags: [v8-coverage, formal-traceability, false-green-detection]

requires:
  - phase: quick-182
    provides: formal-test-sync recipe structure with source_files_absolute
provides:
  - V8 line-level coverage collection in sweepTtoC
  - crossReferenceFormalCoverage function for false green detection
  - F->T->C coverage summary in formatReport
affects: [nf-solve, formal-test-sync, solve-skill]

tech-stack:
  added: [NODE_V8_COVERAGE]
  patterns: [fail-open coverage collection, cross-reference traceability]

key-files:
  created: []
  modified:
    - bin/nf-solve.cjs
    - bin/nf-solve.test.cjs

key-decisions:
  - "Coverage is informational only - false greens do not increase T->C residual"
  - "V8 coverage collected only for node-test runner (not jest or runner:none)"
  - "All coverage logic is fail-open with try/catch and null fallback"

patterns-established:
  - "V8 coverage via NODE_V8_COVERAGE env var on spawnSync: temp dir, read JSON after, cleanup in finally"
  - "Cross-reference pattern: build Set of covered files from V8 data, match against recipe source_files_absolute"

requirements-completed: [QUICK-187]

duration: 16min
completed: 2026-03-06
---

# Quick 187: V8 Line-Level Coverage in T->C Sweep Summary

**V8 coverage collection in sweepTtoC with crossReferenceFormalCoverage detecting false green properties -- tests that pass but exercise zero implementing source files**

## What Was Built

1. **V8 coverage collection in sweepTtoC()**: Before spawning `node --test`, creates a temp directory and sets `NODE_V8_COVERAGE` env var. After test execution, reads coverage JSON files, parses them into a `coverageData` array, and attaches as `detail.v8_coverage`. Cleanup happens in a `finally` block. All wrapped in try/catch for fail-open behavior.

2. **crossReferenceFormalCoverage()**: New exported function that:
   - Loads formal-test-sync recipes via `loadFormalTestSync()`
   - Builds a Set of covered file paths from V8 data (only files with `count > 0` ranges)
   - For each recipe with `source_files_absolute`, computes coverage ratio
   - Identifies "false greens" -- properties where tests exist but 0% of source files are covered
   - Returns structured result with `false_greens`, `coverage_ratios`, and `summary`

3. **computeResidual integration**: After `sweepTtoC()`, calls `crossReferenceFormalCoverage()` and attaches result as `t_to_c.detail.formal_coverage`.

4. **formatReport integration**: Shows `F->T->C coverage: N/M properties fully traced (K false greens)` when coverage data is available.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 7a2d72e3 | V8 coverage collection in sweepTtoC, crossReferenceFormalCoverage, formatReport/computeResidual integration |
| 2 | 3e289300 | 5 TC-COV tests for crossReferenceFormalCoverage and V8 coverage |

## Verification Results

- `crossReferenceFormalCoverage(null)` returns `{"available":false}` (fail-open confirmed)
- `crossReferenceFormalCoverage([])` returns `available: true` with summary
- 5 new TC-COV tests all pass
- 18 existing tests all pass (no regressions)

## Deviations from Plan

None -- plan executed exactly as written.
