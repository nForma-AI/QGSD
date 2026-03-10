---
phase: quick-265
plan: 265
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/model-registry.json
autonomous: true
requirements: [GATE-02]
formal_artifacts: none
---

<objective>
Fix 3 orphaned L3 Gate B entries by adding requirement mappings to model-registry.json.

Target models:
- .planning/formal/alloy/quorum-votes.als → SPEC-03, SIG-04, COMP-01
- .planning/formal/prism/quorum.pm → HEAL-02, SENS-01
- .planning/formal/tla/NFQuorum.tla → SOLVE-03, STOP-01, DISP-04
</objective>

<tasks>
<task type="auto">
  <name>Add requirement mappings to 3 L3 quorum models</name>
  <files>.planning/formal/model-registry.json</files>
  <action>Add requirements arrays to the 3 models based on their formal property domains</action>
  <verify>node bin/compute-per-model-gates.cjs --aggregate --json | grep gate_b_score</verify>
  <done>Gate B score = 1.0, 0 orphaned entries</done>
</task>
</tasks>
