---
phase: quick-222
plan: 01
subsystem: hooks
tags: [pretooluse, git-guard, destructive-ops, session-insights]

requires:
  - phase: none
    provides: n/a
provides:
  - PreToolUse hook warning on destructive git ops with uncommitted changes
  - CLAUDE.md rules for commit-before-destructive-ops and validate-before-apply
affects: [hooks, install, config-loader]

tech-stack:
  added: []
  patterns: [warn-only PreToolUse hook, stderr advisory without blocking]

key-files:
  created:
    - hooks/nf-destructive-git-guard.js
    - hooks/nf-destructive-git-guard.test.js
  modified:
    - .claude/rules/git-workflow.md
    - .claude/rules/coding-style.md
    - hooks/config-loader.js
    - hooks/config-loader.test.js
    - bin/install.js
    - scripts/build-hooks.js
    - package.json

key-decisions:
  - "Hook is warn-only via stderr, never blocks tool calls (consistent with circuit-breaker preemptive check)"
  - "Hook registered at Normal priority (50) since it is advisory, not safety-critical"
  - "Added to standard and strict profiles, not minimal"

patterns-established:
  - "Warn-only PreToolUse pattern: detect condition, emit stderr, exit(0) without stdout"

requirements-completed: []

duration: 12min
completed: 2026-03-08
---

# Quick 222: Session-Insight-Driven Improvements Summary

**PreToolUse destructive-git-guard hook with 9 tests, plus CLAUDE.md rules for commit-before-destructive-ops and validate-before-apply patterns**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-08T15:32:06Z
- **Completed:** 2026-03-08T15:44:34Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Added Destructive Operations Guard rules to git-workflow.md (3 rules addressing git stash rework cycles)
- Added Validate Before Apply rules to coding-style.md (3 rules addressing config/refactor gaps)
- Created nf-destructive-git-guard.js PreToolUse hook with regex detection for git stash/reset --hard/checkout --/clean -f
- 9 test cases covering fail-open, no-op, clean tree, and dirty tree warning scenarios
- Full pipeline integration: install.js registration, build-hooks.js, dist sync, test:ci inclusion

## Task Commits

Each task was committed atomically:

1. **Task 1: Add session-insight-driven rules to CLAUDE.md rule files** - `39c96d0e` (feat)
2. **Task 2: Create PreToolUse destructive-git-guard hook with tests** - `38a8192d` (feat)
3. **Task 3: Register hook in install.js, add to build-hooks, sync to dist** - `3d644a39` (feat)

## Files Created/Modified
- `.claude/rules/git-workflow.md` - Added Destructive Operations Guard section with 3 rules
- `.claude/rules/coding-style.md` - Added Validate Before Apply section with 3 rules
- `hooks/nf-destructive-git-guard.js` - PreToolUse hook detecting destructive git ops
- `hooks/nf-destructive-git-guard.test.js` - 9 test cases for the hook
- `hooks/config-loader.js` - Added hook to HOOK_PROFILE_MAP (standard, strict) and DEFAULT_HOOK_PRIORITIES
- `hooks/config-loader.test.js` - Updated profile size assertions (13->14)
- `bin/install.js` - Added buildHookCommand registration for PreToolUse
- `scripts/build-hooks.js` - Added to HOOKS_TO_COPY array
- `package.json` - Added test to test:ci list

## Decisions Made
- Hook uses warn-only pattern (stderr output, no stdout decision) -- consistent with circuit-breaker preemptive evidence check
- Registered at Normal priority (50) -- advisory, not critical path
- Added to standard and strict profiles but not minimal -- minimal is for safety-critical hooks only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated config-loader profile count tests**
- **Found during:** Task 3
- **Issue:** Adding hook to standard/strict profiles increased size from 13 to 14, breaking HPM-TC3/TC4
- **Fix:** Updated test assertions from 13 to 14
- **Files modified:** hooks/config-loader.test.js
- **Verification:** `node --test hooks/config-loader.test.js` passes all 64 tests
- **Committed in:** 3d644a39 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary correction for test consistency. No scope creep.

## Issues Encountered
None

## User Setup Required
None - hook is automatically registered via `node bin/install.js --claude --global`.

## Next Phase Readiness
- Destructive git guard is active and will warn on destructive operations
- Rules are immediately visible to Claude Code via .claude/rules/ convention

---
*Quick: 222-use-those-insights-to-recommend-improvem*
*Completed: 2026-03-08*
