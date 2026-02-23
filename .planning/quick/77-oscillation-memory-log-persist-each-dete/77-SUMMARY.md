---
phase: quick-77
plan: "01"
subsystem: circuit-breaker
tags: [oscillation, memory-log, haiku, PostToolUse, suppression, persistence]
dependency_graph:
  requires: [quick-56, quick-74]
  provides: [oscillation-log-persistence, PostToolUse-convergence-detection]
  affects: [hooks/qgsd-circuit-breaker.js, bin/install.js]
tech_stack:
  added: [crypto (node built-in)]
  patterns: [fileSetHash:patternHash keyed log, spawnSync node -e for sync Haiku call, fail-open writes]
key_files:
  created: []
  modified:
    - hooks/qgsd-circuit-breaker.js
    - hooks/dist/qgsd-circuit-breaker.js
    - bin/install.js
    - .gitignore
decisions:
  - "oscillation-log.json keyed by fileSetHash:patternHash using SHA-1 (12-char prefixes) — deterministic, stable across runs"
  - "manualResetAt does NOT set resolvedAt — it is an audit trail field only; PreToolUse only suppresses on resolvedAt"
  - "PostToolUse convergence check fires only when Bash tool runs with active (unresolved) oscillation log entries"
  - "legacy state.active entries use fileSetHash:legacy key since full fileSets history unavailable at that point"
  - "dist/qgsd-circuit-breaker.js updated manually (cp from source) before install sync since it is gitignored"
metrics:
  duration: "~8 min"
  completed: "2026-02-23"
  tasks: 2
  files_modified: 4
---

# Quick-77 Summary: Oscillation Memory Log with Haiku PostToolUse Convergence Detection

**One-liner:** Persisted oscillation log keyed by fileSetHash:patternHash with Haiku PostToolUse convergence detection and PreToolUse suppression for already-resolved patterns.

## What Was Built

The circuit breaker previously re-warned on every PreToolUse after detecting oscillation, even if the loop was fixed. This plan adds a persistent memory log at `.planning/oscillation-log.json` that tracks each detected oscillation keyed by a hash of its file set and commit pattern. PreToolUse checks `resolvedAt` before emitting the warning and suppresses it silently if set. PostToolUse on Bash tool calls Haiku to detect if a fix was just committed — on YES verdict, writes `resolvedAt` + `resolvedByCommit` + `haikuRationale` and removes the circuit-breaker-state.json.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add oscillation-log helpers and suppression to qgsd-circuit-breaker.js | b2ba55e | hooks/qgsd-circuit-breaker.js |
| 2 | Update --reset-breaker in install.js, add .gitignore entry, run install sync | 15c0966 | bin/install.js, .gitignore, hooks/dist/qgsd-circuit-breaker.js |

## Decisions Made

1. **fileSetHash:patternHash key scheme** — SHA-1 of sorted file list + SHA-1 of run-group sequence. 12-char prefixes. Deterministic and stable: same oscillation produces same key across independent sessions.

2. **manualResetAt vs resolvedAt separation** — `--reset-breaker` stamps `manualResetAt` as an audit trail only. PreToolUse suppression only checks `resolvedAt` (set by PostToolUse Haiku or future tooling). This ensures manual resets don't permanently silence warnings.

3. **PostToolUse only fires on Bash with active entries** — Short-circuits immediately if `activeKeys.length === 0` to avoid unnecessary API calls on every Bash execution. Reads the oscillation log on each invocation (fast fs read).

4. **legacy key for state.active branch** — When the breaker is already active from a previous session (state file exists), we don't have the full `fileSets` array to recompute `patternHash`. Key falls back to `fileSetHash:legacy` so suppression still works for those entries once manually resolved.

5. **dist/ sync required** — `hooks/dist/` is gitignored but is what the installer actually copies. Updated via `cp hooks/qgsd-circuit-breaker.js hooks/dist/qgsd-circuit-breaker.js` before re-running install. Confirmed IN SYNC.

## Deviations from Plan

**1. [Rule 1 - Bug] Updated hooks/dist/ before install sync**
- **Found during:** Task 2 verification
- **Issue:** First install run copied OLD `hooks/dist/qgsd-circuit-breaker.js` (459 lines) to `~/.claude/hooks/`. The installer reads from `dist/` not `hooks/` directly. Result was OUT OF SYNC.
- **Fix:** `cp hooks/qgsd-circuit-breaker.js hooks/dist/qgsd-circuit-breaker.js` then re-ran install.
- **Files modified:** hooks/dist/qgsd-circuit-breaker.js (gitignored)
- **Commit:** 15c0966 (dist change was tracked since file was already in git history before .gitignore entry)

## Self-Check: PASSED

All files found:
- FOUND: hooks/qgsd-circuit-breaker.js
- FOUND: bin/install.js
- FOUND: .gitignore

All commits found:
- FOUND: b2ba55e (Task 1)
- FOUND: 15c0966 (Task 2)
