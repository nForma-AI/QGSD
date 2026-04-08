---
phase: quick-384
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/routing-policy.cjs
  - bin/routing-policy.test.cjs
  - bin/quorum-slot-dispatch.cjs
  - bin/quorum-slot-dispatch.test.cjs
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "RiverPolicy uses Q-learning with Bellman updates instead of simple mean-reward bandit"
    - "Outcome recording fires automatically after each Mode C coding delegation completes"
    - "Q-table state persists across sessions via the existing state file mechanism"
    - "All existing tests pass with zero regressions"
    - "Learning updates are observable: repeated good outcomes for a slot increase its Q-value"
  artifacts:
    - path: "bin/routing-policy.cjs"
      provides: "Q-learning RiverPolicy with Bellman updates, epsilon-greedy exploration, state-action-reward tuple storage"
      contains: "qTable"
    - path: "bin/routing-policy.test.cjs"
      provides: "Tests covering Q-learning updates, exploration, policy convergence"
      min_lines: 400
    - path: "bin/quorum-slot-dispatch.cjs"
      provides: "Automatic reward recording after Mode C task completion"
      contains: "recordRoutingReward"
    - path: "bin/quorum-slot-dispatch.test.cjs"
      provides: "Tests verifying reward recording wiring"
      contains: "recordRoutingReward"
  key_links:
    - from: "bin/routing-policy.cjs"
      to: ".nf-river-state.json"
      via: "Q-table persistence in _loadState/_saveState"
      pattern: "qTable"
    - from: "bin/quorum-slot-dispatch.cjs"
      to: "bin/coding-task-router.cjs"
      via: "recordRoutingReward import"
      pattern: "recordRoutingReward"
    - from: "bin/routing-policy.cjs"
      to: ".nf-routing-rewards.jsonl"
      via: "RewardRecorder reads for Q-learning batch updates"
      pattern: "readRewards"
  consumers:
    - artifact: "bin/routing-policy.cjs (Q-learning RiverPolicy)"
      consumed_by: "bin/coding-task-router.cjs (selectSlot -> selectSlotWithPolicy)"
      integration: "Already wired in quick-382"
      verify_pattern: "selectSlotWithPolicy"
    - artifact: "reward recording in quorum-slot-dispatch.cjs"
      consumed_by: "bin/routing-policy.cjs (RiverPolicy.recommend reads rewards)"
      integration: "Closed loop: dispatch records reward -> RiverPolicy reads rewards for Q-updates"
      verify_pattern: "recordRoutingReward"
---

<objective>
Replace the custom mean-reward bandit in RiverPolicy with a proper Q-learning algorithm and wire outcome recording into quorum-slot-dispatch.cjs to close the learning loop.

Purpose: Issue #73 requires real Q-learning for online routing optimization. The current RiverPolicy computes simple mean rewards per arm — it has no temporal difference learning, no exploration strategy, and no state-action value updates. This plan replaces it with Q-learning (Q-table with Bellman updates, epsilon-greedy exploration, learning rate decay) and wires the missing reward recording into the production dispatch path so the learning loop actually receives data.

Output: Updated routing-policy.cjs with Q-learning RiverPolicy, wired outcome recording in quorum-slot-dispatch.cjs, comprehensive tests.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/382-implement-tier-0-policy-interface-and-ti/382-SUMMARY.md
@.planning/quick/383-wire-task-intake-routing-into-presetpoli/383-SUMMARY.md
@bin/routing-policy.cjs
@bin/routing-policy.test.cjs
@bin/coding-task-router.cjs
@bin/quorum-slot-dispatch.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace RiverPolicy bandit with Q-learning algorithm</name>
  <files>bin/routing-policy.cjs, bin/routing-policy.test.cjs</files>
  <action>
Rewrite the `RiverPolicy` class in bin/routing-policy.cjs to use Q-learning instead of mean-reward bandit. Keep the same external API (constructor opts, `recommend(taskType, providers)` returning PolicyResult). Keep PresetPolicy, RewardRecorder, selectSlotWithPolicy, and makePolicyResult unchanged.

**Q-learning implementation in RiverPolicy:**

