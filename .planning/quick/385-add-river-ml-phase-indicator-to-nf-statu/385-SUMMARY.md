---
phase: quick-385
plan: 01
subsystem: hooks/statusline
tags: [river-ml, statusline, observability]
dependency_graph:
  requires: [.nf-river-state.json]
  provides: [river-phase-indicator-in-statusline]
  affects: [hooks/nf-statusline.js, hooks/dist/nf-statusline.js, hooks/nf-statusline.test.js]
tech_stack:
  patterns: [fail-silent-file-read, ansi-color-indicators]
key_files:
  modified:
    - hooks/nf-statusline.js
    - hooks/dist/nf-statusline.js
    - hooks/nf-statusline.test.js
decisions:
  - Used RIVER_MIN_EXPLORE=20 constant matching routing-policy.cjs default
  - Placed River indicator after context bar at end of statusline
  - Cyan for exploring, green for active (consistent with existing color semantics)
metrics:
  completed: 2026-04-08
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 385: Add River ML Phase Indicator to nf-statusline.js Summary

River ML phase indicator reads .nf-river-state.json and displays "River: exploring" (cyan) or "River: active" (green) based on whether all Q-table arms have reached the minExplore threshold of 20 visits.

## What Was Done

### Task 1: Add River ML phase indicator to nf-statusline.js
**Commit:** 296e6672

Added a River ML phase indicator section to `hooks/nf-statusline.js` that:
- Reads `.nf-river-state.json` from the workspace directory via `fs.readFileSync` in a try/catch
- Parses the qTable structure and iterates all task types and arms
- Shows "River: exploring" in cyan when any arm has visits < 20
- Shows "River: active" in green when all arms have visits >= 20
- Shows nothing when file is missing, malformed, or qTable is empty
- Appended `${riverIndicator}` to both output paths (with task and without task)
- Copied source to `hooks/dist/nf-statusline.js` to keep dist in sync

**Files modified:** hooks/nf-statusline.js, hooks/dist/nf-statusline.js

### Task 2: Add test coverage for River ML phase indicator
**Commit:** 32ca7b5e

Added 6 new test cases (TC15-TC20) to `hooks/nf-statusline.test.js`:
- TC15: River exploring -- arm with visits below minExplore (cyan ANSI)
- TC16: River active -- all arms above minExplore (green ANSI)
- TC17: No state file -- no River indicator
- TC18: Malformed state file -- no River indicator, exit 0 (fail-silent)
- TC19: Mixed task types -- one exploring, one active shows exploring
- TC20: Empty qTable -- no River indicator

All 21 statusline tests pass (15 existing + 6 new).

**Files modified:** hooks/nf-statusline.test.js

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. `node --test hooks/nf-statusline.test.js` -- 21/21 tests pass
2. `npm test` -- full suite runs; 16 pre-existing failures in conformance-trace tests (unrelated to statusline)
3. `diff hooks/nf-statusline.js hooks/dist/nf-statusline.js` -- no differences
4. Manual smoke test with real `.nf-river-state.json` shows "River: exploring" in cyan

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 296e6672 | feat(quick-385): add River ML phase indicator to nf-statusline.js |
| 2 | 32ca7b5e | test(quick-385): add River ML phase indicator test coverage (TC15-TC20) |
