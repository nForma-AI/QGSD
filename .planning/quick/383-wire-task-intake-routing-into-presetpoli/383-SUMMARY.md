---
phase: quick-383
plan: 01
subsystem: routing
tags: [routing-policy, preset-policy, routing-hint, delegation, quick-mode]

requires:
  - phase: quick-382
    provides: PresetPolicy and RiverPolicy tier 0/1 routing interface
provides:
  - routingHint parameter on PresetPolicy.recommend for task-intake integration
  - --delegate and --force-quorum flags documented in quick.md and help.md
affects: [task-intake, quorum-slot-dispatch, quick-workflow]

tech-stack:
  added: []
  patterns: [routing-hint-preference-with-fallback]

key-files:
  created: []
  modified:
    - bin/routing-policy.cjs
    - bin/routing-policy.test.cjs
    - commands/nf/quick.md
    - core/workflows/help.md

key-decisions:
  - "routingHint uses case-insensitive substring match for slot name flexibility"
  - "Invalid or ineligible hints silently fall through to first-eligible (no error)"

patterns-established:
  - "Routing hint preference: hinted slot preferred when eligible, silent fallback otherwise"

requirements-completed: []

duration: 2min
completed: 2026-04-07
---

# Quick 383: Wire Task-Intake Routing into PresetPolicy Summary

**PresetPolicy accepts routingHint parameter for task-intake integration, with --delegate and --force-quorum flags documented in quick.md and help.md**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-07T13:05:24Z
- **Completed:** 2026-04-07T13:06:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- PresetPolicy.recommend accepts optional routingHint (string or {executor} object), prefers hinted slot when eligible
- selectSlotWithPolicy passes opts.routingHint through to preset policy
- 5 new tests covering hint preference, object form, ineligible fallback, unknown slot fallback, and passthrough
- quick.md argument-hint updated with --delegate and --force-quorum flags
- help.md Quick Mode section expanded with flags table and usage examples

## Task Commits

Each task was committed atomically:

1. **Task 1: Add routingHint parameter to PresetPolicy and tests** - `4566945c` (feat)
2. **Task 2: Update quick.md metadata and help.md delegation docs** - `40ef3ab3` (feat)

## Files Created/Modified
- `bin/routing-policy.cjs` - Added routingHint parameter to PresetPolicy.recommend, passthrough in selectSlotWithPolicy
- `bin/routing-policy.test.cjs` - Added 5 new tests for routingHint preference and fallback
- `commands/nf/quick.md` - Updated argument-hint, added --delegate and --force-quorum descriptions
- `core/workflows/help.md` - Replaced Quick Mode section with flags table and examples

## Decisions Made
- Used case-insensitive substring match for routingHint to allow flexible slot naming
- Invalid/ineligible hints silently fall through to first-eligible subprocess (fail-open pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- routingHint is ready for task-intake skill to pass routing recommendations through to PresetPolicy
- --delegate flag is documented but the actual CLI parsing in quick.md workflow needs separate wiring