1. **Q-table structure** stored in state file (`.nf-river-state.json`):
   ```
   {
     qTable: {
       "<taskType>": {
         "<slotName>": { q: number, visits: number, lastUpdate: ISO }
       }
     },
     promotions: { ... }  // keep existing
   }
   ```

2. **Bellman update** in a new method `_updateQValues(taskType, providers)`:
   - Read all rewards for this taskType from RewardRecorder
   - For each reward entry not yet processed (track `lastProcessedIdx` per taskType in state):
     - Q(s,a) = Q(s,a) + alpha * (reward - Q(s,a))
     - where alpha = learningRate / (1 + visits * decayRate) for learning rate decay
   - Save updated Q-table to state file
   - Default config: `learningRate: 0.1, decayRate: 0.01, epsilon: 0.15, minExplore: 20`

3. **Epsilon-greedy exploration** in `recommend()`:
   - Call `_updateQValues()` first to incorporate new rewards
   - If any eligible arm has fewer than `minExplore` visits, return null with reason `river:exploring` (let preset handle it, forces exploration via preset's first-eligible)
   - With probability epsilon: return null (defer to preset for exploration diversity)
   - Otherwise: return the arm with highest Q-value
   - Apply existing confidence gates (minSamples, rewardMargin, stability) on top

4. **Keep all existing gates**: minSamples, rewardMargin, stability, incumbent bias, cooldown. These layer on top of the Q-value selection. The Q-learning replaces ONLY the "compute per-arm statistics" and "find best arm" sections (lines ~209-246 of current code).

5. **Backward compatibility**: If state file has old format (no qTable), initialize qTable from existing reward data on first load. All existing config keys remain valid.

**Test updates in bin/routing-policy.test.cjs:**

Add new tests (do NOT remove existing tests):
- `RiverPolicy Q-learning: Q-values update incrementally after new rewards`
  - Record 5 rewards for slot A (reward=0.9) and 5 for slot B (reward=0.3)
  - Call recommend() which triggers _updateQValues
  - Verify Q(A) > Q(B) by checking state file qTable
- `RiverPolicy Q-learning: learning rate decays with visits`
  - Record 30 rewards, verify Q-value delta decreases over time
- `RiverPolicy Q-learning: epsilon exploration defers to preset`
  - Set epsilon=1.0, verify recommend() returns null recommendation
- `RiverPolicy Q-learning: minExplore forces exploration for unvisited arms`
  - Create rewards for only one of two eligible arms, verify null recommendation
- `RiverPolicy Q-learning: backward compat with old state format`
  - Write old-format state file (no qTable), verify recommend() still works
- `RiverPolicy Q-learning: lastProcessedIdx prevents re-processing rewards`
  - Record rewards, call recommend(), record more, call again, verify only new rewards affect Q-values

Use tmp files for all state/reward paths (existing pattern in test file).
  </action>
  <verify>
Run `node --test bin/routing-policy.test.cjs` — all existing 23 tests plus 6+ new tests pass. Verify Q-table structure: `node -e "const rp = require('./bin/routing-policy.cjs'); const p = new rp.RiverPolicy({statePath:'/tmp/test-q.json',rewardsPath:'/tmp/test-q.jsonl'}); console.log(typeof p.recommend)"` prints `function`.
  </verify>
  <done>
RiverPolicy uses Q-learning with Bellman updates, epsilon-greedy exploration, and learning rate decay. Q-table persists in state file. All existing tests pass unchanged. 6+ new Q-learning tests pass. No regressions.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire outcome recording into quorum-slot-dispatch.cjs</name>
  <files>bin/quorum-slot-dispatch.cjs, bin/quorum-slot-dispatch.test.cjs</files>
  <action>
Wire `recordRoutingReward` from coding-task-router.cjs into quorum-slot-dispatch.cjs so that every completed Mode C coding delegation automatically records a reward signal, closing the learning loop.

**In bin/quorum-slot-dispatch.cjs:**

1. Add fail-open import at the top (near existing coding-task-router imports):
   ```javascript
   let recordRoutingReward;
   try {
     recordRoutingReward = require(path.join(__dirname, 'coding-task-router.cjs')).recordRoutingReward;
   } catch (_) {
     recordRoutingReward = () => {};  // fail-open
   }
   ```

2. Find the Mode C completion path — after `parseCodingResult` is called and `verdict` is set (around line ~1828 where `statusVerdictMap` maps status to verdict). After the verdict is determined, add reward recording:
   ```javascript
   // Record routing reward for Q-learning loop (fail-open)
   try {
     const rewardMap = { SUCCESS: 1.0, PARTIAL: 0.5, FAILED: 0.0, UNKNOWN: 0.25 };
     const rewardValue = rewardMap[codingResult.status] || 0.25;
     if (recordRoutingReward && slotName) {
       recordRoutingReward({
         taskType: taskType || 'implement',
         slot: slotName,
         reward: rewardValue,
         latencyMs: latencyMs || 0,
       });
     }
   } catch (_) {
     // Fail-open: reward recording must never block dispatch
   }
   ```

3. Determine the correct variable names by reading the surrounding context:
   - `slotName` — the slot provider name used for this dispatch
   - `taskType` — the task classification (may need to derive from dispatch context)
   - `latencyMs` — elapsed time for the coding task
   - `codingResult.status` — the parsed coding result status

4. If taskType is not directly available in the Mode C dispatch path, derive it from the task description using a simple keyword match (same pattern as coding-task-router): default to `'implement'`.

**In bin/quorum-slot-dispatch.test.cjs:**

Add test(s) verifying the wiring:
- `Mode C dispatch records routing reward after completion`
  - Verify that `recordRoutingReward` is imported (check via grep or module inspection)
  - This is a structural/wiring test since full dispatch requires subprocess spawn

Use the existing test pattern in the file (structural verification, not end-to-end).
  </action>
  <verify>
Run `node --test bin/quorum-slot-dispatch.test.cjs` — all existing tests pass plus new reward wiring test. Run `grep 'recordRoutingReward' bin/quorum-slot-dispatch.cjs` — confirms the import and call site exist. Run `node --test bin/routing-policy.test.cjs` — still passes (no regression). Run `node --test bin/coding-task-router.test.cjs` — still passes.
  </verify>
  <done>
quorum-slot-dispatch.cjs records routing rewards after every Mode C completion using the SUCCESS=1.0/PARTIAL=0.5/FAILED=0.0 mapping. The learning loop is closed: dispatch outcomes flow into .nf-routing-rewards.jsonl, which RiverPolicy's Q-learning reads to update Q-values. All tests pass.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/routing-policy.test.cjs` — all tests pass (existing 23 + new 6+)
2. `node --test bin/coding-task-router.test.cjs` — all 25 tests pass (no regression)
3. `node --test bin/quorum-slot-dispatch.test.cjs` — all tests pass (existing + new)
4. `grep 'qTable' bin/routing-policy.cjs` — confirms Q-table implementation
5. `grep 'recordRoutingReward' bin/quorum-slot-dispatch.cjs` — confirms reward wiring
6. `grep 'Bellman\|learningRate\|epsilon' bin/routing-policy.cjs` — confirms Q-learning algorithm
7. End-to-end data flow check: RewardRecorder.record() writes JSONL -> RiverPolicy._updateQValues() reads JSONL and updates Q-table -> recommend() uses Q-values for arm selection
</verification>

<success_criteria>
- RiverPolicy implements Q-learning with Bellman updates (not mean-reward bandit)
- Q-table persists in .nf-river-state.json with per-taskType, per-slot Q-values and visit counts
- Epsilon-greedy exploration provides diversity while exploiting best known arms
- Learning rate decays with visits to stabilize Q-values over time
- quorum-slot-dispatch.cjs automatically records rewards after Mode C completion
- All existing tests pass with zero regressions
- 6+ new tests cover Q-learning behavior (updates, decay, exploration, backward compat)
- The full learning loop is closed: dispatch -> reward recording -> Q-update -> routing decision
</success_criteria>

<output>
After completion, create `.planning/quick/384-issue-73/384-SUMMARY.md`
</output>
