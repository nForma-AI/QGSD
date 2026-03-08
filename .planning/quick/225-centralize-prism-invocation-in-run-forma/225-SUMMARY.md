---
phase: quick-225
plan: 01
subsystem: formal-verification
tags: [prism, delegation, run-formal-check, run-prism, model-checking]

requires:
  - phase: quick-130
    provides: run-formal-check.cjs MODULE_CHECKS structure
provides:
  - PRISM delegation from run-formal-check.cjs to run-prism.cjs
  - Test coverage for PRISM delegation behavior
affects: [formal-verification, run-formal-check, run-prism]

tech-stack:
  added: []
  patterns: [subprocess delegation for tool-specific features]

key-files:
  created:
    - bin/run-formal-check.test.cjs
  modified:
    - bin/run-formal-check.cjs

key-decisions:
  - "PRISM binary-not-found detection uses stderr content matching ('binary not found' or 'PRISM_BIN') to distinguish skip from fail"
  - "Spawn failure (result.error) treated as skipped (fail-open), consistent with TLC/Alloy skip behavior"

patterns-established:
  - "Tool delegation: run-formal-check.cjs delegates tool-specific checks to dedicated scripts (run-prism.cjs) via spawnSync(process.execPath, [scriptPath, ...])"

requirements-completed: []

duration: 2min
completed: 2026-03-08
---

# Quick 225: Centralize PRISM Invocation Summary

**PRISM checks in run-formal-check.cjs now delegate to run-prism.cjs, inheriting properties file injection, scoreboard-based rate calibration, cold-start detection, and policy.yaml loading**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08T04:33:22Z
- **Completed:** 2026-03-08T04:35:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced inline PRISM binary invocation with delegation to run-prism.cjs via subprocess spawn
- Removed direct resolve-prism-bin.cjs dependency from run-formal-check.cjs prism branch
- Added 3 tests verifying delegation behavior, correct result shape, and fail-open semantics

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace inline PRISM spawnSync with delegation to run-prism.cjs** - `f6c81b9c` (feat)
2. **Task 2: Add test verifying run-formal-check delegates PRISM to run-prism.cjs** - `c45d47df` (test)

## Files Created/Modified
- `bin/run-formal-check.cjs` - Replaced prism branch (lines 241-274) with delegation to run-prism.cjs via spawnSync
- `bin/run-formal-check.test.cjs` - New test file with 3 tests covering delegation, source verification, and result shape

## Decisions Made
- PRISM binary-not-found detection uses stderr content matching to distinguish skip from fail (stderr from run-prism.cjs contains 'binary not found' or 'PRISM_BIN' when not installed)
- Spawn failure (result.error) treated as 'skipped' not 'fail' for fail-open consistency with TLC/Alloy behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PRISM invocation is now centralized through run-prism.cjs for all code paths
- Future PRISM feature additions only need to be made in run-prism.cjs

---
*Phase: quick-225*
*Completed: 2026-03-08*
