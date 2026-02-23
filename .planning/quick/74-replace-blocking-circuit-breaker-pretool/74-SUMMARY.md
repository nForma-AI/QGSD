---
phase: quick
plan: 74
subsystem: circuit-breaker
tags: [hooks, circuit-breaker, non-blocking, oscillation-detection]
one-liner: "Circuit breaker changed from hard-blocking deny to non-blocking allow with PRIORITY NOTICE warning injected into Claude's context"
key-decisions:
  - "Keep detection algorithm and Haiku reviewer unchanged; only change enforcement action"
  - "permissionDecision: 'deny' → 'allow'; warning text in permissionDecisionReason field"
  - "buildBlockReason renamed to buildWarningNotice to reflect non-blocking semantics"
  - "oscillation-resolution-mode.md rewritten to describe notification-based trigger, not deny message parsing"
key-files:
  modified:
    - hooks/qgsd-circuit-breaker.js
    - hooks/qgsd-prompt.js
    - get-shit-done/workflows/oscillation-resolution-mode.md
    - hooks/dist/qgsd-circuit-breaker.js (gitignored, updated for install)
    - hooks/dist/qgsd-prompt.js (gitignored, updated for install)
metrics:
  duration: "~8 min"
  completed: "2026-02-23"
  tasks: 4
  files: 5
---

# Quick Task 74: Replace Blocking Circuit Breaker with Non-Blocking Notification — Summary

## What Was Done

Removed the hard-blocking `permissionDecision: "deny"` behavior from the circuit breaker PreToolUse hook. All tool calls now proceed regardless of oscillation state. When oscillation is detected (or the state file shows active oscillation), the hook emits a priority warning via `permissionDecisionReason` with `permissionDecision: "allow"` so Claude sees the notice but is not blocked.

## Changes Made

### hooks/qgsd-circuit-breaker.js

- Changed both enforcement paths (`state.active` existing case + new detection case) from `permissionDecision: 'deny'` to `permissionDecision: 'allow'`
- Renamed `buildBlockReason()` to `buildWarningNotice()` with updated message: "OSCILLATION DETECTED — PRIORITY NOTICE" instead of "CIRCUIT BREAKER ACTIVE"
- Warning text updated: "Fix the oscillation in the listed files before continuing. Do NOT make more commits to these files until the root cause is resolved."
- Read-only command check (`isReadOnly`) retained for skipping detection (not for selective blocking)
- Detection algorithm, Haiku reviewer, state file writing — all unchanged
- Export updated: `module.exports = { buildWarningNotice }`

### hooks/qgsd-prompt.js

- Updated fallback context message (when workflow file not found) to say "Tool calls are NOT blocked — you can still read and write files — but you MUST resolve the oscillation before making further commits."
- The `isBreakerActive` injection path and `additionalContext` injection are unchanged

### get-shit-done/workflows/oscillation-resolution-mode.md

- `<purpose>` and `<trigger>` sections rewritten to describe notification-based trigger, not deny message parsing
- Step 1 title changed from "Read the Deny Message" to "Read the Warning Notice"
- All references to "blocked", "deny message", "permissionDecision: deny" removed
- `<constraints>` updated: "No commits to the oscillating file set until user approves" (not "no write Bash commands")
- Success criteria updated accordingly

### Install sync

- `hooks/dist/qgsd-circuit-breaker.js` and `hooks/dist/qgsd-prompt.js` updated manually (dist is gitignored)
- `node bin/install.js --claude --global` run — installed hooks in `~/.claude/hooks/` verified to use `permissionDecision: 'allow'`

## Verification

- `~/.claude/hooks/qgsd-circuit-breaker.js` grep for `permissionDecision`: returns only `'allow'` — no `'deny'`
- `~/.claude/hooks/qgsd-prompt.js` fallback message updated: "Tool calls are NOT blocked"
- `~/.claude/qgsd/workflows/oscillation-resolution-mode.md` updated with notification language

## Deviations from Plan

**1. [Rule 1 - Discovery] hooks/dist/ is gitignored**
- Found during: Task 4 (install sync)
- Issue: install.js copies from `hooks/dist/` not `hooks/` directly; dist is gitignored so git add fails
- Fix: manually copied updated files to `hooks/dist/` before re-running install; committed without dist files
- Files modified: hooks/dist/ (untracked, gitignored)

## Self-Check: PASSED

- hooks/qgsd-circuit-breaker.js: updated, committed in 03b4800
- hooks/qgsd-prompt.js: updated, committed in 03b4800
- get-shit-done/workflows/oscillation-resolution-mode.md: updated, committed in 03b4800
- ~/.claude/hooks/qgsd-circuit-breaker.js: contains 'allow', no 'deny'
