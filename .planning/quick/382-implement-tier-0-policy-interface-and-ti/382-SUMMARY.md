---
phase: quick-382
plan: 01
subsystem: routing
tags: [routing, bandit, policy, selectSlot]
dependency_graph:
  requires: [bin/coding-task-router.cjs, bin/providers.json]
  provides: [bin/routing-policy.cjs, bin/routing-policy.test.cjs]
  affects: [bin/coding-task-router.cjs, bin/coding-task-router.test.cjs, .gitignore]
tech_stack:
  added: []
  patterns: [contextual-bandit, policy-interface, shadow-mode, fail-open]
key_files:
  created:
    - bin/routing-policy.cjs
    - bin/routing-policy.test.cjs
  modified:
    - bin/coding-task-router.cjs
    - bin/coding-task-router.test.cjs
    - .gitignore
decisions:
  - "Shadow mode ON by default: River bandit observes but preset wins until confidence established"
  - "Fail-open at every boundary: routing-policy load, reward write, state read all degrade gracefully"
  - "Incumbent bias prevents thrashing: bandit must exceed rewardMargin over preset winner to promote"
metrics:
  duration: 317s
  completed: 2026-04-07
---

# Quick 382: Implement Tier 0 Policy Interface and Tier 1 River Bandit Layer Summary

Pluggable 3-tier policy interface for selectSlot routing with PresetPolicy (Tier 0 static first-eligible-subprocess) and RiverPolicy (Tier 1 contextual bandit with confidence gating, incumbent bias, cooldown, and shadow mode).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Create routing-policy.cjs with PolicyInterface, PresetPolicy, RiverPolicy, RewardRecorder | ceaba8d2 | bin/routing-policy.cjs, bin/routing-policy.test.cjs, .gitignore |
| 2 | Refactor selectSlot in coding-task-router.cjs to delegate to routing-policy.cjs | 1fc88449 | bin/coding-task-router.cjs, bin/coding-task-router.test.cjs |

## Key Implementation Details

**routing-policy.cjs** (295 lines) exports:
- `PresetPolicy` -- Tier 0 bootstrap prior, mirrors original selectSlot logic exactly
- `RiverPolicy` -- Tier 1 contextual bandit with confidence gates (minSamples, rewardMargin, stability), incumbent bias, cooldown, shadow mode
- `RewardRecorder` -- Append-only JSONL writer/reader for reward signals, fail-open
- `selectSlotWithPolicy` -- Override chain iterating policies from highest tier down, shadow mode default ON

**coding-task-router.cjs** changes:
- `selectSlot()` now delegates to `selectSlotWithPolicy()` via fail-open import, falling back to legacy logic on any error
- New `recordRoutingReward()` convenience export for callers to feed reward signals
- All 22 existing tests pass unchanged; 3 new tests added (25 total)

**Test coverage:**
- routing-policy.test.cjs: 18 tests covering all 4 exports, edge cases, bandit gates, incumbent bias, shadow mode
- coding-task-router.test.cjs: 25 tests (22 existing + 3 new), zero regressions

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Shadow mode ON by default** -- River bandit logs recommendations to stderr but preset wins until evidence is sufficient
2. **Fail-open at every boundary** -- routing-policy load failure, reward write errors, state read errors all degrade gracefully to legacy behavior
3. **Incumbent bias** -- bandit must exceed rewardMargin (default 0.15) over the preset winner to displace it, preventing oscillation

## Self-Check: PASSED

- [x] bin/routing-policy.cjs exists (295 lines)
- [x] bin/routing-policy.test.cjs exists (18 tests pass)
- [x] bin/coding-task-router.cjs updated with delegation
- [x] bin/coding-task-router.test.cjs updated (25 tests pass)
- [x] .gitignore has routing-rewards and river-state entries
- [x] Commit ceaba8d2 exists
- [x] Commit 1fc88449 exists
