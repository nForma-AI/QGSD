---
phase: quick-382
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/routing-policy.cjs
  - bin/routing-policy.test.cjs
  - bin/coding-task-router.cjs
  - bin/coding-task-router.test.cjs
  - .gitignore
autonomous: true
requirements: [INTENT-01]

formal_artifacts:
  invariants_checked:
    - module: quorum
      note: "selectSlot backward compat — existing callers pass (taskType, providers) and get string|null back. No quorum invariants violated: this is internal routing logic, not consensus/voting."

must_haves:
  truths:
    - "selectSlot(taskType, providers) returns identical results to today when no River state exists (Tier 0 preset behavior)"
    - "Existing tests in coding-task-router.test.cjs pass without modification"
    - "Reward events can be recorded to .nf-routing-rewards.jsonl in append-only JSON-lines format"
    - "River bandit learns arm preferences from reward data and recommends slots when confidence gate passes"
    - "River runs in shadow mode by default — preset decision wins, River recommendation is logged but not acted on"
    - "Anti-thrashing: incumbent bias requires meaningful reward margin before displacement"
  artifacts:
    - path: "bin/routing-policy.cjs"
      provides: "PolicyInterface, PresetPolicy (Tier 0), RiverPolicy (Tier 1), RewardRecorder, selectSlotWithPolicy"
      min_lines: 200
    - path: "bin/routing-policy.test.cjs"
      provides: "Unit tests for all policy classes and reward recorder"
      min_lines: 150
    - path: "bin/coding-task-router.cjs"
      provides: "Refactored selectSlot delegating to routing-policy.cjs"
      exports: ["buildCodingPrompt", "parseCodingResult", "routeCodingTask", "selectSlot"]
    - path: ".gitignore"
      provides: "Gitignore entries for .nf-routing-rewards.jsonl and .nf-river-state.json"
      contains: ".nf-routing-rewards.jsonl"
  key_links:
    - from: "bin/coding-task-router.cjs"
      to: "bin/routing-policy.cjs"
      via: "require('./routing-policy.cjs')"
      pattern: "require.*routing-policy"
    - from: "bin/routing-policy.cjs"
      to: ".nf-routing-rewards.jsonl"
      via: "fs.appendFileSync for reward recording"
      pattern: "appendFileSync.*routing-rewards"
    - from: "bin/routing-policy.cjs"
      to: ".nf-river-state.json"
      via: "fs read/write for River bandit state persistence"
      pattern: "river-state\\.json"
---

<objective>
Implement a pluggable policy interface for slot selection routing with a 3-tier progressive authority ladder (Tier 0: Presets, Tier 1: River bandit). Refactor selectSlot() to delegate to the policy layer while preserving exact backward compatibility.

Purpose: Enable learned routing — the system discovers which agent slot performs best for each task type, replacing the current static first-match heuristic with an evidence-based selection that promotes only when confidence is established.

Output: bin/routing-policy.cjs (policy engine), updated bin/coding-task-router.cjs (delegation), tests, gitignore entries for runtime state files.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/coding-task-router.cjs
@bin/coding-task-router.test.cjs
@bin/providers.json
@.planning/quick/382-implement-tier-0-policy-interface-and-ti/scope-contract.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create routing-policy.cjs with PolicyInterface, PresetPolicy, RiverPolicy, and RewardRecorder</name>
  <files>bin/routing-policy.cjs, bin/routing-policy.test.cjs, .gitignore</files>
  <action>
Create `bin/routing-policy.cjs` (CommonJS, 'use strict') with these components:

**PolicyInterface contract** (documented via JSDoc, not a class — just the shape):
```
{ recommendation: string|null, confidence: number, evidenceCount: number, recentStability: number, reason: string }
```

**PresetPolicy class (Tier 0)**:
- Constructor: no args needed.
- `recommend(taskType, providers)` — implements exactly the current selectSlot logic: find first provider with `type === 'subprocess' && has_file_access === true`. Returns PolicyResult with confidence: 1.0, evidenceCount: 0, recentStability: 1.0, reason: 'preset:first-eligible-subprocess'.
- This is the bootstrap prior — always available, never fails.

**RewardRecorder**:
- `record({ taskType, slot, reward, latencyMs, timestamp })` — appends a JSON line to `.nf-routing-rewards.jsonl` in the project root (use `process.cwd()` for path). Fields: taskType, slot, reward (number 0-1), latencyMs, timestamp (ISO string, default Date.now). Fail-open: wrap in try/catch, log to stderr on error, never throw.
- `readRewards(taskType)` — reads the JSONL file, filters by taskType, returns array. Fail-open: returns [] on any error.

