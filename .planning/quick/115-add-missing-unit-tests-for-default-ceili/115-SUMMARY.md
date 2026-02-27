---
phase: quick-115
plan: 01
subsystem: testing, formal-verification
tags: [tests, tla+, stop-hook, prompt-hook, quorum]
dependency_graph:
  requires: []
  provides: [TC-DEFAULT-CEIL-BLOCK-fixed, TC-PROMPT-N-CAP, TC-PROMPT-SOLO, TC-PROMPT-PREFER-SUB-DEFAULT, TLA-MaxSize]
  affects: [hooks/qgsd-stop.test.js, hooks/qgsd-prompt.test.js, formal/tla/QGSDQuorum.tla, formal/tla/MCsafety.cfg, formal/tla/MCliveness.cfg]
tech_stack:
  added: []
  patterns: [node:test, TLA+ CONSTANTS, TLC INVARIANT]
key_files:
  created: []
  modified:
    - hooks/qgsd-stop.test.js
    - hooks/qgsd-prompt.test.js
    - formal/tla/QGSDQuorum.tla
    - formal/tla/MCsafety.cfg
    - formal/tla/MCliveness.cfg
decisions:
  - "Used numbered step regex (\\d+\\. Task\\() instead of bare Task\\( to avoid matching header prose in TC-PROMPT-N-CAP count assertion"
  - "Fixed pre-existing TC-CEIL-2/3 failures (minSize->maxSize config key) as Rule 1 auto-fix since target was 32/32 pass"
  - "TC-N-OVERRIDE tests use correct toolu_ IDs (not toulu_ typo found during implementation)"
metrics:
  duration: "~12 minutes"
  completed: "2026-02-27"
  tasks_completed: 2
  files_modified: 5
---

# Phase quick-115 Plan 01: Add Missing Unit Tests for Default Ceiling, --n 1 Solo Mode, --n N Ceiling Override Summary

**One-liner:** Added 5 stop-hook tests (TC-DEFAULT-CEIL, TC-SOLO-STOP, TC-N-OVERRIDE), 3 prompt-hook tests (TC-PROMPT-N-CAP, TC-PROMPT-SOLO, TC-PROMPT-PREFER-SUB-DEFAULT), fixed 2 pre-existing minSize/maxSize test failures, and extended QGSDQuorum.tla with MaxSize constant plus QuorumCeilingMet invariant.

## What Was Built

### Task 1 — Fix stop tests and add missing hook tests

**Problem 1: TC-DEFAULT-CEIL-BLOCK was not testing correctly**

The TC-DEFAULT-CEIL-PASS and TC-DEFAULT-CEIL-BLOCK tests (pre-existing working-tree addition) used `--files PLAN.md` in their Bash commit blocks. The `hasArtifactCommit` function requires the filename to match `/-PLAN\.md/` (hyphen before PLAN.md). `PLAN.md` alone does not match, so `isDecisionTurn = false` and the hook exits 0 without checking quorum — meaning TC-DEFAULT-CEIL-BLOCK incorrectly passed.

**Fix:** Changed both test cases to use `--files quick-115-PLAN.md`, which matches the `-PLAN.md` pattern.

**Problem 2: TC-CEIL-2 and TC-CEIL-3 used wrong config key**

Both pre-existing tests specified `quorum: { minSize: 5 }` but the stop hook reads `config.quorum.maxSize`. With `minSize` but no `maxSize`, the hook defaulted to 2. Tests expected blocking behavior at 5 required calls but hook only required 2.

**Fix (Rule 1 - Bug):** Changed `minSize: 5` to `maxSize: 5` in both TC-CEIL-2 and TC-CEIL-3 configurations.

**New stop tests added:**
- TC-DEFAULT-CEIL-PASS: 3-slot pool (2 sub + 1 api), no maxSize config → default ceiling=2, 2 sub calls satisfy ceiling → pass
- TC-DEFAULT-CEIL-BLOCK: same pool, only 1 sub call → block
- TC-SOLO-STOP: `--n 1` in prompt → GUARD 6 bypass, exits 0 with zero external calls
- TC-N-OVERRIDE-PASS: config maxSize=5, `--n 3` → N-1=2 required, 2 calls satisfy → pass
- TC-N-OVERRIDE-BLOCK: config maxSize=5, `--n 3` → N-1=2 required, 1 call → block

