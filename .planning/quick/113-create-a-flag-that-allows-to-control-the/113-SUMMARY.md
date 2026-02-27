---
phase: quick-113
plan: 01
subsystem: hooks
tags: [quorum, hooks, --n-flag, solo-mode, performance]
dependency_graph:
  requires: []
  provides: [--n N quorum size override, solo mode self-quorum]
  affects: [hooks/qgsd-prompt.js, hooks/qgsd-stop.js, CLAUDE.md]
tech_stack:
  added: []
  patterns: [flag parsing via regex, solo mode guard, N-1 ceiling enforcement]
key_files:
  created: []
  modified:
    - hooks/qgsd-prompt.js
    - hooks/qgsd-stop.js
    - hooks/dist/qgsd-prompt.js
    - hooks/dist/qgsd-stop.js
    - CLAUDE.md
decisions:
  - "--n 1 uses QGSD_SOLO_MODE marker in additionalContext; stop hook reads prompt text directly from transcript, not the injected context"
  - "Stop hook maxSize for --n N is N-1 (external models only; Claude's vote is implicit)"
  - "cappedSlots slices orderedSlots to N-1 length so step list in instructions reflects the actual cap"
  - "dist/ files are gitignored but tracked; required force-add (-f) to stage changes"
metrics:
  duration: 190s
  completed: 2026-02-27
  tasks_completed: 2
  files_modified: 5
---

# Quick Task 113: --n N flag to control quorum size Summary

**One-liner:** `--n N` per-invocation quorum size override: `--n 1` = Claude-only self-quorum, `--n N` = cap at N-1 external slots; both hooks updated and installed.

## What Was Built

Added a `--n N` flag that users can append to any `/qgsd:` planning command to control quorum size for that single invocation, without touching `qgsd.json`.

### `parseQuorumSizeFlag(text)` helper

Identical implementation in both hooks:
```js
function parseQuorumSizeFlag(prompt) {
  const m = prompt.match(/--n\s+(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return (Number.isInteger(n) && n >= 1) ? n : null;
}
```

### `hooks/qgsd-prompt.js` changes

- Calls `parseQuorumSizeFlag(prompt)` immediately after reading the prompt string
- `--n 1`: Injects solo mode context block beginning with `<!-- QGSD_SOLO_MODE -->` and `SOLO MODE ACTIVE (--n 1)` — skips all external slot-worker Task dispatch steps
- `--n N` (N>1): Sets `maxSize = N`, caps `orderedSlots` to `N-1` external slots (`cappedSlots`), injects `QUORUM SIZE OVERRIDE (--n N)` note in `minNote`
- No `--n`: Behavior unchanged (config-driven `maxSize` and full `orderedSlots`)

### `hooks/qgsd-stop.js` changes

- Added `parseQuorumSizeFlag(text)` helper
- Added `extractPromptText(currentTurnLines)` to read user's prompt from the transcript (tag-first, 300-char fallback)
- **GUARD 6**: Solo mode bypass — when `quorumSizeOverride === 1`, logs `quorum_complete` conformance event with `slots_available: 0` and exits 0 (no block)
- N-1 ceiling: `maxSize = quorumSizeOverride - 1` when `--n N` (N>1) is detected, overriding config value

### CLAUDE.md update (constraint-specified)

Added `--n 1` exception clause to R3.5 Consensus Rules, documenting that self-quorum is intentionally allowed when the user explicitly passes `--n 1`.

## Verification Results

All 6 checks passed:
1. `node --check hooks/qgsd-prompt.js` — PASS
2. `node --check hooks/qgsd-stop.js` — PASS
3. `diff hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js` — NO DIFF
4. `diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js` — NO DIFF
5. `--n 1` prompt: `QGSD_SOLO_MODE` present, no slot-worker steps — PASS
6. `--n 3` prompt: `QUORUM SIZE OVERRIDE (--n 3)`, 2 external slots listed — PASS
7. No flag prompt: standard `QUORUM REQUIRED` text, no override — PASS
8. Solo mode stop hook smoke test: exit 0, empty stdout (no block) — PASS

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add parseQuorumSizeFlag and --n N override to qgsd-prompt.js | f2ec34c |
| 2 | Add solo mode bypass and N-1 ceiling to qgsd-stop.js, sync dist | 00920b5 |

## Deviations from Plan

### Minor implementation adjustment

**1. [Rule 1 - Bug] cappedSlots instead of full orderedSlots for step generation**
- **Found during:** Task 1 implementation
- **Issue:** Plan said to "cap" external slots but the step list generation loop iterated `orderedSlots` (all slots). Without capping, `--n 3` would still show all 10 slots in the instructions despite the override note saying "2 external slots".
- **Fix:** Introduced `cappedSlots = orderedSlots.slice(0, externalSlotCap)` and used `cappedSlots` for step generation, `hasMixed` check, and `afterSteps` calculation.
- **Files modified:** hooks/qgsd-prompt.js
- **Commit:** f2ec34c

**2. [Rule 3 - Blocking] dist/ files require force-add**
- **Found during:** Task 2 commit
- **Issue:** `hooks/dist/` is in `.gitignore` but files are tracked. `git add` without `-f` was rejected by gitignore advisory.
- **Fix:** Used `git add -f hooks/dist/qgsd-prompt.js hooks/dist/qgsd-stop.js` to stage tracked-but-gitignored files.
- **Files modified:** hooks/dist/qgsd-prompt.js, hooks/dist/qgsd-stop.js
- **Commit:** 00920b5

## Self-Check: PASSED

All files found on disk. All commits verified in git log.
