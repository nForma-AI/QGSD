---
phase: quick-230
plan: 01
subsystem: solver-tui
tags: [solve, tui, requirements, feedback-loops, rebrand-suppression]

requires:
  - phase: quick-228
    provides: solve-tui.cjs standalone TUI
  - phase: quick-229
    provides: nForma.cjs F5 Solve integration
provides:
  - addRequirement() and nextRequirementId() in requirements-core.cjs
  - createRequirementFromItem() and createTodoFromItem() in solve-tui.cjs
  - Category-aware action menus in nForma.cjs showItemDetail()
  - D->C rebrand auto-suppression in nf-solve.cjs sweepDtoC()
affects: [solver-tui, nForma, requirements]

tech-stack:
  added: []
  patterns: [category-aware-action-menus, atomic-file-writes, rebrand-pattern-suppression]

key-files:
  created: []
  modified:
    - bin/requirements-core.cjs
    - bin/solve-tui.cjs
    - bin/nForma.cjs
    - bin/nf-solve.cjs

key-decisions:
  - "REBRAND_PATTERNS placed after FP ack check but before user regex patterns for clean layering"
  - "SOLVE- prefix for auto-generated requirement IDs to distinguish from hand-authored requirements"
  - "TODO items use timestamp-based IDs (TODO-{epoch}) for uniqueness without scanning"

patterns-established:
  - "Category-aware action menus: showItemDetail() branches on catKey for different action sets"
  - "Atomic file creation pattern: write to .tmp then rename for todos.json and requirements.json"

requirements-completed: [QUICK-230]

duration: 4min
completed: 2026-03-08
---

# Quick 230: Close All Solver Feedback Loops in TUI Solve Module Summary

**Category-aware Create Requirement / Create TODO actions in TUI Solve, plus D->C rebrand auto-suppression via REBRAND_PATTERNS**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-08T21:37:51Z
- **Completed:** 2026-03-08T21:42:24Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `addRequirement()` and `nextRequirementId()` to requirements-core.cjs for programmatic requirement creation with atomic writes and duplicate detection
- Added `createRequirementFromItem()` and `createTodoFromItem()` to solve-tui.cjs, bridging solver items to requirements.json and todos.json
- Updated nForma.cjs `showItemDetail()` to show category-aware action menus: Create Requirement for C->R/T->R/D->R, Create TODO for D->C
- Added rebrand auto-suppression in sweepDtoC() for qgsd-core/, qgsd-, /qgsd/ path patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Add requirement creation and TODO helpers** - `4f9d1c41` (feat)
2. **Task 2: Wire category-aware actions and D->C rebrand suppression** - `d762995f` (feat)

## Files Created/Modified
- `bin/requirements-core.cjs` - Added addRequirement() and nextRequirementId() functions
- `bin/solve-tui.cjs` - Added createRequirementFromItem() and createTodoFromItem() helpers
- `bin/nForma.cjs` - Category-aware action menus in showItemDetail()
- `bin/nf-solve.cjs` - REBRAND_PATTERNS auto-suppression in sweepDtoC()

## Decisions Made
- REBRAND_PATTERNS placed after acknowledged FP check but before user-defined regex patterns for clean suppression layering
- Used SOLVE- prefix for auto-generated requirement IDs to distinguish solver-discovered requirements from hand-authored ones
- TODO items use timestamp-based IDs for uniqueness without needing to scan existing IDs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four solver feedback loops are now closed: ctor->req, ttor->req, dtor->req, dtoc->todo
- Requirements created via TUI will appear in requirements.json with status "Proposed" for human review
- TODOs created via TUI will appear in .planning/todos.json for tracking

---
*Phase: quick-230*
*Completed: 2026-03-08*
