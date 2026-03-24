---
phase: quick-347
plan: 01
subsystem: formal-verification
tags: [formal-models, scope-json, coverage-detection, fail-open, workflow]

requires:
  - phase: n/a
    provides: "existing scope.json files in .planning/formal/spec/"
provides:
  - "bin/formal-coverage-intersect.cjs — detects changed files overlapping formal model coverage"
  - "--sync mode for model-driven-fix workflow"
  - "Pre-commit formal coverage auto-detection in quick.md and execute-phase.md executors"
affects: [model-driven-fix, quick, execute-phase, formal-verification]

tech-stack:
  added: []
  patterns: ["fail-open formal coverage detection", "glob-based source_files matching reused from formal-scope-scan.cjs"]

key-files:
  created:
    - bin/formal-coverage-intersect.cjs
    - bin/formal-coverage-intersect.test.cjs
  modified:
    - core/workflows/model-driven-fix.md
    - core/workflows/quick.md
    - core/workflows/execute-phase.md

key-decisions:
  - "No scope ID derivation — detector only answers yes/no for coverage overlap, then runs full verify"
  - "globToRegex reused from formal-scope-scan.cjs rather than adding minimatch dependency"
  - "Fail-open on all detection errors — formal checks never block commits"

patterns-established:
  - "Hybrid A+B pattern: auto-detect coverage intersection at commit time, run full verification when overlap found"

requirements-completed: []

duration: 3min
completed: 2026-03-24
---

# Quick Task 347: Implement Hybrid A+B Formal Model Sync Summary

**Coverage intersection detector maps changed files to formal spec modules via scope.json source_files, with --sync fast path and executor auto-detection wiring**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-24T18:37:13Z
- **Completed:** 2026-03-24T18:40:17Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- Created bin/formal-coverage-intersect.cjs that scans all .planning/formal/spec/*/scope.json files and detects overlap with changed file paths using glob matching
- Added --sync mode to model-driven-fix.md that runs full formal verification without diagnosis phases
- Wired pre-commit formal coverage auto-detection into both quick.md and execute-phase.md executor constraints

## Task Commits

Each task was committed atomically:

1. **Task 1: Create formal-coverage-intersect.cjs with tests** - `d364d156` (feat)
2. **Task 2: Add --sync mode and executor auto-detection wiring** - `1cb41d81` (feat)

## Files Created/Modified
- `bin/formal-coverage-intersect.cjs` - CLI tool: takes --files, scans scope.json source_files, returns JSON with matched modules
- `bin/formal-coverage-intersect.test.cjs` - 10 unit tests covering edge cases (missing files, globs, parse errors, multiple modules)
- `core/workflows/model-driven-fix.md` - Added --sync flag and sync_fast_path step
- `core/workflows/quick.md` - Added formal coverage auto-detection constraint before atomic commits
- `core/workflows/execute-phase.md` - Added formal_coverage_auto_detection block in executor prompt

## Decisions Made
- No scope ID derivation needed — the detector only checks file overlap, then full verify runs all models (fast enough at <10s)
- Reused globToRegex from formal-scope-scan.cjs (same algorithm, no external deps)
- All detection is fail-open: missing tools, parse errors, and verification failures never block commits

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed JSDoc comment syntax error in formal-coverage-intersect.cjs**
- **Found during:** Task 1 (initial creation)
- **Issue:** JSDoc comment `/** Scan all spec/*/scope.json */` — the `*/` in the glob path prematurely closed the comment block, causing SyntaxError
- **Fix:** Changed from JSDoc `/** */` to single-line `//` comment
- **Files modified:** bin/formal-coverage-intersect.cjs
- **Verification:** Script runs without syntax errors, all 10 tests pass
- **Committed in:** d364d156 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial syntax fix, no scope change.

## Issues Encountered
None beyond the JSDoc comment fix noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Coverage intersection detector ready for use by executors
- --sync mode available for model-driven-fix workflow
- Auto-detection wiring in place for both quick and phase executors

---
*Phase: quick-347*
*Completed: 2026-03-24*
