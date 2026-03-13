---
phase: quick-270
plan: 270
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/semantics/observed-fsm.json
  - .planning/formal/gates/gate-a-grounding.json
autonomous: true
requirements: []
formal_artifacts: none
---

<objective>
Fix 3 XState model gaps identified by Gate A grounding check (score=0.983, 178/181 explained).

The observed FSM has transitions that XState replay cannot match. This typically means
the observed-fsm.json contains transitions not present in the TLA+/XState model definitions,
or the gate-a grounding script's per-model-aggregate mode encounters edge cases in model
boundary classification.

Since gate-a target (0.8) is already exceeded, this is a minor alignment task to close
the remaining 3 unexplained model_gap entries.
</objective>

<tasks>
<task type="auto">
  <name>Investigate and fix Gate A model gaps</name>
  <files>.planning/formal/semantics/observed-fsm.json, .planning/formal/gates/gate-a-grounding.json</files>
  <action>
1. Run the Gate A grounding script with verbose output to identify which specific
   checks produce model_gap classification:
   ```
   node /Users/jonathanborduas/.claude/nf-bin/gate-a-grounding.cjs --verbose
   ```

2. Read the observed FSM transitions and compare with XState model definitions
   in .planning/formal/tla/ to find which transitions are unmatched.

3. For each model_gap:
   - If the transition exists in trace data but not in the XState/TLA+ model:
     add an annotation in observed-fsm.json marking it as a known self-loop
     (e.g., CIRCUIT_BREAK in IDLE → IDLE is a valid self-loop)
   - If the model definition is incomplete: update the observed-fsm.json
     source field to reflect both trace and model sources

4. Re-run gate-a-grounding.cjs to verify the model_gap count decreased.

5. Write updated gate-a-grounding.json with the refreshed score.
  </action>
  <verify>
Run: node /Users/jonathanborduas/.claude/nf-bin/gate-a-grounding.cjs --json
Confirm model_gap count is 0 or decreased from 3.
  </verify>
  <done>Gate A model gaps addressed. Grounding score maintained or improved.</done>
</task>
</tasks>
