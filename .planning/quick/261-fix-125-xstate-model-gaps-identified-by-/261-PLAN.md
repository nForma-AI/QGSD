---
phase: quick-261
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/machines/nf-workflow.machine.ts
  - dist/machines/nf-workflow.machine.js
  - .planning/formal/semantics/observed-fsm.json
autonomous: true
requirements: []
formal_artifacts: none
---

<objective>
Fix 124 XState model gaps identified by Gate A grounding check. The observed-fsm.json shows 11 transitions observed in conformance traces that are missing from the XState machine definition. These are all self-loop transitions where events arrive in states that don't explicitly handle them. Adding these transitions as explicit self-loops in the XState machine will allow the gate-a replay to explain them, raising the grounding score from 0.31 toward the 0.80 target.

Missing transitions (from observed-fsm.json model_comparison.missing_in_model):
1. IDLE -> DECIDE -> IDLE (16441 occurrences)
2. IDLE -> VOTES_COLLECTED -> IDLE (4764 occurrences)
3. COLLECTING_VOTES -> QUORUM_START -> COLLECTING_VOTES (6998 occurrences)
4. COLLECTING_VOTES -> CIRCUIT_BREAK -> COLLECTING_VOTES (1396 occurrences)
5. COLLECTING_VOTES -> DECIDE -> COLLECTING_VOTES (2239 occurrences)
6. DELIBERATING -> QUORUM_START -> DELIBERATING (67 occurrences)
7. DELIBERATING -> CIRCUIT_BREAK -> DELIBERATING (31 occurrences)
8. DECIDED -> DECIDE -> DECIDED (13790 occurrences)
9. DECIDED -> CIRCUIT_BREAK -> DECIDED (11275 occurrences)
10. DECIDED -> QUORUM_START -> DECIDED (27812 occurrences)
11. DECIDED -> VOTES_COLLECTED -> DECIDED (4447 occurrences)
</objective>

<tasks>
<task type="auto">
  <name>Add missing self-loop transitions to XState machine</name>
  <files>src/machines/nf-workflow.machine.ts</files>
  <action>
Edit the XState machine definition in src/machines/nf-workflow.machine.ts:

1. **IDLE state**: Add DECIDE and VOTES_COLLECTED as self-loop transitions (target: 'IDLE'). These occur when events arrive before a quorum session is active.

2. **COLLECTING_VOTES state**: Add QUORUM_START (self-loop), CIRCUIT_BREAK (self-loop), and DECIDE (self-loop). These occur when overlapping events arrive during vote collection.

3. **DELIBERATING state**: Add QUORUM_START (self-loop) and CIRCUIT_BREAK (self-loop). These occur when events arrive during deliberation.

4. **DECIDED state**: Remove `type: 'final'` and add DECIDE (self-loop), CIRCUIT_BREAK (self-loop), QUORUM_START (self-loop), and VOTES_COLLECTED (self-loop). The final state must accept these events because traces show they occur after decision.

Each self-loop should be a simple `{ target: 'STATE_NAME' }` entry with no actions or guards since these are no-op absorptions of out-of-phase events.
  </action>
  <verify>node -e "const m = require('./dist/machines/nf-workflow.machine.js'); console.log('Machine loaded OK');"</verify>
  <done>All 11 missing transitions added as self-loops. Machine still valid.</done>
</task>

<task type="auto">
  <name>Rebuild machine bundle and regenerate observed-fsm</name>
  <files>dist/machines/nf-workflow.machine.js, .planning/formal/semantics/observed-fsm.json</files>
  <action>
1. Rebuild the machine bundle: `npm run build:machines`
2. Regenerate observed-fsm.json by running the trace walker: `node bin/xstate-trace-walker.cjs --json`
3. Verify the model_comparison.missing_in_model list is now empty (or significantly reduced)
4. Run gate-a-grounding check to confirm improved score
  </action>
  <verify>node -e "const fsm = JSON.parse(require('fs').readFileSync('.planning/formal/semantics/observed-fsm.json','utf8')); console.log('Missing in model:', fsm.model_comparison.missing_in_model.length);"</verify>
  <done>missing_in_model is 0 or near 0. Gate A score improved.</done>
</task>
</tasks>
