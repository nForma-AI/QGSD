---
phase: 368-robust-quorum-fail-fast-3-layers
plan: 01
subsystem: quorum-dispatch
tags: [fail-fast, scoreboard, cooldown, idle-timeout]
dependency_graph:
  requires: [bin/update-scoreboard.cjs, bin/planning-paths.cjs]
  provides: [scoreboard-cooldown-wiring, pre-dispatch-cooldown-check]
  affects: [bin/call-quorum-slot.cjs, bin/providers.json]
tech_stack:
  patterns: [fail-open-try-catch, spawnSync-fire-and-forget, local-file-cooldown-check]
key_files:
  modified:
    - bin/call-quorum-slot.cjs
    - bin/providers.json
decisions:
  - "Layer 1 already had correct idle_timeout_ms values in providers.json -- no changes needed"
  - "setScoreboardCooldown uses spawnSync with 3s timeout and empty catch for fail-open"
  - "Pre-dispatch cooldown check does NOT re-set cooldown via setScoreboardCooldown (avoids infinite re-set loop)"
metrics:
  duration: ~3 min
  completed: 2026-03-31
---

# Phase 368 Plan 01: 3-Layer Robust Quorum Fail-Fast Summary

Wire three fail-fast layers into quorum slot dispatch: tuned per-provider idle timeouts, failure-to-scoreboard cooldown bridging via spawnSync, and pre-dispatch cooldown check that skips cooling-down slots instantly.

## Task Results

### Task 1: Tune idle timeouts and wire failure-to-scoreboard cooldown

| Aspect | Result |
|--------|--------|
| Commit | cd8f893f |
| Files  | bin/call-quorum-slot.cjs, bin/providers.json |
| Status | Complete |

**Layer 1 -- idle_timeout_ms tuning:**
- providers.json already had correct values: codex-1=30000, gemini-1=45000, opencode-1=20000, copilot-1=30000
- claude-1 through claude-6 retain 90000 (ccr routing has different latency characteristics)
- Installed copy synced to ~/.claude/nf-bin/providers.json

**Layer 2 -- writeFailureLog to set-availability bridge:**
- Added `setScoreboardCooldown(slotName, errorMsg)` helper after `clearFailureOnSuccess()`
- Uses `spawnSync('node', [update-scoreboard.cjs, 'set-availability', ...])` with 3s timeout
- Wrapped in try/catch with empty catch (fail-open)
- Wired after all 3 `writeFailureLog()` call sites:
  1. Unknown provider type path
  2. Non-zero exit with no valid output path
  3. Catch block exception path

**Layer 3 -- Pre-dispatch scoreboard cooldown check:**
- Added between prompt validation and dual timeout resolution in `main()`
- Reads scoreboard.json via planning-paths.cjs `resolveWithFallback()`
- Checks `availability[slot].available_at_iso` against `Date.now()`
- If cooling down: logs COOLDOWN message to stderr, records COOLDOWN_ACTIVE telemetry, writes failure log, exits 1
- Does NOT call `setScoreboardCooldown()` in cooldown-exit path (slot already cooling down)
- Entire block wrapped in try/catch with empty catch (fail-open)

## Verification

- `grep -c 'setScoreboardCooldown' bin/call-quorum-slot.cjs` = 4 (1 definition + 3 call sites)
- `grep -c 'idle_timeout_ms.*90000' bin/providers.json` = 6 (only claude slots)
- `grep 'COOLDOWN_ACTIVE' bin/call-quorum-slot.cjs` finds the pre-dispatch check
- `grep 'set-availability' bin/call-quorum-slot.cjs` finds the helper function
- `node --check bin/call-quorum-slot.cjs` passes
- Installed providers.json synced (no diff)

## Deviations from Plan

None - plan executed exactly as written. Layer 1 idle_timeout_ms values were already correct in providers.json (set in a prior task), so no edits were needed there.

## Pre-existing Issues (Out of Scope)

8 test failures in nf-stop.test.js pre-date this change and are unrelated to quorum slot dispatch.
