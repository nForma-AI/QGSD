---
phase: quick-164
plan: 01
subsystem: infra
tags: [uppaal, verifyta, formal-verification, installer]

requires:
  - phase: none
    provides: none
provides:
  - UPPAAL verifyta auto-download and extraction via install-formal-tools.cjs
  - Local verifyta discovery fallback in run-uppaal.cjs
affects: [formal-verification, uppaal, quorum-races]

tech-stack:
  added: [uppaal-5.0.0]
  patterns: [platform-specific-download, gatekeeper-handling, idempotent-install]

key-files:
  created: []
  modified:
    - bin/install-formal-tools.cjs
    - bin/run-uppaal.cjs
    - .gitignore

key-decisions:
  - "Added .formal/uppaal/bin/ to .gitignore to prevent committing 8MB binary"
  - "Used recursive find fallback for macOS .app bundle layout where verifyta location varies"

patterns-established:
  - "UPPAAL install follows same try/catch non-blocking pattern as PRISM section"

requirements-completed: [UPPAAL-01, UPPAAL-02, UPPAAL-03]

duration: 2min
completed: 2026-03-04
---

# Quick Task 164: Add UPPAAL verifyta Installation Summary

**UPPAAL verifyta auto-downloaded to .formal/uppaal/bin/ with local discovery fallback in run-uppaal.cjs, closing the uppaal:quorum-races INCONCLUSIVE gap**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T18:50:15Z
- **Completed:** 2026-03-04T18:52:31Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- UPPAAL verifyta binary auto-installed to .formal/uppaal/bin/verifyta by install-formal-tools.cjs
- run-uppaal.cjs discovers local verifyta without VERIFYTA_BIN env var
- uppaal:quorum-races no longer reports INCONCLUSIVE due to missing binary
- Idempotent install (skips if already present), non-blocking (exits 0 on failure)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add UPPAAL verifyta section to install-formal-tools.cjs** - `57270595` (feat)
2. **Task 2: Update run-uppaal.cjs to discover locally installed verifyta** - `8caf29e4` (feat)

## Files Created/Modified
- `bin/install-formal-tools.cjs` - Added UPPAAL download/extract section with platform detection, Gatekeeper handling, and sibling lib copying
- `bin/run-uppaal.cjs` - Added local fallback path in locateVerifyta() between env var and PATH checks
- `.gitignore` - Added .formal/uppaal/bin/ to prevent committing 8MB binary

## Decisions Made
- Added .formal/uppaal/bin/ to .gitignore (Rule 2 - prevent accidental commit of 8MB binary)
- Used recursive `find` fallback for macOS .app bundle where verifyta binary location varies across versions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added .formal/uppaal/bin/ to .gitignore**
- **Found during:** Task 1
- **Issue:** 8MB verifyta binary would be committed to git without gitignore entry
- **Fix:** Added `.formal/uppaal/bin/` to .gitignore, consistent with other formal tool binaries
- **Files modified:** .gitignore
- **Verification:** `git check-ignore .formal/uppaal/bin/verifyta` confirms ignored
- **Committed in:** 57270595 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for preventing large binary commits. No scope creep.

## Issues Encountered
None

## User Setup Required
None - verifyta is automatically downloaded by `node bin/install-formal-tools.cjs`.

## Next Phase Readiness
- verifyta binary available for all formal verification checks
- uppaal:quorum-races check can now produce pass/fail results instead of inconclusive
- The verifyta model error (`option '--disable-memory-reduction' cannot be specified more than once`) is a pre-existing model configuration issue, not related to this task

---
*Quick Task: 164*
*Completed: 2026-03-04*
