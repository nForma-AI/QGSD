---
phase: quick-309
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/traceability-matrix.json
  - bin/hypothesis-measure.test.cjs
  - bin/nf-solve.test.cjs
autonomous: true
requirements: [TC-01, H2M-01]
formal_artifacts: none
---

<objective>
Fix 2 Gate A per-model grounding failures (l1_to_l3 residual=1).

Two formal models fail Gate A (no L1 evidence grounding):
1. `.planning/formal/alloy/v8-coverage-digest.als` — req TC-01 has no passing traces or unit test coverage
2. `.planning/formal/alloy/hypothesis-measurement.als` — req H2M-01 has no passing traces or unit test coverage

Gate A per-model pass requires at least one of:
- Passing trace in traceability-matrix.json for a requirement
- Unit test coverage (covered: true) for a requirement
- Semantic declarations in layer-manifest

Fix: Add unit tests that exercise the implementing code for TC-01 (V8 coverage digest in nf-solve.cjs) and H2M-01 (hypothesis-measure.cjs), then annotate traceability-matrix.json with the test coverage so Gate A recognizes them.
</objective>

<tasks>
<task type="auto">
  <name>Add unit test for TC-01 (V8 coverage digest)</name>
  <files>bin/nf-solve.test.cjs</files>
  <action>
Find the digestCoverage or V8 coverage digest function in bin/nf-solve.cjs.
Add a test in bin/nf-solve.test.cjs that:
1. Creates a mock V8 coverage blob (raw format with url, functions, ranges)
2. Calls the digest function
3. Asserts the output is a Map or object with {covered, uncovered} line sets
4. Asserts compression (output size << input size)
Tag test with @req TC-01 in description.
  </action>
  <verify>node --test bin/nf-solve.test.cjs --test-name-pattern="TC-01"</verify>
  <done>TC-01 has a passing unit test.</done>
</task>

<task type="auto">
  <name>Add unit test for H2M-01 (hypothesis measurement)</name>
  <files>bin/hypothesis-measure.test.cjs</files>
  <action>
Read bin/hypothesis-measure.cjs to understand the exported API.
Create bin/hypothesis-measure.test.cjs that:
1. Calls the measurement function with mock data
2. Asserts it produces entries with verdict: CONFIRMED, VIOLATED, or UNMEASURABLE
3. Asserts output format matches hypothesis-measurements.json schema
Tag test with @req H2M-01 in description.
  </action>
  <verify>node --test bin/hypothesis-measure.test.cjs</verify>
  <done>H2M-01 has a passing unit test.</done>
</task>

<task type="auto">
  <name>Update traceability-matrix with test coverage</name>
  <files>.planning/formal/traceability-matrix.json</files>
  <action>
Run formal-test-sync or manually update traceability-matrix.json:
- Set TC-01.unit_test_coverage.covered = true with test_cases referencing the new test
- Set H2M-01.unit_test_coverage.covered = true with test_cases referencing the new test
Then verify Gate A passes for both models by running compute-per-model-gates.cjs.
  </action>
  <verify>node compute-per-model-gates.cjs --aggregate --json | check gate_a model_gap = 0</verify>
  <done>Both models pass Gate A. l1_to_l3 residual drops to 0.</done>
</task>
</tasks>