**RiverPolicy class (Tier 1 — contextual bandit)**:
- Constructor: `{ statePath, rewardsPath, config }` with defaults:
  - statePath: `path.join(process.cwd(), '.nf-river-state.json')`
  - rewardsPath: `path.join(process.cwd(), '.nf-routing-rewards.jsonl')`
  - config defaults: `{ minSamples: 10, rewardMargin: 0.15, stabilityWindow: 5, cooldownMs: 300000, shadowMode: true }`
- `recommend(taskType, providers)` — Core bandit logic:
  1. Load rewards for this taskType from JSONL file.
  2. For each eligible provider (subprocess + file_access), compute: meanReward, sampleCount, recentStability (stddev of last N rewards in stabilityWindow).
  3. Find best arm (highest meanReward).
  4. Confidence gate: passes ONLY when ALL of: sampleCount >= minSamples, rewardMargin between best and second-best >= config.rewardMargin, recentStability (1 - stddev) >= 0.7.
  5. If gate passes AND not in cooldown: return PolicyResult with the best arm, computed confidence, evidenceCount = sampleCount.
  6. If gate fails: return PolicyResult with recommendation: null, confidence: computed value, reason explaining which gate failed.
- `_loadState()` / `_saveState()` — persist/load from `.nf-river-state.json`: last promotion timestamp per taskType (for cooldown). Fail-open.
- Anti-thrashing: incumbent bias — if the current preset winner is within rewardMargin of the bandit's best arm, do NOT override (reason: 'incumbent-bias:margin-insufficient').

**selectSlotWithPolicy(taskType, providers, opts)**:
- opts: `{ policies, shadowMode }` — policies is array of policy objects ordered by tier.
- Default policies: `[new PresetPolicy(), new RiverPolicy()]`.
- Override chain: iterate policies from highest tier to lowest. First policy whose recommendation is non-null AND confidence gate passes wins.
- Shadow mode (default true): when River has a recommendation but shadowMode is true, log it to stderr (`[routing-policy] shadow: river recommends ${slot} for ${taskType} (confidence: ${c})`) but return the preset result.
- Returns: `{ slot: string|null, tier: number, policyResult: PolicyResult, shadow: PolicyResult|null }`.

Module exports: `{ PresetPolicy, RiverPolicy, RewardRecorder, selectSlotWithPolicy }`.

**Gitignore**: Add to `.gitignore` at the end:
```
# Routing policy runtime state (learned bandit data)
.nf-routing-rewards.jsonl
.nf-river-state.json
```

**Tests** in `bin/routing-policy.test.cjs` (node:test + node:assert):

1. PresetPolicy.recommend returns first subprocess+file_access provider (mirrors existing selectSlot behavior).
2. PresetPolicy.recommend returns null recommendation for empty/no-match providers.
3. RewardRecorder.record writes valid JSONL line (use tmp file).
4. RewardRecorder.readRewards filters by taskType.
5. RewardRecorder handles missing file gracefully (returns []).
6. RiverPolicy.recommend returns null when insufficient samples (< minSamples).
7. RiverPolicy.recommend returns best arm when confidence gate passes (mock sufficient reward data).
8. RiverPolicy incumbent bias: does not override when margin insufficient.
9. selectSlotWithPolicy returns preset result by default (no reward data).
10. selectSlotWithPolicy shadow mode logs but does not override.
11. selectSlotWithPolicy with shadowMode:false promotes River when gate passes.

Use `os.tmpdir()` + unique filenames for test state/reward files. Clean up in each test.
  </action>
  <verify>
Run: `node --test bin/routing-policy.test.cjs` — all tests pass.
Verify exports: `node -p "Object.keys(require('./bin/routing-policy.cjs')).sort().join(', ')"` outputs: `PresetPolicy, RewardRecorder, RiverPolicy, selectSlotWithPolicy`.
Verify gitignore: `grep 'nf-routing-rewards' .gitignore && grep 'nf-river-state' .gitignore` — both match.
  </verify>
  <done>
routing-policy.cjs exports all four components. All 11+ tests pass. PresetPolicy reproduces identical behavior to current selectSlot. RiverPolicy correctly gates on evidence thresholds. RewardRecorder appends JSONL and reads back filtered. State files are gitignored.
  </done>
</task>

<task type="auto">
  <name>Task 2: Refactor selectSlot in coding-task-router.cjs to delegate to routing-policy.cjs</name>
  <files>bin/coding-task-router.cjs, bin/coding-task-router.test.cjs</files>
  <action>
