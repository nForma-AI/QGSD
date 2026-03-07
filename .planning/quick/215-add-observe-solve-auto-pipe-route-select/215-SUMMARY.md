---
phase: quick-215
plan: 01
subsystem: observe, solve
tags: [observe-pipe, targets-manifest, issue-selection]

requires:
  - phase: none
    provides: standalone quick task
provides:
  - observe-solve-pipe bridge module (bin/observe-solve-pipe.cjs)
  - observe step 7 "solve N,M,..." selection syntax
  - solve Step 0c --targets manifest consumption
affects: [observe, solve]

tech-stack:
  added: []
  patterns: [targets-manifest-pipe, issue-selection-parser]

key-files:
  created: [bin/observe-solve-pipe.cjs, bin/observe-solve-pipe.test.cjs]
  modified: [commands/nf/observe.md, commands/nf/solve.md]

key-decisions:
  - "Manifest schema uses version:1 with explicit validation on read"
  - "parseIssueSelection tolerates whitespace and reversed ranges for user convenience"
  - "Targets add focused context to solve but do NOT restrict full sweep -- fail-open design"

patterns-established:
  - "Targets manifest pipe: observe writes .planning/observe-targets.json, solve reads it via --targets flag"

requirements-completed: [QUICK-215]

duration: 3min
completed: 2026-03-07
---

# Quick 215: Add Observe-to-Solve Auto-Pipe Summary

**Bridge module with issue selection parser enabling cherry-pick routing from observe step 7 to solve via targets manifest**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T19:53:18Z
- **Completed:** 2026-03-07T19:56:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created bin/observe-solve-pipe.cjs with 4 exported functions (parseIssueSelection, buildTargetsManifest, writeTargetsManifest, readTargetsManifest)
- Added "solve N,M,..." selection syntax to observe.md step 7 for cherry-picking issues
- Added --targets flag and Step 0c to solve.md for scoped remediation from observe targets
- 19 tests covering all functions including round-trip, edge cases, and schema validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create observe-solve-pipe bridge module and tests** - `e8ebdad2` (feat)
2. **Task 2: Update observe.md step 7 and solve.md for targets pipe** - `1d2b0773` (feat)

## Files Created/Modified
- `bin/observe-solve-pipe.cjs` - Bridge module: parseIssueSelection, buildTargetsManifest, writeTargetsManifest, readTargetsManifest
- `bin/observe-solve-pipe.test.cjs` - 19 tests covering all exports
- `commands/nf/observe.md` - Step 7 updated with "solve N,M,..." selection syntax
- `commands/nf/solve.md` - Added --targets flag and Step 0c manifest loading

## Decisions Made
- Manifest schema uses version:1 with explicit validation (version === 1 and targets is array) on read per quorum suggestion
- parseIssueSelection tolerates whitespace around numbers and commas per quorum suggestion
- DEFAULT_TARGETS_PATH documented in JSDoc per quorum suggestion
- Targets add focused remediation context but do NOT restrict the full sweep -- fail-open design

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Changed test framework from vitest require to node:test**
- **Found during:** Task 1 (test creation)
- **Issue:** Plan specified vitest import but project .cjs test files use node:test with node --test runner
- **Fix:** Rewrote tests using node:test and node:assert/strict to match project conventions
- **Files modified:** bin/observe-solve-pipe.test.cjs
- **Verification:** All 19 tests pass with node --test
- **Committed in:** e8ebdad2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test framework alignment required to match project conventions. No scope creep.

## Issues Encountered
None beyond the test framework deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- observe-solve-pipe bridge is ready for use
- When users run /nf:observe and type "solve 1,3,5", selected issues will be piped to /nf:solve as scoped targets

---
*Phase: quick-215*
*Completed: 2026-03-07*

## Self-Check: PASSED
