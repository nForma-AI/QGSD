---
phase: quick-245
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/test-recipes/test-recipes.json
autonomous: true
requirements: []
formal_artifacts: none
---

<objective>
Generate test recipes for uncovered L3 failure modes identified by Gate C.
The test-recipe-gen.cjs was run to regenerate all recipes from the current
failure mode catalog, improving gate_c_score from 0.008 to 0.164.
</objective>

<tasks>
<task type="auto">
  <name>Regenerate test recipes from failure mode catalog</name>
  <files>.planning/formal/test-recipes/test-recipes.json</files>
  <action>
Run `node bin/test-recipe-gen.cjs` to regenerate test recipes from the
current failure-mode-catalog.json. This maps each L3 failure mode to a
concrete test recipe with setup, input_sequence, expected_outcome, and oracle.
  </action>
  <verify>gate_c_score improves from baseline</verify>
  <done>Test recipes regenerated, gate_c_score improved from 0.008 to 0.164</done>
</task>
</tasks>