Modify `bin/coding-task-router.cjs`:

1. At the top (after existing requires), add:
```js
let routingPolicy;
try {
  routingPolicy = require(path.join(__dirname, 'routing-policy.cjs'));
} catch (_) {
  routingPolicy = null;
}
```

2. Replace the `selectSlot` function body (lines 142-150) with:
```js
function selectSlot(taskType, providers) {
  if (!Array.isArray(providers)) return null;

  // Delegate to policy layer if available (fail-open to legacy behavior)
  if (routingPolicy) {
    try {
      const result = routingPolicy.selectSlotWithPolicy(taskType, providers);
      return result.slot;
    } catch (_) {
      // Fall through to legacy logic
    }
  }

  // Legacy fallback — identical to original behavior
  const candidate = providers.find(
    p => p.type === 'subprocess' && p.has_file_access === true
  );
  return candidate ? candidate.name : null;
}
```

This preserves:
- Exact same function signature: `selectSlot(taskType, providers) -> string|null`
- Exact same return type and semantics
- Fail-open: if routing-policy.cjs fails to load or throws, falls back to original logic
- All existing callers (quorum-slot-dispatch.cjs Mode C) continue working with zero changes

3. Also export a new `recordRoutingReward` convenience function:
```js
function recordRoutingReward({ taskType, slot, reward, latencyMs }) {
  if (!routingPolicy) return;
  try {
    const recorder = new routingPolicy.RewardRecorder();
    recorder.record({ taskType, slot, reward, latencyMs });
  } catch (_) {
    // Fail-open: reward recording is best-effort
  }
}
```

4. Add `recordRoutingReward` to module.exports (alongside existing exports).

5. Do NOT modify any existing tests. Add NEW tests to `bin/coding-task-router.test.cjs`:
- `selectSlot still returns first file-access subprocess provider (backward compat with policy layer)` — same assertions as existing test, just confirms delegation path produces same result.
- `recordRoutingReward is exported as a function` — structural export check.
- `recordRoutingReward does not throw on call` — call with valid args, confirm no exception.

IMPORTANT: The existing 4 selectSlot tests must continue to pass unchanged. The policy layer (PresetPolicy) produces identical output to the original logic, so results are the same.
  </action>
  <verify>
Run: `node --test bin/coding-task-router.test.cjs` — ALL existing tests pass (zero regressions) plus new tests pass.
Run: `node --test bin/routing-policy.test.cjs` — still passes after integration.
Verify backward compat: `node -e "const m = require('./bin/coding-task-router.cjs'); console.log(m.selectSlot('implement', [{name:'codex-1',type:'subprocess',has_file_access:true}]))"` outputs `codex-1`.
Verify new export: `node -p "typeof require('./bin/coding-task-router.cjs').recordRoutingReward"` outputs `function`.
Run full test suite: `npm run test:ci` — no regressions.
  </verify>
  <done>
selectSlot delegates to routing-policy.cjs policy layer while preserving exact backward compatibility. All existing tests pass without modification. recordRoutingReward is exported for callers to feed reward signals. Fail-open pattern ensures zero risk if routing-policy.cjs has issues.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/routing-policy.test.cjs` — all policy layer tests pass
2. `node --test bin/coding-task-router.test.cjs` — all existing + new tests pass
3. `npm run test:ci` — full test suite passes (no regressions)
4. Manual: `node -e "const m = require('./bin/coding-task-router.cjs'); console.log(m.selectSlot('fix', [{name:'codex-1',type:'subprocess',has_file_access:true},{name:'api-1',type:'http',has_file_access:false}]))"` returns `codex-1` (backward compat)
5. `grep 'nf-routing-rewards' .gitignore` — confirms runtime files are gitignored
</verification>

<success_criteria>
- selectSlot() produces identical output to pre-refactor for all input combinations (no behavioral change when no reward data exists)
- PresetPolicy exactly mirrors original first-eligible-subprocess logic
- RiverPolicy correctly computes arm rewards, applies confidence gates, and respects incumbent bias
- RewardRecorder writes append-only JSONL and reads back filtered by taskType
- Shadow mode is default ON — River observes but does not override preset
- All fail-open: routing-policy load failure, reward write failure, state read failure all fall back gracefully
- .nf-routing-rewards.jsonl and .nf-river-state.json are gitignored
- Zero regressions in existing test suite
</success_criteria>

<output>
After completion, create `.planning/quick/382-implement-tier-0-policy-interface-and-ti/382-SUMMARY.md`
</output>
