---
phase: quick-137
plan: 01
title: Fix empty roster handling — add validation and graceful degradation
date_completed: 2026-03-03
tasks_completed: 2
files_created: 0
files_modified: 7
commits: 1
commit_hash: 2f9058c5
---

# Quick-137 Summary: Fix Empty Roster Handling

## Objective
Add validation and graceful degradation for empty roster (providers.json with zero providers configured). Prevents crashes and provides clear diagnostic messages when no agents are configured, making onboarding and misconfiguration scenarios safe.

## Execution Overview

All tasks completed successfully. No deviations from plan. All existing tests continue to pass.

### Task 1: Add empty-roster guards to quorum dispatch pipeline

**Status:** COMPLETE

Added empty-roster guards to four core files:

1. **hooks/qgsd-prompt.js** — Guard at line ~423
   - Detects `orderedSlots.length === 0` (no external agents configured)
   - Falls back to SOLO_MODE with clear warning message
   - Wraps remaining dispatch logic in `else` block to prevent undefined access

2. **bin/call-quorum-slot.cjs** — Guard after line 444
   - Checks `providers.length === 0` after finding providers file
   - Outputs clear error: "No providers configured in providers.json — cannot dispatch slot"
   - Exits with code 1

3. **bin/probe-quorum-slots.cjs** — Guard after line 133
   - Checks `providers.length === 0` after finding providers file
   - Outputs diagnostic: "No providers configured in providers.json — skipping probe"
   - Emits empty JSON array `[]` and exits 0 (fail-open)

4. **bin/unified-mcp-server.mjs** — Guard after loading config (line ~27)
   - Detects `!Array.isArray(providers) || providers.length === 0`
   - Logs warning: "No providers configured in providers.json — server will start with zero tools"
   - Normalizes providers to empty array and continues (not a fatal error)

### Task 2: Add defensive guards to TUI scoreboard and add empty-roster tests

**Status:** COMPLETE

1. **bin/qgsd.cjs** — Defensive access pattern
   - Line ~1493: Changed `pdata.providers.map()` to use `providersList = pdata.providers || []`
   - Prevents TypeError when providers is null/undefined
   - Added guard in `buildScoreboardLines()` (line ~1318) to show "No agents configured" message instead of empty scoreboard

2. **bin/qgsd.test.cjs** — New tests added
   - Test: "readProvidersJson: handles empty providers array gracefully"
     - Writes `{ "providers": [] }` to disk and verifies parsing
   - Test: "buildTimeoutChoices: returns empty array for empty providers"
     - Verifies timeout choices function handles empty providers without crashing

3. **hooks/dist/qgsd-prompt.js** — Synced
   - Copied from updated hooks/qgsd-prompt.js
   - Verified diff shows no differences
   - Installed globally via `node bin/install.js --claude --global`

## Verification Results

All success criteria met:

- ✓ `orderedSlots.length === 0` guard present in hooks/qgsd-prompt.js
- ✓ `providers.length === 0` guard present in bin/call-quorum-slot.cjs
- ✓ `providers.length === 0` guard present in bin/probe-quorum-slots.cjs
- ✓ `No providers configured` guard present in bin/unified-mcp-server.mjs
- ✓ Defensive `providersList` access present in bin/qgsd.cjs
- ✓ Empty providers guard in buildScoreboardLines function
- ✓ New empty-roster tests added to bin/qgsd.test.cjs
- ✓ hooks/qgsd-prompt.js synced to hooks/dist/qgsd-prompt.js (zero diff)
- ✓ Global hook installation confirmed (guard present in ~/.claude/hooks/qgsd-prompt.js)
- ✓ All existing tests pass (integration verified via npm test)

## Files Modified

1. `hooks/qgsd-prompt.js` — Added empty roster guard with solo mode fallback
2. `hooks/dist/qgsd-prompt.js` — Synced copy
3. `bin/call-quorum-slot.cjs` — Added empty providers array check
4. `bin/probe-quorum-slots.cjs` — Added empty providers array check
5. `bin/unified-mcp-server.mjs` — Added empty providers warning guard
6. `bin/qgsd.cjs` — Added defensive providers access and empty guard in scoreboard
7. `bin/qgsd.test.cjs` — Added tests for empty providers scenarios

## Deviations from Plan

None — plan executed exactly as written.

## Key Implementation Details

**Fail-open pattern:** All guards follow the fail-open pattern used throughout the codebase:
- Empty providers → graceful degradation, not crashes
- Solo mode fallback in qgsd-prompt.js with clear diagnostic message
- Empty arrays and safe defaults in CLI tools
- TUI scoreboard shows helpful "Run /qgsd:mcp-setup" message instead of crashing

**Testing:** New tests verify:
- Empty providers.json can be read without errors
- Empty providers array handled in timeout choice building
- All guards are syntactically correct and present in source

## Deployment

Installed globally via installer. Hook is now active at `~/.claude/hooks/qgsd-prompt.js` with the empty roster guard.

## Duration

Completed in single execution session. All tasks in one wave.

## Notes

The implementation ensures that even with zero providers configured, QGSD can:
1. Fall back to solo quorum mode (Claude only, still functional)
2. Provide clear error messages that guide users to fix the misconfiguration
3. Never crash with cryptic "undefined" or "TypeError" messages
4. Make onboarding scenarios safe and debuggable
