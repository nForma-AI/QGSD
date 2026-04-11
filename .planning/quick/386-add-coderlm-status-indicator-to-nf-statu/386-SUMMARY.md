---
phase: quick-386
plan: 01
subsystem: hooks, coderlm-lifecycle
tags: [statusline, coderlm, lifecycle, indicator, fail-open]
dependency_graph:
  requires: [coderlm-lifecycle.cjs, nf-statusline.js]
  provides: [coderlm status indicator in statusline, coderlm.state.json on start/stop]
  affects: [~/.claude/hooks/nf-statusline.js, ~/.claude/nf-bin/coderlm.state.json]
tech_stack:
  added: []
  patterns: [fail-open PID probe via process.kill(pid, 0), secondary state signal via JSON file]
key_files:
  created: []
  modified:
    - hooks/nf-statusline.js
    - hooks/dist/nf-statusline.js
    - bin/coderlm-lifecycle.cjs
decisions:
  - PID liveness probe uses process.kill(pid, 0) (POSIX signal 0, no-op to target) — throws ESRCH if dead
  - coderlmPart is prepended between gsdUpdate and model name in both output branches
  - _statePath exposed via getter in exports for test isolation (matches _pidPath/_lastqueryPath pattern)
  - _writeState placed before each return in stop() to ensure state written in all exit paths
metrics:
  duration: ~8m
  completed: 2026-04-08
  tasks_completed: 3
  files_modified: 3
---

# Quick Task 386: Add coderlm Status Indicator to nf-statusline Summary

**One-liner:** PID-based green ● coderlm indicator in nf-statusline with state.json secondary signal from coderlm-lifecycle.

## What Was Done

Added a fail-open coderlm server status indicator to `nf-statusline.js` that reads `~/.claude/nf-bin/coderlm.pid` and probes the PID with `process.kill(pid, 0)`. When the server is alive, a green `● coderlm` segment appears between the update indicator and the model name. Any error (file not found, ESRCH, NaN) yields an empty string — no crash, no empty segment.

Also added `_writeState()` helper to `coderlm-lifecycle.cjs` that writes `coderlm.state.json` as a secondary state signal on all start and stop paths. The helper is fail-open and the `_statePath` variable is test-overridable via `_setPaths()`.

Both `hooks/dist/nf-statusline.js` and `~/.claude/hooks/nf-statusline.js` were updated via the installer.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add coderlm indicator to nf-statusline.js | 2ef97111 | hooks/nf-statusline.js |
| 2 | Write coderlm.state.json in coderlm-lifecycle.cjs | 9b8ed039 | bin/coderlm-lifecycle.cjs |
| 3 | Sync hooks/dist and run installer | bebd81eb | hooks/dist/nf-statusline.js |

## Deviations from Plan

None — plan executed exactly as written.

Note: `git add hooks/dist/nf-statusline.js` required `-f` flag because `hooks/dist/` is in `.gitignore` but the file is already tracked. Used `git add -f` to stage the tracked file.

## Formal Coverage

- Formal intersection check: **no intersections found** (exit 2)
- Loop 2 (solution-simulation-loop): **not applicable** — no formal modules affected by changed files
- Result: skipped (not applicable)

## Verification Results

All plan verifications passed:
1. `hooks/nf-statusline.js` — contains `coderlm.pid`, `coderlmIndicator`, `coderlmPart`
2. `hooks/dist/nf-statusline.js` — synced, contains `coderlm.pid`
3. `~/.claude/hooks/nf-statusline.js` — installed, contains `coderlm.pid`
4. `bin/coderlm-lifecycle.cjs` — contains `state.json`, `_writeState`, `_statePath`
5. LivenessProperty1: 3+ `unlinkSync(_pidPath)` calls in stop() — intact
6. Fail-open: empty JSON payload → exit 0, no crash, no empty segment

## Self-Check

- [x] hooks/nf-statusline.js modified — contains coderlm indicator
- [x] hooks/dist/nf-statusline.js synced — contains coderlm indicator
- [x] bin/coderlm-lifecycle.cjs modified — contains _writeState, _statePath, STATE_PATH
- [x] Commits 2ef97111, 9b8ed039, bebd81eb exist
