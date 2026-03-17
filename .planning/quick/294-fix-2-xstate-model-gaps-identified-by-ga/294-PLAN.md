---
phase: quick-294
plan: 294
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/PRM-AM-01.stub.test.js
  - .planning/formal/generated-stubs/CRED-12.stub.test.js
  - .planning/formal/unit-test-coverage.json
autonomous: true
requirements: [PRM-AM-01, CRED-12]
formal_artifacts: none
---

<objective>
Fix 2 Gate A model gaps for requirements PRM-AM-01 and CRED-12. These requirements
are mapped to .planning/formal/prism/oauth-rotation.pm but PRISM is not installed,
so no passing traces exist. Gate A allows alternative grounding via unit-test-coverage.

Create test stubs for PRM-AM-01 and CRED-12 that verify the oauth rotation
implementation in bin/call-quorum-slot.cjs and bin/account-manager.cjs, then
regenerate unit-test-coverage.json so Gate A can ground these requirements.

Key source files:
- bin/call-quorum-slot.cjs (runSubprocessWithRotation function)
- bin/account-manager.cjs (account rotation logic)
- bin/gh-account-rotate.cjs (GitHub account rotation)
- .planning/formal/prism/oauth-rotation.pm (formal model — PRISM DTMC)
</objective>

<tasks>
<task type="auto">
  <name>Create test stubs for PRM-AM-01 and CRED-12</name>
  <files>.planning/formal/generated-stubs/PRM-AM-01.stub.test.js, .planning/formal/generated-stubs/CRED-12.stub.test.js</files>
  <action>
1. Read requirements PRM-AM-01 and CRED-12 from .planning/formal/requirements.json
2. Read the formal model .planning/formal/prism/oauth-rotation.pm for property context
3. Read bin/call-quorum-slot.cjs to find runSubprocessWithRotation and its rotation logic
4. Read bin/account-manager.cjs for account pool rotation
5. Create PRM-AM-01.stub.test.js: test that oauth rotation succeeds within max_retries
   - Import relevant functions from bin/call-quorum-slot.cjs or bin/account-manager.cjs
   - Test the retry/rotation loop behavior
   - Use node:test + node:assert/strict
6. Create CRED-12.stub.test.js: test credential rotation safety properties
   - Verify credential pool management
   - Test rotation command execution path
7. Run: node bin/scan-unit-test-coverage.cjs (or equivalent) to regenerate unit-test-coverage.json
  </action>
  <verify>node --test .planning/formal/generated-stubs/PRM-AM-01.stub.test.js .planning/formal/generated-stubs/CRED-12.stub.test.js</verify>
  <done>Both stubs pass. PRM-AM-01 and CRED-12 appear in unit-test-coverage.json as covered.</done>
</task>
</tasks>
