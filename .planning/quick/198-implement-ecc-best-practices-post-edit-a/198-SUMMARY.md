---
phase: quick-198
plan: 01
subsystem: hooks
tags: [post-edit-format, console-guard, prettier, biome, claude-rules]

requires: []
provides:
  - PostToolUse hook for auto-formatting JS/TS files after Edit
  - Stop hook for console.log warnings in modified files
  - Modular .claude/rules/ directory with project conventions
affects: [hooks, install, config-loader]

tech-stack:
  added: []
  patterns: [post-edit-format-hook, console-guard-hook, claude-rules-directory]

key-files:
  created:
    - hooks/nf-post-edit-format.js
    - hooks/nf-console-guard.js
    - .claude/rules/security.md
    - .claude/rules/coding-style.md
    - .claude/rules/testing.md
    - .claude/rules/git-workflow.md
  modified:
    - hooks/config-loader.js
    - bin/install.js
    - .gitignore

key-decisions:
  - "Added .gitignore negation for .claude/rules/ since .claude/ was gitignored but rules files need to be tracked"

patterns-established:
  - "PostToolUse hooks without matcher: tool_name filtering inside hook code (Claude Code PostToolUse does not support matcher)"
  - "Stop hooks with decision: warn for advisory-only checks"

requirements-completed: [ECC-01, ECC-02, ECC-03]

duration: 4min
completed: 2026-03-06
---

# Quick Task 198: ECC Best Practices Summary

**PostToolUse auto-format hook (prettier/biome), Stop console.log guard, and modular .claude/rules/ with nForma-specific conventions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T21:21:01Z
- **Completed:** 2026-03-06T21:24:39Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Created PostToolUse hook that auto-formats JS/TS files after Edit operations, auto-detecting prettier or biome
- Created Stop hook that warns (never blocks) about leftover console.log statements in git-modified files
- Created four modular .claude/rules/ files covering security, coding style, testing, and git workflow conventions
- Registered both hooks in install.js (install + uninstall paths) and config-loader.js HOOK_PROFILE_MAP
- Both hooks added to standard and strict profiles (not minimal)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create post-edit auto-format and console-guard hooks** - `c20c66ad` (feat)
2. **Task 2: Register hooks in install.js and config-loader.js, sync to dist** - `d12e2d1e` (feat)
3. **Task 3: Create modular .claude/rules/ directory with project-specific rules** - `833ead9d` (feat)

## Files Created/Modified
- `hooks/nf-post-edit-format.js` - PostToolUse hook: auto-formats JS/TS files after Edit using prettier or biome
- `hooks/nf-console-guard.js` - Stop hook: warns about console.log in modified files, never blocks
- `hooks/config-loader.js` - Added both hooks to standard and strict HOOK_PROFILE_MAP profiles
- `hooks/dist/nf-post-edit-format.js` - Dist copy for install
- `hooks/dist/nf-console-guard.js` - Dist copy for install
- `hooks/dist/config-loader.js` - Dist copy for install
- `bin/install.js` - Registration (install + uninstall) for both hooks
- `.claude/rules/security.md` - Security rules (fail-open, no secrets in git, stderr-only debug)
- `.claude/rules/coding-style.md` - Coding style (CommonJS, strict mode, config-loader pattern)
- `.claude/rules/testing.md` - Testing conventions (vitest, fail-open tests, known failures)
- `.claude/rules/git-workflow.md` - Git workflow (install sync, dist pattern, /nf: prefix)
- `.gitignore` - Added negation for .claude/rules/ to allow tracking

## Decisions Made
- Added `.gitignore` negation (`!.claude/rules/`) because `.claude/` was fully gitignored but rules files need to be version-controlled for team consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] .gitignore negation for .claude/rules/**
- **Found during:** Task 3 (Create .claude/rules/ directory)
- **Issue:** `.claude/` was gitignored, preventing commit of rules files
- **Fix:** Changed `.claude/` to `.claude/*` with `!.claude/rules/` negation in .gitignore
- **Files modified:** .gitignore
- **Verification:** `git check-ignore` confirms rules files are no longer ignored while other .claude/ files remain ignored
- **Committed in:** 833ead9d (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix to allow tracking rules files. No scope creep.

## Issues Encountered
None

## User Setup Required
None - hooks are auto-installed via `node bin/install.js --claude --global`.

## Next Phase Readiness
- Both hooks are operational and installed globally
- Rules files are auto-loaded by Claude Code from .claude/rules/
- No blockers

---
*Quick Task: 198*
*Completed: 2026-03-06*
