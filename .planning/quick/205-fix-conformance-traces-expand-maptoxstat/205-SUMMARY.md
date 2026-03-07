---
phase: quick-205
plan: 01
subsystem: testing
tags: [conformance-traces, xstate, validation, trace-replay]

requires:
  - phase: none
    provides: existing validate-traces.cjs conformance validator
provides:
  - Zero-divergence conformance trace validation
  - mapToXStateEvent handles event.type normalization and 3 new action types
affects: [ci:conformance-traces, nf:solve]

tech-stack:
  added: []
  patterns: [event.action || event.type normalization, KNOWN_NON_FSM_ACTIONS skip set]

key-files:
  created: []
  modified: [bin/validate-traces.cjs, bin/validate-traces.test.cjs]

key-decisions:
  - "Use event.action || event.type normalization to handle 5649 type-only events"
  - "security_sweep handled via KNOWN_NON_FSM_ACTIONS skip set (counted as valid, not divergent)"
  - "Export expectedState for direct unit testing"

patterns-established:
  - "KNOWN_NON_FSM_ACTIONS set pattern for non-FSM actions that should be silently skipped"

requirements-completed: [QUICK-205]

duration: 2min
completed: 2026-03-07
---

# Quick 205: Fix conformance traces -- expand mapToXStateEvent Summary

**Expanded mapToXStateEvent to handle event.type normalization, quorum_fallback_t1_required, quorum_block_r3_2, and security_sweep -- reducing divergences from 6373 to 0**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T12:34:44Z
- **Completed:** 2026-03-07T12:36:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed 6373 false divergences in ci:conformance-traces (100.0% valid, 38798/38798 traces)
- Added event.action || event.type normalization to handle 5649 type-only events
- Added switch cases for quorum_fallback_t1_required, quorum_block_r3_2, and security_sweep
- Added KNOWN_NON_FSM_ACTIONS skip set for non-FSM actions like security_sweep
- Added 8 new unit/integration tests (47 total, 0 failures)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add unit tests for new action mappings** - `05e1ec14` (test)
2. **Task 2: Expand mapToXStateEvent and expectedState** - `a86b34ef` (feat)

## Files Created/Modified
- `bin/validate-traces.cjs` - Expanded mapToXStateEvent with action normalization, 3 new cases, KNOWN_NON_FSM_ACTIONS skip set, expectedState normalization
- `bin/validate-traces.test.cjs` - Added 8 new test cases covering type-only events, all 3 new action mappings, and integration tests

## Decisions Made
- Used `event.action || event.type` normalization (not a new field) to handle type-only events with minimal code change
- security_sweep returns null from mapToXStateEvent and is handled as a known-skip via KNOWN_NON_FSM_ACTIONS set (counted as valid, not divergent)
- Exported expectedState function from module.exports to enable direct unit testing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported expectedState for unit testing**
- **Found during:** Task 1 (test writing)
- **Issue:** expectedState was not in module.exports, preventing direct unit tests
- **Fix:** Added expectedState to the module.exports object
- **Files modified:** bin/validate-traces.cjs
- **Verification:** Tests import and call expectedState directly
- **Committed in:** a86b34ef (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to enable planned test cases. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ci:conformance-traces check now passes with 0 divergences
- All 47 validate-traces tests pass

---
*Phase: quick-205*
*Completed: 2026-03-07*
