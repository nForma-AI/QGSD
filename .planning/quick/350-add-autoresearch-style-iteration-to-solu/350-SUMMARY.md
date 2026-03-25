---
phase: quick-350
plan: 01
subsystem: formal-verification
tags: [simulation-loop, onTweakFix, TSV-as-memory, when-stuck, autoresearch]

requires:
  - phase: quick-348
    provides: autoresearch-refine pattern (onTweak, TSV, when-stuck, rollback)
provides:
  - solution-simulation-loop with onTweakFix callback for iterative fix refinement
  - TSV-as-memory logging for simulation iterations
  - when-stuck protocol for same-gate failure detection
  - in-memory rollback tracking on gate regression
  - model-driven-fix Phase 4.5 module API (require instead of CLI)
affects: [model-driven-fix, solution-simulation, cycle2-simulations]

tech-stack:
  added: []
  patterns: [onTweakFix callback for agent-driven iteration, TSV-as-memory logging, failure signature stuck detection]

key-files:
  created: []
  modified:
    - bin/solution-simulation-loop.cjs
    - bin/solution-simulation-loop.test.cjs
    - commands/nf/model-driven-fix.md

key-decisions:
  - "onTweakFix is on input object (not deps) — it is caller-provided logic, not a dependency"
  - "Rollback is conceptual (DISCARDED status) not file-based — consequence models are generated fresh each iteration"
  - "When-stuck uses failure signature string comparison for exact gate pattern matching"
  - "Default maxIterations changed from 3 to 10 for autoresearch-style exploration"

patterns-established:
  - "onTweakFix callback pattern: async (currentFixIdea, ctx) => revisedFixIdea|null"
  - "TSV-as-memory for simulation iterations: simulation-results.tsv alongside reproducing model"
  - "Failure signature stuck detection: gate1:PASS,gate2:FAIL,gate3:PASS pattern matching"

requirements-completed: [INTENT-01]

duration: 6min
completed: 2026-03-25
---

# Quick Task 350: Add Autoresearch-Style Iteration to Solution Simulation Loop Summary

**onTweakFix callback, in-memory rollback tracking, TSV-as-memory logging, and when-stuck protocol added to solution-simulation-loop.cjs with 19 passing tests and Phase 4.5 module API wiring**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-25T07:27:38Z
- **Completed:** 2026-03-25T07:33:46Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Refactored solution-simulation-loop.cjs with 4 new capabilities mirroring autoresearch-refine.cjs patterns
- 19 tests pass (10 existing + 9 new) covering all new behaviors including edge cases
- model-driven-fix.md Phase 4.5 updated from CLI to require() with onTweakFix callback wiring

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor solution-simulation-loop.cjs** - `61d2c7ef` (feat)
2. **Task 2: Add comprehensive tests** - `80a4b87b` (test)
3. **Task 3: Update model-driven-fix.md Phase 4.5** - `1cd50f66` (feat)

## Files Created/Modified
- `bin/solution-simulation-loop.cjs` - Added onTweakFix, rollback tracking, TSV logging, when-stuck protocol, default 10 iterations
- `bin/solution-simulation-loop.test.cjs` - 9 new tests for all new behaviors + fix to existing test 6 for when-stuck compatibility
- `commands/nf/model-driven-fix.md` - Phase 4.5 updated from CLI dispatch to require() with onTweakFix and extended result handling

## Decisions Made
- onTweakFix placed on input object (not deps) since it is caller-provided logic
- Rollback is status-based (DISCARDED) not file-based — consequence models regenerated fresh each iteration from reproducing model + mutations
- When-stuck uses exact failure signature matching (gate1:PASS,gate2:FAIL,gate3:PASS pattern strings)
- Default maxIterations intentionally changed from 3 to 10 for autoresearch-style exploration

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Handle null verdict from no-op iterations in onTweakFix context**
- **Found during:** Task 2 (Test 12 — onTweakFix returning null)
- **Issue:** When previous iteration was a no-op (verdict=null), next iteration's onTweakFix context building crashed on null.gate1_invariants
- **Fix:** Added null check for prevVerdict — returns default {gate1:false, gate2:false, gate3:false} when null
- **Files modified:** bin/solution-simulation-loop.cjs
- **Verification:** Test 12 passes
- **Committed in:** 80a4b87b (Task 2 commit)

**2. [Rule 1 - Bug] Fix existing test 6 when-stuck false positive**
- **Found during:** Task 2 (Test 6 failing with 3 iterations instead of 5)
- **Issue:** Test 6 used identical gate failure patterns every iteration, triggering when-stuck at iteration 3 instead of running all 5
- **Fix:** Changed test 6 to alternate failure patterns (gate1/gate2 toggle) to avoid stuck detection
- **Files modified:** bin/solution-simulation-loop.test.cjs
- **Verification:** Test 6 passes with 5 iterations
- **Committed in:** 80a4b87b (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Solution simulation loop now supports agent-driven iteration with learning
- Ready for integration with model-driven-fix workflow end-to-end testing
- onTweakFix callback pattern available for callers to implement fix refinement logic

---
*Phase: quick-350*
*Completed: 2026-03-25*
