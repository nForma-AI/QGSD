---
phase: quick-179
plan: 01
subsystem: observability
tags: [observe, todo-scanner, debt-fingerprint, grep, testing]

requires:
  - phase: quick-168
    provides: "Initial handleInternal implementation with 4 scan categories"
provides:
  - "Hardened TODO scanner with NUL-delimited grep parsing for colon-safe paths"
  - "Fingerprint-enriched TODO issues (exception_type, function_name) for debt dedup"
  - "28-test suite covering all 4 internal scan categories"
affects: [observe, debt-writer, fingerprint]

tech-stack:
  added: []
  patterns: ["grep -Z (NUL-delimited output) for safe filename parsing", "grep --exclude-dir for pre-filter instead of post-filter"]

key-files:
  created:
    - bin/observe-handler-internal.test.cjs
  modified:
    - bin/observe-handler-internal.cjs

key-decisions:
  - "Use grep -Z for NUL-delimited parsing instead of colon-splitting to handle edge-case filenames"
  - "Exclude .planning/ at grep level (--exclude-dir) rather than post-filter to fix limit cap accuracy"
  - "Set exception_type=tag and function_name=relPath on TODO issues for unique debt fingerprints"
  - "Rename formatAge to formatAgeFromMtime to disambiguate from observe-handlers.cjs formatAge(isoString)"

patterns-established:
  - "NUL-delimited grep output: always use -Z flag when parsing grep results programmatically"
  - "Pre-filter exclusions: use --exclude-dir at grep level, not post-filter in JS"

requirements-completed: [QUICK-179]

duration: 4min
completed: 2026-03-05
---

# Quick-179 Plan 01: Review TODO Scanner Implementation Summary

**Hardened TODO scanner with NUL-delimited grep parsing, grep-level .planning/ exclusion, and fingerprint-enriched issues for debt dedup -- 28 passing tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T16:25:26Z
- **Completed:** 2026-03-05T16:29:28Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed grep output parsing to use -Z (NUL byte separator) for colon-safe path handling
- Moved .planning/ exclusion from post-filter to --exclude-dir for accurate limit cap
- Enriched TODO issues with exception_type and function_name for unique debt fingerprints
- Added projectRoot existence check (fail-open) before grep execution
- Renamed formatAge to formatAgeFromMtime to avoid confusion with observe-handlers.cjs
- Created 28-test suite covering all 4 scan categories, edge cases, and fail-open behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix TODO scanner bugs and improve robustness** - `4c1012df` (fix)
2. **Task 2: Add comprehensive test suite for handleInternal** - `08b49281` (test)

## Files Created/Modified
- `bin/observe-handler-internal.cjs` - Hardened TODO scanner with 5 bug fixes
- `bin/observe-handler-internal.test.cjs` - 28-test comprehensive test suite

## Decisions Made
- Used grep -Z for NUL-delimited output instead of colon-based splitting to handle edge-case filenames with colons
- Excluded entire .planning/ directory at grep level (not just .planning/formal/generated-stubs) for cleaner results
- Set exception_type to the tag (TODO/FIXME/HACK/XXX) and function_name to the relative file path for debt fingerprint uniqueness
- Kept legacy colon-split fallback in case grep -Z is unavailable on some systems

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TODO scanner is now robust against edge cases and produces distinguishable debt fingerprints
- Test suite provides regression safety for future changes to observe-handler-internal.cjs
- No blockers

---
*Phase: quick-179*
*Completed: 2026-03-05*
