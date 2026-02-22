---
phase: quick-45
plan: 01
subsystem: hooks
tags: [circuit-breaker, oscillation-detection, tdd, false-positive, diff-analysis]
dependency_graph:
  requires: []
  provides: [diff-based-oscillation-detection]
  affects: [hooks/qgsd-circuit-breaker.js, ~/.claude/hooks/qgsd-circuit-breaker.js]
tech_stack:
  added: []
  patterns: [git-diff-net-change-heuristic, two-pass-oscillation-detection]
key_files:
  modified:
    - hooks/qgsd-circuit-breaker.js
    - hooks/qgsd-circuit-breaker.test.js
decisions:
  - "Use total net change (additions - deletions) summed across all consecutive oscillating pairs instead of per-pair deletion count; positive sum = TDD growth, zero/negative = true oscillation"
  - "getCommitDiff() wraps git diff <older> <newer> -- <files> with fail-open empty-string return on error"
  - "If all consecutive pairs error out (git unavailable), fall back to treating as oscillation (safety net preserved)"
metrics:
  duration: 334s
  completed: 2026-02-22
  tasks_completed: 2
  files_modified: 2
  tests_added: 2
---

# Quick Task 45: Fix Circuit Breaker False Positive (TDD Pattern) Summary

**One-liner:** Diff-based oscillation detection using total net change (additions - deletions) correctly distinguishes TDD file growth from true content reversion.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace file-set detection with diff-based reversion check | b2d7c21 | hooks/qgsd-circuit-breaker.js |
| 2 | Add CB-TC20/CB-TC21 regression tests and sync installed hook | 7eedb28 | hooks/qgsd-circuit-breaker.js, hooks/qgsd-circuit-breaker.test.js |

## What Was Built

### Problem

The circuit breaker's file-set oscillation algorithm flagged TDD patterns (implement → test → implement → test → implement on the same files) as oscillation. During Phase 18, `gsd-tools.cjs` was committed 3 times across run-groups interspersed with `gsd-tools.test.cjs` commits — matching the A→B→A→B→A alternation pattern — but the commits were purely additive (new functions added each time).

### Solution

**Task 1: `getCommitDiff()` helper and `detectOscillation()` second pass**

Added `getCommitDiff(gitRoot, olderHash, newerHash, files)` that runs `git diff <older> <newer> -- <files>` and returns the raw unified diff string (empty string on git error — fail-open).

Added `hasReversionInHashes(gitRoot, hashes, files)` that computes the total net change (additions - deletions) summed across all consecutive pairs of oscillating commits:
- **Positive total net change** → file grew overall across the run-groups → TDD progression → NOT oscillation
- **Zero or negative total net change** → file didn't grow → content was toggled back → true oscillation

Modified `detectOscillation(fileSets, depth, hashes, gitRoot)` to accept `hashes` and `gitRoot`. After the existing run-group count reaches `>= depth`, the second-pass reversion check runs on the oscillating commit hashes. If it determines TDD progression, detection returns `{ detected: false }`.

Updated `main()` call site: `detectOscillation(fileSets, depth, hashes, gitRoot)`.

**Task 2: CB-TC20 and CB-TC21 regression tests**

- **CB-TC20**: TDD pattern — `gsd-tools.cjs` committed 3 times (fn A, fn B, fn C) with `gsd-tools.test.cjs` and `planning-note.md` commits between them. Each impl commit is purely additive (new functions added, `module.exports` modified but net growth positive). Assert: no state file written.

- **CB-TC21**: True oscillation — `app.js` with `return 1`, filler, `return 2`, filler, `return 1` again. Each consecutive pair has the same content removed and re-added (net change = 0 per pair, total = 0). Assert: state file written with `active: true`.

Installed hook synced: `cp hooks/qgsd-circuit-breaker.js ~/.claude/hooks/qgsd-circuit-breaker.js`.

## Algorithm Design Decision

**Why "net deletions per pair" didn't work:**

In real TDD code, even additive commits modify existing lines (e.g., `module.exports = { fnA }` becomes `module.exports = { fnA, fnB }`). This creates 1 deletion + 2 additions per commit — not purely additive in the diff sense, but clearly TDD growth.

**Why "total net change > 0 means TDD" works:**

- TDD: each impl commit adds functions (net positive) even with minor line modifications; total across pairs is positive.
- Oscillation: symmetric content toggling (line removed, same line re-added) yields net=0 per pair and net=0 total.

**Fail-open behavior preserved:**
- Individual git diff error → skip that pair (don't block).
- All pairs error → treat as oscillation (safety net, original behavior).
- `hashes` or `gitRoot` not provided → skip second pass → original file-set detection still works.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] "Any deletions" trigger was too broad — replaced with total net change**

- **Found during:** Task 2 (CB-TC20 failed — state file was still being written)
- **Issue:** The plan specified "if ANY consecutive pair shows net deletions → real oscillation". This failed for TDD because modifying a line (e.g., `module.exports`) produces 1 deletion + 1+ additions per commit. Even additive TDD commits show deletions in the diff.
- **Root cause:** Real-world TDD modifies existing lines (like `module.exports`) alongside adding new ones; "any deletion" is too coarse a trigger.
- **Fix:** Replaced per-pair deletion check with summing total net change (additions - deletions) across all consecutive pairs. Positive total = TDD growth. Zero or negative = true oscillation.
- **Files modified:** hooks/qgsd-circuit-breaker.js (hasReversionInHashes function)
- **Commit:** 7eedb28

## Verification Results

1. `node --test hooks/qgsd-circuit-breaker.test.js` — 24/24 pass (CB-TC1 through CB-TC21 + BR series)
2. `diff hooks/qgsd-circuit-breaker.js ~/.claude/hooks/qgsd-circuit-breaker.js` — no diff (files identical)
3. `detectOscillation()` — confirmed hashes/gitRoot params present, getCommitDiff() called, fail-open on git error

## Self-Check: PASSED

- [x] `hooks/qgsd-circuit-breaker.js` — exists and contains `getCommitDiff`, `hasReversionInHashes`, `detectOscillation` with new params
- [x] `hooks/qgsd-circuit-breaker.test.js` — exists and contains `CB-TC20`, `CB-TC21`
- [x] `~/.claude/hooks/qgsd-circuit-breaker.js` — exists and is identical to source (diff is empty)
- [x] Commit b2d7c21 — exists (Task 1)
- [x] Commit 7eedb28 — exists (Task 2)
- [x] All 24 tests pass
