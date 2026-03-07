---
phase: quick-205
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/validate-traces.cjs
  - bin/validate-traces.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-205]

must_haves:
  truths:
    - "quorum_fallback_t1_required events (type-only, no action field) are mapped to QUORUM_START and validated"
    - "quorum_block_r3_2 events are mapped to DECIDE/BLOCK and validated"
    - "security_sweep events are gracefully skipped (not counted as divergences)"
    - "ci:conformance-traces passes with 0 divergences after fix"
  artifacts:
    - path: "bin/validate-traces.cjs"
      provides: "Expanded mapToXStateEvent and expectedState functions"
      contains: "event.action || event.type"
    - path: "bin/validate-traces.test.cjs"
      provides: "Unit tests for new action mappings"
      contains: "quorum_fallback_t1_required"
  key_links:
    - from: "bin/validate-traces.cjs:mapToXStateEvent"
      to: "conformance-events.jsonl"
      via: "event.action || event.type normalization"
      pattern: "event\\.action \\|\\| event\\.type"
    - from: "bin/validate-traces.cjs:expectedState"
      to: "bin/validate-traces.cjs:mapToXStateEvent"
      via: "action normalization must match in both functions"
      pattern: "quorum_fallback_t1_required"
---

<objective>
Fix 6373 divergences in ci:conformance-traces by expanding mapToXStateEvent to handle type-only events and unmapped actions.

Purpose: The conformance trace validator reports 6373 false divergences because mapToXStateEvent only reads event.action, but 5649 events use event.type instead. Two additional actions (quorum_block_r3_2, security_sweep) lack switch cases.

Output: Zero-divergence conformance trace validation.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/validate-traces.cjs
@bin/validate-traces.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add unit tests for new action mappings</name>
  <files>bin/validate-traces.test.cjs</files>
  <action>
Add unit tests to bin/validate-traces.test.cjs for the three new action types. Import mapToXStateEvent from the module.

Tests to add:

1. `mapToXStateEvent: normalizes event.type when event.action is missing` — Create event `{ type: 'quorum_fallback_t1_required', fanOutCount: 3 }` (no action field). Assert mapToXStateEvent returns `{ type: 'QUORUM_START', slotsAvailable: 3 }`.

2. `mapToXStateEvent: quorum_fallback_t1_required maps to QUORUM_START` — Create event `{ action: 'quorum_fallback_t1_required', fanOutCount: 2 }`. Assert result is `{ type: 'QUORUM_START', slotsAvailable: 2 }`.

3. `mapToXStateEvent: quorum_block_r3_2 maps to DECIDE/BLOCK` — Create event `{ action: 'quorum_block_r3_2' }`. Assert result is `{ type: 'DECIDE', outcome: 'BLOCK' }`.

4. `mapToXStateEvent: security_sweep returns null (not an FSM event)` — Create event `{ action: 'security_sweep' }`. Assert result is null.

5. `expectedState: quorum_fallback_t1_required returns COLLECTING_VOTES` — Create event with action (or type) `quorum_fallback_t1_required`. Assert expectedState returns `'COLLECTING_VOTES'`.

6. `expectedState: quorum_block_r3_2 with non-IDLE phase returns null (H1 skip)` — Create event `{ action: 'quorum_block_r3_2', phase: 'DECIDING' }`. Assert expectedState returns null.

7. Integration test: `exit code 0 on valid quorum_fallback_t1_required trace` — Use runValidator with a NDJSON line containing `{ type: 'quorum_fallback_t1_required', fanOutCount: 3, phase: 'IDLE', ts: ... }`. Assert exit code 0 and stdout matches /100\.0%/.

8. Integration test: `exit code 0 on security_sweep trace (skipped, not divergent)` — Use runValidator with a single security_sweep event. Assert exit code 0 (security_sweep returns null from mapToXStateEvent, expectedState also returns null, so it counts as valid/skipped).

Wait -- security_sweep will return null from mapToXStateEvent, which currently triggers the unmappable_action divergence path (line 349-357). So we need to handle it differently. The test for security_sweep should verify it does NOT cause a divergence. This means the fix in Task 2 must either: (a) add a case that returns a valid XState event, or (b) handle it as a known-skip before the unmappable check. Use approach (b): add security_sweep to a SKIP_ACTIONS set that returns valid before the null check.

