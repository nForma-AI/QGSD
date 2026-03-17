---
phase: quick-295
plan: 295
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/reasoning/failure-mode-catalog.json
  - .planning/formal/test-recipes/test-recipes.json
autonomous: true
requirements: [CONF-01, DISPATCH-01, SLOT-02, AGT-01, QUORUM-06, INST-06, NAV-04, SPEC-04, NAV-01, NAV-02, TUI-01]
formal_artifacts: none
---

<objective>
Add failure modes and test recipes for 30 requirements across 11 TLA+ models
that fail Gate C validation. These models have valid TLC check-results but Gate C
cannot link them because: (a) the failure-mode-catalog lacks entries referencing
these requirements, and (b) the check_id matching uses MC-prefixed names that
don't match model paths.

Fix: Add one representative failure mode per model to the catalog, then create
matching test recipes. This closes the Gate C gap via Path 1 (requirement ->
failure mode -> test recipe).
</objective>

<tasks>
<task type="auto">
  <name>Add failure modes and test recipes for 11 uncovered TLA+ models</name>
  <files>.planning/formal/reasoning/failure-mode-catalog.json, .planning/formal/test-recipes/test-recipes.json</files>
  <action>
1. Read failure-mode-catalog.json and add one failure mode per model
2. Read test-recipes.json and add one test recipe per new failure mode
3. Run node bin/test-recipe-gen.cjs to verify recipe count increases
  </action>
  <verify>node bin/compute-per-model-gates.cjs --aggregate 2>&1 | grep gate_c</verify>
  <done>Gate C unvalidated_entries decreases from 15</done>
</task>
</tasks>
