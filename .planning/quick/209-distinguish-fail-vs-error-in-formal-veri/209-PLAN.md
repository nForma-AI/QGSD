---
phase: quick-209
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/write-check-result.cjs
  - bin/run-alloy.cjs
  - bin/run-prism.cjs
  - bin/run-oauth-rotation-prism.cjs
  - bin/run-tlc.cjs
  - bin/run-protocol-tlc.cjs
  - bin/run-oscillation-tlc.cjs
  - bin/run-account-manager-tlc.cjs
  - bin/run-breaker-tlc.cjs
  - bin/run-stop-hook-tlc.cjs
  - bin/run-transcript-alloy.cjs
  - bin/run-quorum-composition-alloy.cjs
  - bin/run-installer-alloy.cjs
  - bin/run-audit-alloy.cjs
  - bin/run-account-pool-alloy.cjs
  - bin/run-uppaal.cjs
  - bin/check-trace-schema-drift.cjs
  - bin/check-liveness-fairness.cjs
  - bin/check-trace-redaction.cjs
  - bin/gate-a-grounding.cjs
  - bin/gate-b-abstraction.cjs
  - bin/gate-c-validation.cjs
  - bin/validate-traces.cjs
  - bin/nf-solve.cjs
  - bin/nForma.cjs
  - bin/generate-triage-bundle.cjs
autonomous: true
requirements: []
formal_artifacts: none
must_haves:
  truths:
    - "'error' is a valid result value in write-check-result.cjs VALID_RESULTS array"
    - "Infrastructure failures (binary/JAR/model not found, Java version wrong, spawn failed) use result:'error' not result:'fail'"
    - "Real verification failures (counterexample, divergence, property violation) still use result:'fail'"
    - "nf-solve.cjs sweepFtoC() counts 'error' results separately from 'fail' results"
    - "Only 'fail' count contributes to F->C residual, not 'error' count"
    - "F->C display section shows errors separately with distinct icon"
  artifacts:
    - bin/write-check-result.cjs
    - bin/nf-solve.cjs
  key_links:
    - bin/write-check-result.cjs:6
    - bin/nf-solve.cjs:1029
    - bin/nf-solve.cjs:2690
---

<objective>
Distinguish FAIL (requirement violation) from ERROR (infrastructure/tooling issue) in formal verification results.

Currently all non-pass outcomes from runner scripts are recorded as result:'fail', conflating real findings (counterexample found, conformance divergences) with infrastructure noise (binary not found, model file missing, Java version wrong). This inflates the F->C residual with issues that don't represent requirement violations.

Add result:'error' for infrastructure failures. Only real verification failures count toward F->C residual.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Add 'error' to VALID_RESULTS and update all runner scripts</name>
  <files>bin/write-check-result.cjs, bin/run-alloy.cjs, bin/run-prism.cjs, bin/run-oauth-rotation-prism.cjs, bin/run-tlc.cjs, bin/run-protocol-tlc.cjs, bin/run-oscillation-tlc.cjs, bin/run-account-manager-tlc.cjs, bin/run-breaker-tlc.cjs, bin/run-stop-hook-tlc.cjs, bin/run-transcript-alloy.cjs, bin/run-quorum-composition-alloy.cjs, bin/run-installer-alloy.cjs, bin/run-audit-alloy.cjs, bin/run-account-pool-alloy.cjs, bin/run-uppaal.cjs, bin/check-trace-schema-drift.cjs, bin/check-liveness-fairness.cjs, bin/check-trace-redaction.cjs, bin/gate-a-grounding.cjs, bin/gate-b-abstraction.cjs, bin/gate-c-validation.cjs, bin/validate-traces.cjs</files>
  <action>
1. In bin/write-check-result.cjs line 6: change VALID_RESULTS from ['pass', 'fail', 'warn', 'inconclusive'] to ['pass', 'fail', 'error', 'warn', 'inconclusive']

