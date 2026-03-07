---
phase: quick-206
plan: 01
subsystem: formal-verification
tags: [gate-a, grounding, diff-scoping, instrumentation-map, cli]

requires:
  - phase: none
    provides: existing gate-a-grounding.cjs and instrumentation-map.json
provides:
  - "--base-ref flag for diff-scoped grounding analysis"
  - "getChangedActions function mapping git diff to instrumentation actions"
  - "normalizePath utility for cross-platform path matching"
affects: [nf-solve, ci-gates, formal-verification]

tech-stack:
  added: []
  patterns: [diff-scoped analysis via instrumentation-map file-to-action mapping]

key-files:
  created: []
  modified:
    - bin/gate-a-grounding.cjs
    - bin/gate-a-grounding.test.cjs

key-decisions:
  - "getChangedActions returns null for graceful degradation rather than throwing"
  - "Scoped actions determined by matching normalized git diff paths against instrumentation-map emission_points"
  - "Empty scoped actions set triggers fallback to global mode with stderr warning"

patterns-established:
  - "Diff-scoping pattern: git diff -> file list -> instrumentation-map lookup -> action set -> event filter"

requirements-completed: [GATE-01]

duration: 4min
completed: 2026-03-07
---

# Quick 206: Add --base-ref to gate-a-grounding.cjs Summary

**Diff-scoped Gate A grounding via --base-ref flag using instrumentation-map file-to-action mapping with graceful degradation to global mode**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T13:06:01Z
- **Completed:** 2026-03-07T13:09:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `--base-ref <sha>` CLI flag that scopes grounding analysis to only actions from files changed since the given commit
- Scoped grounding score enforces 80% target independently; global score reported as informational
- Graceful degradation: bad git ref, missing/malformed instrumentation-map.json, and empty scoped actions all fall back to global mode with stderr warnings
- Path normalization prevents silent scope mismatches between git diff output and instrumentation-map entries
- 7 new tests covering scoped filtering, independence, edge cases, schema validation, backward compatibility, graceful degradation, and path normalization

## Task Commits

Each task was committed atomically:

1. **Task 1: Add --base-ref diff-scoped grounding** - `763a4e69` (feat)
2. **Task 2: Add tests for --base-ref scoping logic** - `6f366654` (test)

## Files Created/Modified
- `bin/gate-a-grounding.cjs` - Added --base-ref parsing, getChangedActions(), normalizePath(), diff-scoped CLI output with scope object
- `bin/gate-a-grounding.test.cjs` - 7 new tests in "diff-scoped grounding (--base-ref)" describe block

## Decisions Made
- getChangedActions returns `{ scopedActions, changedFiles }` object or `null` for graceful fallback -- null triggers global mode in caller
- Path normalization strips leading `./` and uses `path.normalize()` for cross-platform consistency
- Empty scoped actions (changed files exist but none have emission points) falls back to global mode rather than reporting 0/0

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- --base-ref flag ready for integration into nf:solve remediation flow and CI gates
- instrumentation-map.json must be up-to-date for accurate scoping

---
*Phase: quick-206*
*Completed: 2026-03-07*
