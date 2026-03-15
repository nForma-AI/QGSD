---
phase: quick-296
plan: 296
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/semantics/observed-fsm.json
  - .planning/formal/gates/gate-a-grounding.json
autonomous: true
requirements: [QUORUM-06, NAV-01, NAV-02]
formal_artifacts: none
---

<objective>
Fix 3 Gate A model gaps where formal TLA+ models lack passing conformance traces for their mapped requirements. The gate-a-grounding check found 3 models with no passing traces:

1. QGSDCheckpointGate.tla — req QUORUM-06 has no passing trace
2. QGSDTUIModules.tla — req NAV-01 has no passing trace
3. QGSDTUISessions.tla — req NAV-02 has no passing trace

These models exist and map to requirements, but the conformance trace corpus has no events that exercise those requirement-model pairs. Fix by adding conformance trace annotations or updating the observed-fsm.json to recognize these requirement traces.
</objective>

<tasks>
<task type="auto">
  <name>Add conformance traces for QUORUM-06, NAV-01, NAV-02</name>
  <files>.planning/formal/semantics/observed-fsm.json, .planning/formal/evidence/instrumentation-map.json</files>
  <action>
1. Read .planning/formal/model-registry.json to find the requirement mappings for QGSDCheckpointGate.tla, QGSDTUIModules.tla, QGSDTUISessions.tla
2. Read the unit test coverage file at .planning/formal/unit-test-coverage.json to check if QUORUM-06, NAV-01, NAV-02 have unit test coverage entries
3. If unit test coverage exists for these requirements, add entries to the instrumentation-map.json linking the test files to the requirement IDs so gate-a can find grounding evidence
4. If no unit test coverage exists, check if the requirements have any code-level evidence (grep for the requirement IDs in test/ and bin/ directories)
5. Update the instrumentation-map to include any discovered evidence paths
6. Run gate-a-grounding.cjs to verify the fix reduces the model_gap count
  </action>
  <verify>node bin/gate-a-grounding.cjs --json 2>/dev/null | grep -o '"model_gap":[0-9]*'</verify>
  <done>Gate A model_gap count is reduced. All 3 models have grounding evidence.</done>
</task>
</tasks>
