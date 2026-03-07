---
phase: quick-219
plan: 01
subsystem: observability
tags: [health-check, observe, self-development, diagnostics]

requires:
  - phase: quick-215
    provides: observe handler internal framework with 14 categories
provides:
  - Category 15 health diagnostics in observe-handler-internal.cjs
  - Self-development gate (QGSD repo only) for health check surfacing
affects: [observe, health, solve]

tech-stack:
  added: []
  patterns: [self-development gate via core/bin/gsd-tools.cjs existence check]

key-files:
  created: []
  modified:
    - bin/observe-handler-internal.cjs
    - bin/observe-handler-internal.test.cjs

key-decisions:
  - "Self-development gate checks core/bin/gsd-tools.cjs existence (not resolveScript) to restrict Category 15 to QGSD repo only"
  - "Repairable warnings route to /nf:health --repair, non-repairable to /nf:solve"

patterns-established:
  - "Self-development gate pattern: check projectRoot-relative file to restrict feature to source repo"

requirements-completed: [QUICK-219]

duration: 26min
completed: 2026-03-07
---

# Quick 219: Wire nf:health Diagnostics into nf:observe Summary

**Category 15 health diagnostics added to observe-handler-internal.cjs, mapping E/W/I codes to observe issues with severity-based routing and QGSD-only self-development gate**

## Performance

- **Duration:** 26 min
- **Started:** 2026-03-07T13:53:44Z
- **Completed:** 2026-03-07T14:19:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added Category 15 (nf:health diagnostics) to observe-handler-internal.cjs with fail-open pattern
- Self-development gate prevents execution outside QGSD repo via core/bin/gsd-tools.cjs existence check
- Health errors map to severity 'error', warnings to 'warning' (repairable ones route to /nf:health --repair), info to 'info'
- 4 new tests: gate skip, issue mapping with severities/routes, fail-open on non-JSON, fail-open on non-zero exit

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Category 15 health diagnostics to handleInternal** - `911a2b88` (feat)
2. **Task 2: Add Category 15 tests** - `ea645d56` (test)

## Files Created/Modified
- `bin/observe-handler-internal.cjs` - Added Category 15 health diagnostics block, updated header and JSDoc
- `bin/observe-handler-internal.test.cjs` - Added 4 Category 15 tests (gate, mapping, fail-open x2)

## Decisions Made
- Self-development gate uses `path.join(projectRoot, 'core', 'bin', 'gsd-tools.cjs')` existence check rather than `resolveScript()` to ensure Category 15 only runs in the QGSD source repo, not consumer repos
- Repairable warnings route to `/nf:health --repair` while non-repairable warnings and all other severities route to `/nf:solve`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failures in formatAgeFromMtime tests (6 failures) due to incorrect import from observe-handler-internal.cjs instead of observe-utils.cjs -- not caused by this task, not fixed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Health diagnostics now surface automatically in /nf:observe output when running in QGSD repo
- No blockers

---
*Phase: quick-219*
*Completed: 2026-03-07*
