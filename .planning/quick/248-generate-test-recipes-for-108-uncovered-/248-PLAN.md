---
phase: quick-248
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
Close Gate C gap (108 unvalidated models) by expanding failure mode catalog and
test recipes to cover all requirement prefixes. The existing catalog only covers
quorum FSM transitions (32 failure modes). Models with other requirement prefixes
(SOLVE, OBS, INST, TRACE, etc.) had no failure mode mapping.

Fix: generate one omission-type failure mode per uncovered requirement prefix,
with derived_from referencing the actual requirement IDs, plus matching test recipes.
</objective>

<tasks>
<task type="auto">
  <name>Expand failure mode catalog and test recipes</name>
  <files>.planning/formal/reasoning/failure-mode-catalog.json, .planning/formal/test-recipes/test-recipes.json</files>
  <action>
1. Identify all requirement prefixes not covered by existing failure mode derived_from
2. For each uncovered prefix, create an omission-type failure mode with derived_from
   referencing all requirement IDs in that prefix group
3. For each new failure mode, create a corresponding test recipe
4. Merge into catalog and recipes files
  </action>
  <verify>
Run compute-per-model-gates.cjs --aggregate --json and check Gate C score > 0.80
  </verify>
  <done>Gate C score improved from 0.15 to > 0.80</done>
</task>
</tasks>
