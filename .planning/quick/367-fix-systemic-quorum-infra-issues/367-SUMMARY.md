---
phase: quick-367
plan: 01
subsystem: quorum-infrastructure
tags: [gemini-hooks, findProjectRoot, exit-code-handling, session-end]
dependency_graph:
  requires: []
  provides: [gemini-clean-hooks, cwd-aware-project-root, verdict-aware-exit-handling]
  affects: [quorum-dispatch, gemini-cli-integration, session-lifecycle]
tech_stack:
  added: []
  patterns: [GEMINI_SUPPORTED_EVENTS-filter, available_with_warning-telemetry-status]
key_files:
  created:
    - bin/call-quorum-slot-infra.test.cjs
  modified:
    - bin/install.js
    - bin/call-quorum-slot.cjs
    - hooks/nf-session-end.js
decisions:
  - Gemini only supports SessionStart and SessionEnd -- all other hook events are filtered at install time
  - findProjectRoot(cwd) checks cwd first before __dirname walk to avoid stale paths
  - Non-zero exit with valid verdict or substantial output is available_with_warning, not unavailable
metrics:
  duration: ~6 min
  completed: 2026-03-31
---

# Quick 367: Fix Systemic Quorum Infrastructure Issues Summary

Patched 3 root causes of chronic quorum unreliability: Gemini invalid hook events, stale project root resolution, and valid responses discarded on non-zero exit codes.

## What Changed

### Task 1: Gemini Hook Event Filtering + Session-End Hardening (68c76bbb)
- Added `GEMINI_SUPPORTED_EVENTS` constant (SessionStart, SessionEnd) to `bin/install.js`
- All non-Session hook registrations (UserPromptSubmit, Stop, PreToolUse, PostToolUse, PreCompact, SubagentStop, SubagentStart) wrapped in `if (!isGemini)` guard
- Cleanup block removes invalid events from prior Gemini installs
- Added `uncaughtException` handler to `hooks/nf-session-end.js` -- ensures exit(0) under all failure modes
- Synced to `hooks/dist/nf-session-end.js`

### Task 2: findProjectRoot CWD Param + Exit Code Verdict Detection (45bac731)
- `findProjectRoot(cwd)` now checks cwd for `.planning/` before falling back to `__dirname` walk
- All 4 call sites updated to pass `spawnCwd`
- Exit code handling: non-zero exit with valid verdict (APPROVE/BLOCK/FLAG) or output > 100 chars treated as `available_with_warning` with telemetry
- Added `findProjectRoot` to test exports
- Created `bin/call-quorum-slot-infra.test.cjs` with 6 tests (4 findProjectRoot, 2 verdict regex)

### Task 3: Deployment Verification
- Ran `node bin/install.js --claude --global` -- call-quorum-slot.cjs synced to `~/.claude/nf-bin/`
- Ran `node bin/install.js --gemini --global` -- Gemini settings.json cleaned to only SessionStart + SessionEnd
- Verified all 3 fixes deployed: findProjectRoot(spawnCwd), available_with_warning, uncaughtException handler

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Exit code edit silently dropped by tool**
- **Found during:** Task 2
- **Issue:** The Edit tool reported success for the exit code replacement but the file was unchanged (possibly due to the security hook warning)
- **Fix:** Re-applied the edit after Task 2 commit, then amended the commit to include it
- **Files modified:** bin/call-quorum-slot.cjs
- **Commit:** 45bac731 (amended)

**2. [Rule 3 - Blocking] hooks/dist/ is gitignored**
- **Found during:** Task 1
- **Issue:** `git add hooks/dist/nf-session-end.js` was rejected because hooks/dist/ is in .gitignore
- **Fix:** Committed only tracked files (bin/install.js, hooks/nf-session-end.js). The dist copy is synced locally for the installer but not version-controlled.

## Verification Results

- `node --test bin/call-quorum-slot-infra.test.cjs`: 6/6 pass
- `npm run test:ci`: 1385 pass, 8 fail (all 8 are pre-existing nf-stop.test.js failures, unrelated to this change)
- `~/.gemini/settings.json` hooks: only SessionStart + SessionEnd
- `~/.claude/nf-bin/call-quorum-slot.cjs`: contains findProjectRoot(spawnCwd) and available_with_warning
- `~/.claude/hooks/nf-session-end.js`: contains uncaughtException handler