**New prompt tests added:**
- TC-PROMPT-N-CAP: `--n 3` with 5 active slots → QUORUM SIZE OVERRIDE announced, exactly 2 numbered step Task lines
- TC-PROMPT-SOLO: `--n 1` → SOLO MODE ACTIVE injected, `<!-- QGSD_SOLO_MODE -->` present, 0 numbered step Task lines
- TC-PROMPT-PREFER-SUB-DEFAULT: no `quorum.preferSub` key → defaults true, sub-slot-1 appears before api-slot-1

**Implementation note for TC-PROMPT-N-CAP:** The regex `Task\(subagent_type="qgsd-quorum-slot-worker"` matches 3 occurrences when only 2 step lines are present because the NEVER instruction line also contains `Task(subagent_type="qgsd-quorum-slot-worker")`. Fixed by using `\d+\. Task\(` to match only numbered step lines.

### Task 2 — Add MaxSize constant to TLA+ model

**QGSDQuorum.tla changes:**
- Updated header from "GENERATED — do not edit by hand" to "Hand-extended: MaxSize constant added (quick-115). Regenerate with caution."
- Added `MaxSize` to CONSTANTS block (after MaxDeliberation) with comment explaining it models the `--n N - 1` ceiling override
- Added `ASSUME MaxSize \in 1..N` after the `N == Cardinality(Agents)` definition
- Added `QuorumCeilingMet` safety invariant: `phase = "DECIDED" => (successCount >= MaxSize \/ deliberationRounds >= MaxDeliberation)`

**MCsafety.cfg changes:**
- Updated header comment
- Added `MaxSize = 5` to CONSTANTS block
- Added `INVARIANT QuorumCeilingMet`

**MCliveness.cfg changes:**
- Updated header comment
- Added `MaxSize = 3` to CONSTANTS block
- No INVARIANT added (liveness config checks PROPERTY only, not INVARIANT)

## Verification Results

```
Stop hook:   32/32 tests pass, 0 fail
Prompt hook: 16/16 tests pass, 0 fail
MaxSize occurrences:
  QGSDQuorum.tla: 5
  MCsafety.cfg:   2
  MCliveness.cfg: 2
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| ed3938a | test | Fix stop tests and add missing hook/ceiling tests |
| ca082be | feat | Add MaxSize constant to TLA+ quorum model |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TC-CEIL-2 and TC-CEIL-3 test failures**
- **Found during:** Task 1 (running baseline test suite)
- **Issue:** TC-CEIL-2 and TC-CEIL-3 used `quorum: { minSize: 5 }` but qgsd-stop.js reads `config.quorum.maxSize`. With no `maxSize`, the hook defaulted to ceiling=2, so tests expecting a block at 4/5 calls instead got a pass (4 >= 2).
- **Fix:** Changed `minSize: 5` to `maxSize: 5` in both test configs
- **Files modified:** hooks/qgsd-stop.test.js
- **Commit:** ed3938a (bundled with Task 1 changes)

**2. [Rule 1 - Bug] Updated TC-PROMPT-N-CAP regex to match numbered step lines only**
- **Found during:** Task 1 (TC-PROMPT-N-CAP first run returned 3 instead of 2)
- **Issue:** Bare `Task\(subagent_type="qgsd-quorum-slot-worker"` matched the NEVER instruction line in addition to the 2 numbered step lines, producing count=3.
- **Fix:** Changed regex to `\d+\. Task\(subagent_type="qgsd-quorum-slot-worker"` to match only numbered dispatch steps. Applied same fix to TC-PROMPT-SOLO count assertion for consistency.
- **Files modified:** hooks/qgsd-prompt.test.js
- **Commit:** ed3938a

## Self-Check: PASSED

All files verified present:
- hooks/qgsd-stop.test.js: FOUND
- hooks/qgsd-prompt.test.js: FOUND
- formal/tla/QGSDQuorum.tla: FOUND
- formal/tla/MCsafety.cfg: FOUND
- formal/tla/MCliveness.cfg: FOUND

All commits verified:
- ed3938a: FOUND
- ca082be: FOUND
