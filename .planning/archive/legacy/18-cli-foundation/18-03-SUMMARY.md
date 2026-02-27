---
phase: 18-cli-foundation
plan: 03
subsystem: testing
tags: [gsd-tools, maintain-tests, run-batch, spawn, child_process, flakiness, timeout]

# Dependency graph
requires:
  - phase: 18-02
    provides: batch manifest format (batch_id, files, file_count, runner)
provides:
  - "cmdMaintainTestsRunBatch — executes a batch manifest, captures output to temp files, records per-test pass/fail/skip"
  - "spawnToFile helper — async spawn with file-based stdout/stderr capture, prevents maxBuffer overflow"
  - "truncateErrorSummary — caps error_summary at 500 chars"
  - "runTestFile — per-file Jest/Playwright/Pytest invocation with result parsing"
  - "3-run flakiness pre-check — failing tests re-run 3x; flaky: true if any pass"
  - "Batch-level timeout — remaining files marked timeout if exceeded"
  - "Unit tests: TC1-TC6 for run-batch mechanics"
affects: [18-04, Phase 19 state schema, Phase 21 categorization engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "File-based output capture via spawn (not spawnSync) to prevent maxBuffer crash at scale"
    - "Sequential 3-run flakiness pre-check per failing test before AI categorization"
    - "Batch-level timeout with partial result return (batch_timed_out: true)"
    - "Per-framework CLI invocation for result isolation (one file per spawn call)"

key-files:
  created: []
  modified:
    - get-shit-done/bin/gsd-tools.cjs
    - get-shit-done/bin/gsd-tools.test.cjs

key-decisions:
  - "Use spawn (async streaming) not spawnSync (synchronous buffer) for test runner invocation — prevents maxBuffer crash on large jest JSON output"
  - "Each test file run individually (not all at once) for per-file result isolation at the cost of speed"
  - "error_summary capped at first 500 chars — prevents gigabyte-scale result JSON from accumulating full test output"
  - "Flakiness pre-check is sequential not parallel — preserves predictability and avoids masking real failures"

patterns-established:
  - "spawnToFile pattern: createWriteStream + proc.stdout.pipe + proc.stderr.pipe + close event + SIGTERM timer"
  - "Batch manifest dual-format: accepts top-level batch object or manifest with batches[] array"

requirements-completed: [EXEC-02, EXEC-04]

# Metrics
duration: ~15min
completed: 2026-02-22
---

# Phase 18 Plan 03: Maintain-Tests Run-Batch Summary

**Async spawn-based batch test executor with file output capture, 3-run flakiness pre-check, and batch-level timeout.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-02-22
- **Tasks:** 3 (Tasks 1 and 3 done in prior session; Task 2 completed this session)
- **Files modified:** 2

## Accomplishments

- `spawnToFile` helper captures subprocess stdout+stderr to a temp file using async `spawn` — prevents Node.js maxBuffer crash on large test runner output at 20k+ test scale
- `cmdMaintainTestsRunBatch` executes each test file individually (Jest/Playwright/Pytest), parses per-test results, applies 3-run flakiness pre-check, enforces batch-level timeout, and writes structured JSON output
- 6 unit tests (TC1-TC6) covering: spawn output capture, timeout behavior, output schema, error truncation, --output-file, and --env flag acceptance; all 102 tests pass

## Task Commits

1. **Task 1+3: Implement spawnToFile and cmdMaintainTestsRunBatch** - `6107c08` (feat)
2. **Task 2: Add unit tests for run-batch** - `b29749d` (test)

## Files Created/Modified

- `get-shit-done/bin/gsd-tools.cjs` - Added `spawnToFile`, `truncateErrorSummary`, `runTestFile`, `cmdMaintainTestsRunBatch`; wired `run-batch` case into maintain-tests switch; updated usage comment
- `get-shit-done/bin/gsd-tools.test.cjs` - Added `maintain-tests run-batch command` describe block with TC1-TC6

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `get-shit-done/bin/gsd-tools.cjs`: exists, contains `cmdMaintainTestsRunBatch`, `spawnToFile`, `run-batch`
- `get-shit-done/bin/gsd-tools.test.cjs`: exists, contains `maintain-tests run-batch command` describe block with 6 tests
- Commit `6107c08`: exists (feat: implement spawnToFile and cmdMaintainTestsRunBatch)
- Commit `b29749d`: exists (test: add unit tests for maintain-tests run-batch command)
- Test suite: 102 tests, 0 failures
