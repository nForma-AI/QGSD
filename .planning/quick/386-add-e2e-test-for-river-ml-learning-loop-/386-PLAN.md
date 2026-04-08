---
phase: 386-add-e2e-test-for-river-ml-learning-loop-
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/routing-policy.test.cjs
  - bin/routing-policy.cjs
  - hooks/nf-statusline.js
  - hooks/nf-statusline.test.js
  - hooks/dist/nf-statusline.js
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "E2E test proves full learning loop: rewards recorded -> Q-table updated -> recommend() shifts preference -> selectSlotWithPolicy returns shadow with recommendation"
    - "nf-statusline shows 'River: <slot> (shadow)' when state file contains a shadow recommendation with confidence"
    - "nf-statusline falls back to 'River: exploring' or 'River: active' when no shadow recommendation exists"
  artifacts:
    - path: "bin/routing-policy.test.cjs"
      provides: "E2E learning loop test"
      contains: "E2E.*learning loop"
    - path: "bin/routing-policy.cjs"
      provides: "Shadow recommendation persisted to state file"
      contains: "lastShadow"
    - path: "hooks/nf-statusline.js"
      provides: "Shadow-mode recommendation display"
      contains: "shadow"
    - path: "hooks/nf-statusline.test.js"
      provides: "Shadow statusline tests"
      contains: "shadow"
  key_links:
    - from: "bin/routing-policy.cjs"
      to: ".nf-river-state.json"
      via: "selectSlotWithPolicy writes lastShadow to state"
      pattern: "lastShadow"
    - from: "hooks/nf-statusline.js"
      to: ".nf-river-state.json"
      via: "reads lastShadow from state file"
      pattern: "lastShadow"
---

<objective>
Add an E2E integration test for the full River ML learning loop and enhance nf-statusline.js to surface shadow-mode recommendations.

Purpose: Prove the complete River ML pipeline works end-to-end (rewards -> Q-learning -> routing shift) and make shadow recommendations visible in the developer's statusline so they can see what River would choose if promoted.

Output: E2E test in routing-policy.test.cjs, shadow persistence in routing-policy.cjs, shadow display in nf-statusline.js with tests.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/routing-policy.cjs
@bin/routing-policy.test.cjs
@hooks/nf-statusline.js
@hooks/nf-statusline.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add E2E learning loop test and persist shadow recommendation to state file</name>
  <files>bin/routing-policy.test.cjs, bin/routing-policy.cjs</files>
  <action>
**Part A — Persist shadow recommendation to state file:**

In `bin/routing-policy.cjs`, modify `selectSlotWithPolicy()` to write the shadow recommendation to the River state file when shadow mode is active and River has a recommendation. After the shadow result is captured (around line 466), add code to persist the shadow info to the state file:

```javascript
// After: shadow = result;
// Persist shadow recommendation to state file for statusline consumption
try {
  const riverStatePath = path.join(process.cwd(), '.nf-river-state.json');
  // If RiverPolicy is available, use its state path; otherwise use default
  const riverPolicy = policies.find(p => p instanceof RiverPolicy);
  const statePath = riverPolicy ? riverPolicy._statePath : riverStatePath;
  let state = {};
  try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (_) {}
  state.lastShadow = {
    recommendation: result.recommendation,
    confidence: result.confidence,
    taskType: taskType,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
} catch (_) { /* fail-open */ }
```

Also clear `lastShadow` when there is NO shadow (i.e., when River has no recommendation or shadow mode is off). After the for loop that checks higher tiers (before the "Default: preset wins" return), add:
```javascript
// Clear any stale shadow recommendation from state
try {
  const riverPolicy = policies.find(p => p instanceof RiverPolicy);
  if (riverPolicy) {
    let state = {};
    try { state = JSON.parse(fs.readFileSync(riverPolicy._statePath, 'utf8')); } catch (_) {}
    if (state.lastShadow) {
      delete state.lastShadow;
      fs.writeFileSync(riverPolicy._statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
    }
  }
} catch (_) { /* fail-open */ }
```

**Part B — E2E integration test:**

Add a new test to `bin/routing-policy.test.cjs` at the end of the file, titled `'E2E learning loop: rewards -> Q-table update -> routing preference shift -> shadow recommendation'`. This test must:

1. Create tmp paths for rewards JSONL and state JSON.
2. Create a RewardRecorder and record 25 high rewards (0.95) for `gemini-1` and 25 low rewards (0.4) for `codex-1`, all with taskType `'implement'`.
3. Create a RiverPolicy with config: `{ minSamples: 10, minExplore: 1, epsilon: 0, rewardMargin: 0.15, stabilityWindow: 5, cooldownMs: 0, shadowMode: true }`.
4. Call `selectSlotWithPolicy('implement', PROVIDERS, { shadowMode: true, policies: [new PresetPolicy(), riverPolicy] })`.
5. Assert:
   - `result.slot === 'codex-1'` (preset wins in shadow mode)
   - `result.tier === 0`
   - `result.shadow !== null`
   - `result.shadow.recommendation === 'gemini-1'` (River prefers gemini-1 due to higher rewards)
   - `result.shadow.confidence > 0`
6. Read the state file and assert:
   - `state.qTable.implement['gemini-1'].q > state.qTable.implement['codex-1'].q` (Q-values reflect reward history)
   - `state.qTable.implement['gemini-1'].visits === 25`
   - `state.lastShadow.recommendation === 'gemini-1'`
   - `state.lastShadow.confidence > 0`
