---
phase: quick-384
plan: 01
subsystem: routing-policy
tags: [q-learning, reinforcement-learning, routing, reward-recording]
dependency_graph:
  requires: [quick-382, quick-383]
  provides: [q-learning-routing, closed-loop-reward]
  affects: [bin/routing-policy.cjs, bin/quorum-slot-dispatch.cjs]
tech_stack:
  added: []
  patterns: [q-learning, bellman-update, epsilon-greedy, learning-rate-decay]
key_files:
  created: []
  modified:
    - bin/routing-policy.cjs
    - bin/routing-policy.test.cjs
    - bin/quorum-slot-dispatch.cjs
    - bin/quorum-slot-dispatch.test.cjs
decisions:
  - Q-learning uses single-state Bellman update (no discount factor) since routing is a contextual bandit with immediate rewards
  - Learning rate decays as alpha = learningRate / (1 + visits * decayRate) for stable convergence
  - minExplore gate forces exploration for arms with insufficient visit counts before Q-value selection kicks in
metrics:
  duration: 282s
  completed: 2026-04-08
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
  tests_added: 7
  tests_total_passing: 146
---

# Quick Task 384: Fully Integrate River ML Library and Q-learning Summary

Q-learning RiverPolicy with Bellman updates replacing mean-reward bandit, plus closed-loop reward recording from Mode C dispatch

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace RiverPolicy bandit with Q-learning algorithm | c780a97c | bin/routing-policy.cjs, bin/routing-policy.test.cjs |
| 2 | Wire outcome recording into quorum-slot-dispatch.cjs | 6bf32b45 | bin/quorum-slot-dispatch.cjs, bin/quorum-slot-dispatch.test.cjs |

## What Changed

### Task 1: Q-learning RiverPolicy

Replaced the simple mean-reward bandit in `RiverPolicy` with a proper Q-learning algorithm:

- **Q-table structure**: Per-taskType, per-slot Q-values with visit counts stored in `.nf-river-state.json`
- **Bellman update**: `Q(s,a) = Q(s,a) + alpha * (reward - Q(s,a))` with decaying learning rate
- **Epsilon-greedy exploration**: With probability epsilon, defers to PresetPolicy for diversity
- **minExplore gate**: Arms with fewer than `minExplore` visits trigger exploration mode
- **lastProcessedIdx**: Tracks which rewards have been processed to avoid re-processing
- **Backward compatibility**: Old state files without qTable are automatically upgraded
- **All existing gates preserved**: minSamples, rewardMargin, stability, incumbent bias, cooldown

Config defaults: `learningRate: 0.1, decayRate: 0.01, epsilon: 0.15, minExplore: 20`

6 new tests added covering: incremental Q-updates, learning rate decay, epsilon exploration, minExplore forcing, backward compat, lastProcessedIdx.

### Task 2: Reward Recording Wiring

Wired `recordRoutingReward` from `coding-task-router.cjs` into `quorum-slot-dispatch.cjs`:

- Fail-open import at module top level
- After Mode C `parseCodingResult`, records reward using status mapping: `SUCCESS=1.0, PARTIAL=0.5, FAILED=0.0, UNKNOWN=0.25`
- TaskType derived from question keywords (fix/refactor/test/implement)
- 1 structural wiring test added

## Verification Results

- `node --test bin/routing-policy.test.cjs`: 29/29 pass (23 existing + 6 new)
- `node --test bin/coding-task-router.test.cjs`: 25/25 pass (no regression)
- `node --test bin/quorum-slot-dispatch.test.cjs`: 92/92 pass (91 existing + 1 new)
- `grep qTable bin/routing-policy.cjs`: confirmed Q-table implementation
- `grep recordRoutingReward bin/quorum-slot-dispatch.cjs`: confirmed reward wiring
- `grep 'Bellman\|learningRate\|epsilon' bin/routing-policy.cjs`: confirmed Q-learning algorithm

## Decisions Made

1. **Single-state Q-learning** (no discount factor): Routing is a contextual bandit problem with immediate rewards -- no multi-step planning needed.
2. **Decaying alpha**: `alpha = learningRate / (1 + visits * decayRate)` stabilizes Q-values over time while allowing fast initial learning.
3. **minExplore before exploitation**: Arms must accumulate minimum visits before Q-value-based selection activates, ensuring sufficient exploration data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing tests for Q-learning compatibility**
- **Found during:** Task 1
- **Issue:** Existing RiverPolicy tests used only 12 rewards per arm, which is below the new `minExplore: 20` default. Tests hit `river:exploring` instead of reaching confidence gates.
- **Fix:** Increased reward counts to 25 per arm in existing tests and added explicit `minExplore: 1, epsilon: 0` config overrides to isolate the gates being tested.
- **Files modified:** bin/routing-policy.test.cjs
- **Commit:** c780a97c

## Formal Coverage

INFO: No formal coverage intersections found for either task -- Loop 2 not needed (GATE-03).

## Issues Encountered

None.
