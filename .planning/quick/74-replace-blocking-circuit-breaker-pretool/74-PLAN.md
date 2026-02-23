---
phase: quick
plan: 74
type: quick
title: Replace blocking circuit breaker PreToolUse hook with non-blocking notification
---

# Quick Task 74: Replace Blocking Circuit Breaker with Non-Blocking Notification

## Objective

Remove the hard-blocking `permissionDecision: "deny"` behavior from `qgsd-circuit-breaker.js`. Replace with a non-blocking approach that still detects oscillation but allows all tool calls through — emitting a warning via the hook's reason/output field that Claude sees.

## Tasks

### Task 1: Rewrite qgsd-circuit-breaker.js as non-blocking PreToolUse

Change the blocking enforcement logic so that:
- Oscillation detection (run-collapse algorithm + Haiku reviewer) stays unchanged
- When oscillation is detected: write state file as before, but return `permissionDecision: "allow"` with the warning in the reason field
- When state is already active: return `permissionDecision: "allow"` with the warning — no longer deny write commands
- Remove the `isReadOnly` enforcement gate (read-only detection can stay for skipping detection on reads, but should not be used for selective blocking)
- `buildBlockReason` renamed to `buildWarningNotice` with updated language (PRIORITY NOTICE instead of CIRCUIT BREAKER ACTIVE block)

### Task 2: Update qgsd-prompt.js to update context language

The `isBreakerActive` context injection in qgsd-prompt.js currently says "PreToolUse circuit breaker has blocked execution." Update that fallback message to reflect the new non-blocking design — it notifies rather than blocks.

### Task 3: Update oscillation-resolution-mode.md

Remove all references to "blocked", "deny message", "permissionDecision: deny" — rewrite trigger and step 1 for notification-based flow.

### Task 4: Install sync — copy updated hooks to ~/.claude/hooks/

Run `node bin/install.js --claude --global` to sync hooks source to installed copies.

## Success Criteria

- All tool calls (Read, Bash, Glob, Write, Edit) proceed unblocked even when circuit breaker is active
- Oscillation detection still writes state file when detected
- Warning notice visible in hook output/reason that Claude sees
- qgsd-prompt.js additionalContext injection still fires when breaker is active (unchanged behavior)
- oscillation-resolution-mode.md describes notification approach, not hard block
- Both hooks/ source and ~/.claude/hooks/ are in sync
