---
phase: solve-ft-batch-2-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/DIAG-05.stub.test.js
autonomous: true
requirements: [DIAG-05]
formal_artifacts: none
---

<objective>
Implement 1 test stub for DIAG-05 requirement (MCP repair lifecycle).

For each stub, read its recipe JSON for pre-resolved context, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- DIAG-05: model=.planning/formal/alloy/mcp-repair-lifecycle.als property=SlotStatus text="Provide /nf:mcp-repair skill to auto-diagnose quorum slot connectivity issues and apply automatic repairs where possible (restart downed MCP servers, report non-fixable issues with actionable guidance)."
  recipe=.planning/formal/generated-stubs/DIAG-05.stub.recipe.json
</objective>

<tasks>
<task type="auto">
  <name>Implement stub: DIAG-05</name>
  <files>.planning/formal/generated-stubs/DIAG-05.stub.test.js</files>
  <action>
1. Read .planning/formal/generated-stubs/DIAG-05.stub.recipe.json
2. Read the stub file (.stub.test.js)
3. The formal model at .planning/formal/alloy/mcp-repair-lifecycle.als defines the MCP repair lifecycle with these key assertions:
   - SlotStatus: abstract sig with Healthy, ServerDown, AuthExpired, QuotaExhausted, Unreachable, Unknown
   - RepairPrecedesDiagnosis: repair requires prior diagnosis
   - VerifyFollowsRepair: repaired slots must be re-verified
   - ClassificationComplete: diagnosed slots get exactly one classification
   - NonFixableGuidance: non-fixable non-healthy slots get guidance
   - ReadOnlyExceptRestart: only ServerDown triggers repair
4. Test strategy is "structural" — verify the mcp-repair skill workflow file (commands/nf/mcp-repair.md) and implementation files (bin/check-provider-health.cjs, bin/probe-quorum-slots.cjs) contain the structural elements corresponding to the formal properties
5. Key structural checks:
   - commands/nf/mcp-repair.md exists and references diagnose/classify/repair/verify/guide phases
   - bin/check-provider-health.cjs exists and exports health-check functionality
   - bin/probe-quorum-slots.cjs exists and handles slot probing
   - The Alloy model file exists at .planning/formal/alloy/mcp-repair-lifecycle.als
   - The model contains all 5 required assertions
6. Replace assert.fail('TODO') with real structural test logic
  </action>
  <verify>node --test .planning/formal/generated-stubs/DIAG-05.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Stub has real test logic verifying structural properties.</done>
</task>
</tasks>
