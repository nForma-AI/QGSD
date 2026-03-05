---
phase: quick-183
plan: 01
subsystem: tooling
tags: [migration, formal-verification, solver]

requires:
  - phase: none
    provides: n/a
provides:
  - "bin/migrate-formal-dir.cjs standalone migration script for legacy .formal/ to .planning/formal/"
  - "Step 0 in solve.md for automatic legacy layout detection before diagnostic sweep"
affects: [solve, formal-verification]

tech-stack:
  added: []
  patterns: [fail-open migration, canonical-wins conflict resolution]

key-files:
  created: [bin/migrate-formal-dir.cjs]
  modified: [commands/qgsd/solve.md]

key-decisions:
  - "Canonical .planning/formal/ always wins on file conflicts (no merge, no overwrite)"
  - "Legacy .formal/ is never auto-removed — user must pass --remove-legacy explicitly"
  - "Step 0 is fail-open — migration errors never block the diagnostic sweep"

patterns-established:
  - "Legacy directory migration: detect, merge (canonical wins), log, preserve (no auto-delete)"

requirements-completed: [QUICK-183]

duration: 4min
completed: 2026-03-05
---

# Quick Task 183: Add Legacy .formal/ Migration Step Summary

**Standalone migration script (bin/migrate-formal-dir.cjs) and Step 0 in solve.md that auto-detects and merges legacy .formal/ into .planning/formal/ before the diagnostic sweep**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T17:49:56Z
- **Completed:** 2026-03-05T17:54:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created bin/migrate-formal-dir.cjs with detect/merge/skip/remove/json modes and fail-open error handling
- Added Step 0: Legacy .formal/ Migration to solve.md before Step 1, with absolute path fallback and fail-open semantics
- Verified: no-legacy exit, JSON output, integration test with actual file migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bin/migrate-formal-dir.cjs** - `606d6867` (feat)
2. **Task 2: Add Step 0 to solve.md** - `c5368b60` (feat)

## Files Created/Modified
- `bin/migrate-formal-dir.cjs` - Standalone migration script: detects legacy .formal/, merges into .planning/formal/ (canonical wins), supports --json, --remove-legacy, --project-root flags
- `commands/qgsd/solve.md` - Added Step 0: Legacy .formal/ Migration before diagnostic sweep; updated skill description to mention migration

## Decisions Made
- Canonical .planning/formal/ always wins on file conflicts — legacy versions are skipped, not merged or compared
- Legacy .formal/ directory is preserved by default — --remove-legacy flag required for deletion (safety-first)
- Step 0 is fail-open: if migration script is missing or errors, solver proceeds to Step 1 without blocking

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Migration script is ready for inclusion in bin/install.js if global installation is desired
- solve.md Step 0 will silently no-op on projects without legacy .formal/

---
*Phase: quick-183*
*Completed: 2026-03-05*
