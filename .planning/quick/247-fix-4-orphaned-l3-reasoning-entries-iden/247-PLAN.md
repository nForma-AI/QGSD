---
phase: quick-247
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/model-registry.json
autonomous: true
requirements: []
formal_artifacts: none
---

<objective>
Fix 4 orphaned models failing Gate B by repairing their model-registry entries:

1. `.planning/formal/alloy/quorum-votes.als` — L2, missing requirements → add quorum requirement IDs
2. `.planning/formal/prism/quorum.pm` — missing source_layer → add source_layer: L2
3. `../../../../tmp/promote-test/.formal/tla/QGSDQuorum.tla` — stale test path → remove from registry
4. `.planning/formal/tla/NFQuorum.tla` — L2, missing requirements → add quorum requirement IDs
</objective>

<tasks>
<task type="auto">
  <name>Fix 4 Gate B orphans in model-registry.json</name>
  <files>.planning/formal/model-registry.json</files>
  <action>
1. Read model-registry.json
2. For quorum-votes.als and NFQuorum.tla: add requirements array with quorum-related
   requirement IDs (e.g., R3.1, R3.2, R3.3 — find exact IDs from requirements.json
   that match quorum concepts)
3. For prism/quorum.pm: add source_layer: "L2" and requirements (same quorum IDs)
4. Remove the stale test entry "../../../../tmp/promote-test/.formal/tla/QGSDQuorum.tla"
5. Write back model-registry.json
  </action>
  <verify>
Run: node /private/tmp/find-gate-b-failures.cjs
Expect: Gate B failing models: 0
  </verify>
  <done>All 4 Gate B orphans fixed. Registry cleaned.</done>
</task>
</tasks>