2. In each runner script, classify writeCheckResult calls:

   ERROR (change result:'fail' to result:'error', and summary prefix from 'fail:' to 'error:'):
   - Binary not found (Java, PRISM, verifyta, etc.)
   - JAR not found (Alloy JAR, TLA2tools JAR)
   - Model file not found (ALS, PM, TLA, CFG files)
   - Java version wrong (< 17)
   - Spawn/invocation failed (alloyResult.error, result.error)
   - "Failed to launch" errors
   - Version check failed

   FAIL (keep as-is):
   - Counterexample found (Alloy)
   - Non-zero exit AFTER successful model execution (line 145-148 in run-alloy.cjs)
   - Conformance trace divergences
   - Property violations
   - PRISM property check failures (actual probability results)
   - TLC counterexample/violation

   Pattern: look for summary strings containing "(not found)", "(Java not found)", "(JAR not found)", "(binary not found)", "(version check failed)", "(model not found)", "(ALS not found)" — these are all ERROR.
  </action>
  <verify>grep -c "'error'" bin/write-check-result.cjs should show VALID_RESULTS contains 'error'. grep -rn "result: 'error'" bin/run-*.cjs bin/check-*.cjs bin/gate-*.cjs bin/validate-traces.cjs should show infrastructure failures use 'error'.</verify>
  <done>All infrastructure failures use result:'error'. All real verification failures still use result:'fail'. VALID_RESULTS includes 'error'.</done>
</task>

<task type="auto">
  <name>Task 2: Update nf-solve.cjs to count errors separately and display them</name>
  <files>bin/nf-solve.cjs, bin/generate-triage-bundle.cjs, bin/nForma.cjs</files>
  <action>
1. In bin/nf-solve.cjs sweepFtoC() (~line 1018-1055):
   - Add errorCount = 0 and errors = [] alongside failedCount and failures
   - In the parse loop, add: else if (entry.result === 'error') { errorCount++; errors.push({...}); }
   - Keep residual = failedCount (NOT failedCount + errorCount — errors don't inflate residual)
   - Add error_count and errors to existingDetail object

2. In bin/nf-solve.cjs display section (~line 2690-2720):
   - Add error count to parts array: if (detail.error_count > 0) parts.push(detail.error_count + ' error')
   - Add errors display block after failures: for each error show '  ⚙ ' + e.check_id + ' — ' + e.summary
   - Keep existing failure display with '  ✗ ' prefix unchanged

3. In bin/generate-triage-bundle.cjs (~line 30): add r.result === 'error' to the filter condition alongside 'fail'

4. In bin/nForma.cjs (~line 2609): add 'error' color mapping (use yellow or orange)
  </action>
  <verify>node -e "const s = require('fs').readFileSync('bin/nf-solve.cjs','utf8'); console.log(s.includes('error_count') && s.includes('errorCount'))" should print true</verify>
  <done>sweepFtoC counts errors separately. Only failedCount drives residual. Display shows errors with ⚙ icon distinct from ✗ failures.</done>
</task>

<task type="auto">
  <name>Task 3: Update tests</name>
  <files>bin/write-check-result.test.cjs, bin/failure-taxonomy.test.cjs, bin/verify-formal-results.test.cjs</files>
  <action>
1. In bin/write-check-result.test.cjs: add test that result:'error' is accepted (not thrown). Verify existing tests for 'fail' still pass.

2. In bin/failure-taxonomy.test.cjs: add test case for result:'error' entries (infrastructure classification). Verify existing fail-based tests still pass.

3. In bin/verify-formal-results.test.cjs: if it filters on result === 'fail', ensure it also handles 'error' appropriately (errors should not count as verification failures).

4. Run: node --test bin/write-check-result.test.cjs bin/failure-taxonomy.test.cjs bin/verify-formal-results.test.cjs
  </action>
  <verify>node --test bin/write-check-result.test.cjs && node --test bin/failure-taxonomy.test.cjs && node --test bin/verify-formal-results.test.cjs</verify>
  <done>All three test files pass. 'error' result type is tested. Existing tests unchanged.</done>
</task>
</tasks>