7. Now record 30 MORE rewards: all 1.0 for `codex-1` and all 0.1 for `gemini-1`.
8. Call `selectSlotWithPolicy` again with fresh RiverPolicy (same config, same paths).
9. Read updated state and assert:
   - `state.qTable.implement['codex-1'].q > state.qTable.implement['gemini-1'].q` (preference shifted!)
   - Either `result.shadow.recommendation === 'codex-1'` (River now prefers codex-1) OR `result.shadow === null` (codex-1 is already the preset winner so no shadow needed — depending on incumbent bias logic). Document which case applies.
10. Clean up tmp files in finally block.

Also add a second smaller test: `'selectSlotWithPolicy clears lastShadow when River has no recommendation'`:
1. Create tmp paths, do NOT write any rewards.
2. Write a state file with a stale `lastShadow` entry.
3. Call `selectSlotWithPolicy` with a RiverPolicy that has no reward data.
4. Read state file and assert `state.lastShadow` is `undefined` (stale shadow cleared).
5. Clean up.
  </action>
  <verify>
Run: `node --test bin/routing-policy.test.cjs 2>&1 | tail -30`
All tests must pass including the new E2E test and the shadow clearing test. Verify the E2E test name appears in output.
  </verify>
  <done>
E2E test proves full learning loop: record rewards -> Q-table updates -> River recommends different slot -> shadow persisted to state. Shadow clearing test proves stale shadows are removed. All existing tests still pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Enhance nf-statusline.js to display shadow-mode recommendations</name>
  <files>hooks/nf-statusline.js, hooks/nf-statusline.test.js, hooks/dist/nf-statusline.js</files>
  <action>
**Part A — Enhance River indicator in nf-statusline.js:**

In the River ML phase indicator section (lines 165-194), after the existing logic that sets `riverIndicator` to "River: exploring" or "River: active", add shadow recommendation display.

The logic should be:
1. After computing the existing `riverIndicator` (exploring vs active), check if `riverState.lastShadow` exists and has a `recommendation` string.
2. If `lastShadow` exists with a recommendation:
   - Override `riverIndicator` to show: `River: <recommendation> (shadow)` in yellow/amber color (`\x1b[33m`).
   - Example: `' \x1b[33mRiver: gemini-1 (shadow)\x1b[0m'`
3. If `lastShadow` does NOT exist, keep the existing "exploring" or "active" indicator as-is.

This ensures shadow recommendations take visual priority when they exist, since they represent actionable River intelligence.

**Part B — Add statusline tests:**

Add these tests to `hooks/nf-statusline.test.js`:

**TC21: Shadow recommendation displayed when lastShadow present**
- Create temp dir with `.nf-river-state.json` containing:
  ```json
  { "qTable": { "implement": { "codex-1": { "q": 0.8, "visits": 25 }, "gemini-1": { "q": 0.6, "visits": 30 } } }, "lastShadow": { "recommendation": "gemini-1", "confidence": 0.85, "taskType": "implement" } }
  ```
- Run hook with `workspace.current_dir` set to temp dir.
- Assert stdout includes `River: gemini-1 (shadow)`.
- Assert stdout includes yellow ANSI code `\x1b[33m`.

**TC22: No shadow — falls back to River: active**
- Create temp dir with `.nf-river-state.json` containing qTable with all arms above minExplore (visits >= 20) but NO `lastShadow` field.
- Assert stdout includes `River: active` (not shadow).

**TC23: Shadow with empty recommendation falls back to normal indicator**
- Create temp dir with `.nf-river-state.json` containing qTable AND `lastShadow: { recommendation: null }`.
- Assert stdout includes `River: active` or `River: exploring` (not shadow).

**Part C — Sync to hooks/dist/:**

Copy the updated `hooks/nf-statusline.js` to `hooks/dist/nf-statusline.js` (per git workflow rules, dist is the installed copy).
  </action>
  <verify>
Run: `node --test hooks/nf-statusline.test.js 2>&1 | tail -30`
All tests must pass including TC21, TC22, TC23. Then verify dist sync:
`diff hooks/nf-statusline.js hooks/dist/nf-statusline.js` should show no differences (or only the expected copy).
  </verify>
  <done>
nf-statusline shows "River: gemini-1 (shadow)" in yellow when lastShadow has a recommendation, falls back to "River: exploring" or "River: active" when no shadow. hooks/dist/ is synced. All existing + new statusline tests pass.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/routing-policy.test.cjs` — all pass (including E2E learning loop)
2. `node --test hooks/nf-statusline.test.js` — all pass (including shadow display tests)
3. `diff hooks/nf-statusline.js hooks/dist/nf-statusline.js` — files in sync
4. `npm run test:ci` — full test suite passes
</verification>

<success_criteria>
- E2E test exercises complete loop: RewardRecorder.record() -> RiverPolicy._updateQValues() -> recommend() returns preference -> selectSlotWithPolicy() returns shadow -> state file contains lastShadow
- Statusline displays "River: <slot> (shadow)" when River has a confident shadow recommendation
- Statusline falls back to existing indicators when no shadow recommendation exists
- All tests pass, hooks/dist/ synced
</success_criteria>

<output>
After completion, create `.planning/quick/386-add-e2e-test-for-river-ml-learning-loop-/386-SUMMARY.md`
</output>
