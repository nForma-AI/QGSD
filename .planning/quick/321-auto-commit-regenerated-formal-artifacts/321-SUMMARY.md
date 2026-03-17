---
phase: quick-321
plan: 01
subsystem: hooks
tags: [stop-hook, auto-commit, formal-artifacts, fail-open]

requires:
  - phase: none
    provides: standalone quick task
provides:
  - "Auto-commit of dirty .planning/formal/ files at session end via Stop hook"
affects: [nf-stop, formal-verification, session-lifecycle]

tech-stack:
  added: []
  patterns: [fail-open auto-commit, protected-branch guard, post-decision side-effect]

key-files:
  created: []
  modified:
    - hooks/nf-stop.js
    - hooks/dist/nf-stop.js

key-decisions:
  - "Placed auto-commit after evidence refresh as post-decision side effect"
  - "Used gsd-tools.cjs commit for consistency with project commit patterns"
  - "Hardcoded protected branches (main, master) rather than config-driven"

patterns-established:
  - "Post-decision side effects in Stop hook: placed after quorum logic, wrapped in try/catch fail-open"

requirements-completed: [QUICK-321]

duration: 1min
completed: 2026-03-17
---

# Quick 321: Auto-commit Regenerated Formal Artifacts Summary

**Stop hook auto-commits dirty .planning/formal/ files at session end with branch safety guard and fail-open error handling**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-17T13:29:25Z
- **Completed:** 2026-03-17T13:30:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `autoCommitFormalArtifacts()` function to nf-stop.js with protected-branch guard, dirty-file detection (git diff + ls-files), and gsd-tools.cjs commit with [auto] tag
- Synced to hooks/dist/ and installed globally so next session picks up the change
- Defense-in-depth: function-level try/catch plus call-site try/catch ensures fail-open behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Add autoCommitFormalArtifacts function** - `3eb47ae6` (feat)
2. **Task 2: Sync to hooks/dist/ and install globally** - `e1c7c002` (chore)

## Files Created/Modified
- `hooks/nf-stop.js` - Added autoCommitFormalArtifacts function and call site after evidence refresh
- `hooks/dist/nf-stop.js` - Synced copy for installer distribution

## Decisions Made
- Placed the auto-commit call after evidence refresh and before process.exit(0), keeping it as a post-decision side effect that cannot affect quorum PASS/BLOCK logic
- Used gsd-tools.cjs commit (not raw git) for consistency with project commit conventions
- Hardcoded protected branches ['main', 'master'] to keep the function self-contained without config dependency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auto-commit is active in the globally installed hook
- Future sessions will automatically persist dirty formal artifacts before exit
