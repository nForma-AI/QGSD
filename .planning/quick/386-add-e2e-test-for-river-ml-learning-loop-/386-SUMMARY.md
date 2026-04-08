---
phase: quick-386
plan: 01
subsystem: routing-policy, statusline
tags: [river-ml, e2e-test, shadow-mode, statusline]
dependency_graph:
  requires: [quick-384, quick-385]
  provides: [e2e-learning-loop-test, shadow-statusline-display]
  affects: [routing-policy, nf-statusline]
tech_stack:
  added: []
  patterns: [shadow-recommendation-persistence, fail-open-state-write]
key_files:
  created: []
  modified:
    - bin/routing-policy.cjs
    - bin/routing-policy.test.cjs
    - hooks/nf-statusline.js
    - hooks/nf-statusline.test.js
    - hooks/dist/nf-statusline.js
decisions:
  - Shadow recommendations persisted to .nf-river-state.json via lastShadow field
  - Stale shadows cleared when River has no recommendation (fail-open)
  - Shadow display takes visual priority over exploring/active indicators in statusline
  - Yellow ANSI color chosen for shadow to distinguish from green (active) and cyan (exploring)
metrics:
  duration: 2m 2s
  completed: 2026-04-08
  tasks_completed: 2
  tasks_total: 2
  tests_added: 5
  tests_total_pass: 55
---

# Quick Task 386: Add E2E Test for River ML Learning Loop and Surface Shadow Recommendations

E2E integration test proves full River ML pipeline (rewards -> Q-learning -> preference shift -> shadow persistence) and nf-statusline surfaces shadow recommendations in yellow when River has a confident shadow pick.

## Task 1: E2E Learning Loop Test and Shadow Persistence

**Commit:** fe9a97e1

### Changes to routing-policy.cjs
- Added shadow recommendation persistence: when `selectSlotWithPolicy` returns a shadow result, it writes `lastShadow` (recommendation, confidence, taskType, timestamp) to the River state file
- Added stale shadow clearing: when River has no recommendation (no shadow path taken), any existing `lastShadow` is deleted from state
- Both operations are fail-open (wrapped in try/catch)

### New Tests in routing-policy.test.cjs
- **E2E learning loop test** (test 30): Records 25 high rewards for gemini-1 and 25 low for codex-1, verifies Q-table reflects reward history, verifies shadow recommendation is gemini-1, then reverses rewards (30 more) and verifies Q-values shift so codex-1 is now preferred. Documents incumbent bias behavior when River agrees with preset.
- **Shadow clearing test** (test 31): Writes stale lastShadow to state, calls selectSlotWithPolicy with no reward data, verifies lastShadow is removed.

**All 31 routing-policy tests pass.**

## Task 2: Shadow Display in nf-statusline.js

**Commit:** 017878fb

### Changes to nf-statusline.js
- After computing the existing River indicator (exploring/active), checks for `riverState.lastShadow` with a non-null string recommendation
- When shadow exists: overrides indicator to `River: <recommendation> (shadow)` in yellow (`\x1b[33m`)
- When shadow absent or recommendation null: keeps existing exploring/active indicator

### New Tests in nf-statusline.test.js
- **TC21**: Shadow recommendation displayed when lastShadow present -- verifies "River: gemini-1 (shadow)" and yellow ANSI code
- **TC22**: No shadow falls back to "River: active" -- verifies no "shadow" text
- **TC23**: Shadow with null recommendation falls back to normal indicator

**All 24 statusline tests pass. hooks/dist/ synced.**

## Deviations from Plan

None -- plan executed exactly as written.

## Loop 2 Formal Verification

INFO: No formal coverage intersections found -- Loop 2 not needed (GATE-03). Both Task 1 and Task 2 changes checked via formal-coverage-intersect.cjs with exit code 2 (no intersections).

## Verification Results

1. `node --test bin/routing-policy.test.cjs` -- 31/31 pass
2. `node --test hooks/nf-statusline.test.js` -- 24/24 pass
3. `diff hooks/nf-statusline.js hooks/dist/nf-statusline.js` -- files in sync

## Self-Check: PASSED