Revised test 8: Use runValidator with security_sweep event. Assert exit code 0 and stdout does NOT match /divergence/i.
  </action>
  <verify>Run `cd /Users/jonathanborduas/code/QGSD && node --test bin/validate-traces.test.cjs 2>&1 | tail -20` — new tests should FAIL (RED state) since mapToXStateEvent has not been updated yet.</verify>
  <done>8 new test cases added to validate-traces.test.cjs, all failing because the source has not been updated yet.</done>
</task>

<task type="auto">
  <name>Task 2: Expand mapToXStateEvent and expectedState to handle all 3 action types</name>
  <files>bin/validate-traces.cjs</files>
  <action>
Make three changes to bin/validate-traces.cjs:

**Change 1: Normalize action in mapToXStateEvent (line 74)**

Replace:
```js
if (!event || typeof event.action !== 'string') return null;
switch (event.action) {
```

With:
```js
const action = (event && (event.action || event.type)) || null;
if (typeof action !== 'string') return null;
switch (action) {
```

This ensures events with `type` field but no `action` field (5649 quorum_fallback_t1_required events) are normalized.

**Change 2: Add switch cases in mapToXStateEvent**

Add these cases before the `default:` line:

```js
case 'quorum_fallback_t1_required':
  return { type: 'QUORUM_START', slotsAvailable: event.fanOutCount || 0 };
case 'quorum_block_r3_2':
  return { type: 'DECIDE', outcome: 'BLOCK' };
case 'security_sweep':
  return null; // Not an FSM event — handled as known-skip below
```

**Change 3: Handle security_sweep as known-skip in the main validation loop**

In the main validation loop (line ~348-358), change the unmappable_action check to distinguish between truly unknown actions and known non-FSM actions that should be skipped:

Before the `if (!xstateEvent)` block, add a set of known non-FSM actions:

At the top of the `if (require.main === module)` block (around line 237), add:
```js
const KNOWN_NON_FSM_ACTIONS = new Set(['security_sweep']);
```

Then change the unmappable_action block from:
```js
if (!xstateEvent) {
  divergences.push({
    event,
    reason: 'unmappable_action: ' + event.action,
    ...
  });
  continue;
}
```

To:
```js
if (!xstateEvent) {
  const normalizedAction = event.action || event.type;
  if (KNOWN_NON_FSM_ACTIONS.has(normalizedAction)) {
    valid++;
    continue;
  }
  divergences.push({
    event,
    reason: 'unmappable_action: ' + normalizedAction,
    divergenceType: 'unmappable_action',
    ...scoreboardMeta,
    confidence,
  });
  continue;
}
```

**Change 4: Normalize action in expectedState function**

The expectedState function (line 185) also reads event.action directly. Add normalization at the top:

```js
function expectedState(event) {
  const action = event.action || event.type;
```

Then update the comparisons to use `action` instead of `event.action`:
- `if (action === 'quorum_start')` ...
- `if (action === 'quorum_fallback_t1_required') return 'COLLECTING_VOTES';` (add this case)
- `if (action === 'deliberation_round')` ...
- `if (action === 'circuit_break')` ...

quorum_block_r3_2 does not need an explicit expectedState case because it will hit the H1 phase check (events with phase !== 'IDLE' return null) or fall through to the outcome checks.
  </action>
  <verify>Run `cd /Users/jonathanbordumas/code/QGSD && node --test bin/validate-traces.test.cjs 2>&1 | tail -30` — ALL tests (existing + new) must pass. Then run `cd /Users/jonathanborduas/code/QGSD && node bin/validate-traces.cjs 2>&1 | head -5` — should show 0 divergences or significantly reduced count.</verify>
  <done>mapToXStateEvent handles event.type normalization, quorum_fallback_t1_required, quorum_block_r3_2, and security_sweep. All tests pass. Divergence count drops from 6373 to 0.</done>
</task>

</tasks>

<verification>
1. `node --test bin/validate-traces.test.cjs` — all tests pass (0 failures)
2. `node bin/validate-traces.cjs` — reports 0 divergences, exits with code 0
3. `npm test` — full test suite passes (no regressions)
</verification>

<success_criteria>
- ci:conformance-traces check passes with 0 divergences
- All existing validate-traces tests continue to pass
- New tests cover type-only events, quorum_fallback_t1_required, quorum_block_r3_2, and security_sweep
- mapToXStateEvent normalizes event.action || event.type for all events
</success_criteria>

<output>
After completion, create `.planning/quick/205-fix-conformance-traces-expand-maptoxstat/205-SUMMARY.md`
</output>
