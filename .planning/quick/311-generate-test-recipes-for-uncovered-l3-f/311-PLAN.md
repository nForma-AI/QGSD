---
phase: quick-311
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/reasoning/failure-mode-catalog.json
  - .planning/formal/test-recipes/test-recipes.json
autonomous: true
requirements: []
formal_artifacts: none
---

<objective>
Generate failure modes and test recipes for 105 uncovered models identified by Gate C.

Gate C per-model check requires: for each model's requirements, at least one failure mode in failure-mode-catalog.json must reference that requirement AND have a corresponding test recipe in test-recipes.json.

Current state: failure-mode-catalog.json only has 123 FSM-derived failure modes (from hazard-model.json). These cover DISP-01 and a few other requirements, leaving 105 models without matching failure modes for their requirements.

Fix: Add requirement-level failure modes to failure-mode-catalog.json for each uncovered model's requirements, then add corresponding test recipes to test-recipes.json. Use a generic "property-omission" pattern: the failure mode is "requirement X's formal property is not implemented/enforced."
</objective>

<tasks>
<task type="auto">
  <name>Generate requirement-level failure modes and test recipes for uncovered Gate C models</name>
  <files>.planning/formal/reasoning/failure-mode-catalog.json, .planning/formal/test-recipes/test-recipes.json</files>
  <action>
1. Read model-registry.json to get all 192 models and their requirements
2. Read existing failure-mode-catalog.json and test-recipes.json
3. Run compute-per-model-gates.cjs to identify which models fail Gate C
4. For each failing model's first requirement that lacks a failure mode:
   a. Create a failure mode entry:
      - id: FM-REQ-{REQ_ID}-OMISSION
      - description: "Formal property for requirement {REQ_ID} is not enforced in implementation"
      - mode: "omission"
      - derived_from: [{ layer: "L3", artifact: model_path, ref: "requirements[id={REQ_ID}]" }]
      - severity_class: "degraded"
   b. Create a test recipe entry:
      - id: TR-FM-REQ-{REQ_ID}-OMISSION
      - failure_mode_id: FM-REQ-{REQ_ID}-OMISSION
      - title: "Test enforcement of requirement {REQ_ID}"
      - setup/input_sequence/expected_outcome based on requirement text
5. Write both updated files atomically
6. Verify by re-running compute-per-model-gates.cjs --aggregate to check Gate C score improvement
  </action>
  <verify>node compute-per-model-gates.cjs --aggregate --json | check gate_c unvalidated_entries decreased</verify>
  <done>Gate C per-model failures reduced from 105. New failure modes and test recipes added.</done>
</task>
</tasks>
