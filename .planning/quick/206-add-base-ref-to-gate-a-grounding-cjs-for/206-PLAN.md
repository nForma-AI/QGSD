---
phase: quick-206
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/gate-a-grounding.cjs
  - bin/gate-a-grounding.test.cjs
autonomous: true
formal_artifacts: none
requirements: [GATE-01]

must_haves:
  truths:
    - "Running gate-a-grounding.cjs --base-ref <sha> scopes grounding to actions from files changed since <sha>"
    - "Scoped grounding score for changed files must independently meet 80% target"
    - "Global grounding score is still computed and reported but marked informational when --base-ref is used"
    - "Running without --base-ref produces identical output to current behavior (backward compatible)"
  artifacts:
    - path: "bin/gate-a-grounding.cjs"
      provides: "--base-ref flag implementation with diff-scoped grounding"
      contains: "getChangedActions"
    - path: "bin/gate-a-grounding.test.cjs"
      provides: "Tests for --base-ref scoping logic"
      contains: "base-ref"
  key_links:
    - from: "bin/gate-a-grounding.cjs"
      to: ".planning/formal/evidence/instrumentation-map.json"
      via: "file-to-action mapping for diff scoping"
      pattern: "instrumentation-map"
    - from: "bin/gate-a-grounding.cjs"
      to: "git diff --name-only"
      via: "execSync to get changed files in commit range"
      pattern: "execSync.*git.*diff"
---

<objective>
Add `--base-ref <sha>` flag to `bin/gate-a-grounding.cjs` so that grounding analysis can be scoped to only the conformance actions associated with files changed since a given commit. New/modified features must independently reach the 80% grounding target, while the global score remains informational.

Purpose: Enable diff-scoped grounding checks in CI and nf:solve so that new code is validated for conformance coverage without being masked by the global corpus score.

Output: Updated gate-a-grounding.cjs with --base-ref support, updated tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/gate-a-grounding.cjs
@bin/gate-a-grounding.test.cjs
@.planning/formal/evidence/instrumentation-map.json
@.planning/formal/evidence/event-vocabulary.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add --base-ref diff-scoped grounding to gate-a-grounding.cjs</name>
  <files>bin/gate-a-grounding.cjs</files>
  <action>
Add the following capabilities to gate-a-grounding.cjs:

1. Parse `--base-ref <sha>` from process.argv (similar to how --json is parsed). Extract the SHA value from the next argv element after --base-ref.

2. Add a `getChangedActions(baseRef)` function:
   - Use `require('child_process').execSync` to run `git diff --name-only <baseRef>..HEAD` from ROOT
   - Parse the output into a list of changed file paths
   - Load instrumentation-map.json from `.planning/formal/evidence/instrumentation-map.json`
   - Build a Set of action names whose `file` field matches any of the changed files (normalize paths — instrumentation-map uses relative paths like `hooks/nf-prompt.js`)
   - Return the Set of scoped actions (may be empty if no changed files have emission points)

3. Modify the CLI section (inside `if (require.main === module)`):
   - If --base-ref is provided, call `getChangedActions(baseRef)` to get scopedActions
   - Filter the conformanceEvents array to only events whose `action` is in scopedActions -> call this `scopedEvents`
   - Run `computeGateA(scopedEvents, ...)` for the scoped result
   - Also run `computeGateA(conformanceEvents, ...)` for the global result (unchanged)
   - The scoped result is the PRIMARY result: its `target_met` determines pass/fail, it gets written to gate-a-grounding.json
   - Add a `scope` object to the output JSON:
     ```
     scope: {
       mode: 'diff',
       base_ref: baseRef,
       changed_files: [...],    // files from git diff
       scoped_actions: [...],   // actions mapped from changed files
       global_score: globalResult.grounding_score,  // informational
       global_explained: globalResult.explained,
       global_total: globalResult.total
     }
     ```
   - If no --base-ref, add `scope: { mode: 'global' }` to maintain schema consistency
   - Update the human-readable summary output to show both scoped and global scores when --base-ref is used:
     ```
     Gate A Grounding Score (scoped): XX.X%
       Scope: N files changed, M actions scoped
       Target: >= 80% | Met: true/false
       ...
       Global (informational): YY.Y% (N/M explained)
     ```
   - Update the writeCheckResult call: when --base-ref is used, set property to include "(scoped)" and include base_ref in metadata

4. Handle edge cases:
   - If git diff fails (bad ref), write warning to stderr and fall back to global mode
   - If no changed files map to any instrumentation actions, warn to stderr ("No scoped actions found for changed files, falling back to global mode") and use global result
   - Export `getChangedActions` for testing

5. Update module.exports to include `getChangedActions`.
  </action>
  <verify>
    node bin/gate-a-grounding.cjs --json | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('scope:', r.scope.mode); process.exit(r.scope.mode === 'global' ? 0 : 1)"
    node bin/gate-a-grounding.cjs --base-ref HEAD~5 --json 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('scope:', r.scope.mode, 'actions:', r.scope.scoped_actions?.length); process.exit(r.scope.mode === 'diff' ? 0 : 1)"
  </verify>
  <done>
    - --base-ref flag accepted and parsed correctly
    - Scoped grounding score computed from actions of changed files only
    - Global score included as informational in scope object
    - No --base-ref produces identical behavior with scope.mode='global'
    - Edge cases (bad ref, no matching actions) handled gracefully with stderr warnings
  </done>
</task>

<task type="auto">
  <name>Task 2: Add tests for --base-ref scoping logic</name>
  <files>bin/gate-a-grounding.test.cjs</files>
  <action>
Add a new describe block 'diff-scoped grounding (--base-ref)' to gate-a-grounding.test.cjs with the following tests:

1. **getChangedActions returns correct action set**: Import `getChangedActions` from gate-a-grounding.cjs. This test can be a unit test that mocks the git/instrumentation-map behavior — but since we cannot easily mock execSync in node:test, instead test the `computeGateA` filtering behavior directly:
   - Create a conformance events array with 3 quorum_start events (from IDLE) and 2 circuit_break events (from IDLE)
   - Filter to only quorum_start events (simulating scoped filtering)
   - Call computeGateA on the filtered subset
   - Assert result.total === 3, result.explained === 3, grounding_score === 1.0

2. **scoped score independent from global**: Create 10 events: 8 quorum_start (explained) + 2 unknown_action (unexplained). Global score = 80%. Filter to only the 2 unknown_action events. Call computeGateA on that subset. Assert scoped score = 0.0 (none explained). This proves scoped and global scores are independent.

3. **empty scoped events produce 0 total**: Call computeGateA with empty array. Assert total === 0, grounding_score === 0, target_met === false.

4. **scope object schema (integration)**: Read gate-a-grounding.json from disk (produced by prior runs). Assert it has a `scope` field with at minimum `mode` property. This test validates the schema addition is present after the CLI runs.

5. **backward compatibility: no --base-ref produces scope.mode=global**: Run gate-a-grounding.cjs without --base-ref (use the existing integration tests as a model), read gate-a-grounding.json, assert scope.mode === 'global'.

Keep all existing tests unchanged. Run the full test file to confirm no regressions.
  </action>
  <verify>
    node --test bin/gate-a-grounding.test.cjs
  </verify>
  <done>
    - All new tests pass
    - All existing tests pass (no regressions)
    - Scoped filtering logic validated with synthetic data
    - Schema additions (scope object) validated
  </done>
</task>

</tasks>

<verification>
- `node bin/gate-a-grounding.cjs` (no flags) produces output identical in structure to before, with added scope.mode='global'
- `node bin/gate-a-grounding.cjs --base-ref HEAD~3 --json` produces scoped result with diff metadata
- `node --test bin/gate-a-grounding.test.cjs` — all tests pass
- No existing gate-a behavior broken (backward compatible)
</verification>

<success_criteria>
- --base-ref flag scopes grounding to actions from changed files using instrumentation-map.json
- Scoped score enforces 80% target independently
- Global score reported as informational when --base-ref is used
- All tests pass, no regressions
</success_criteria>

<output>
After completion, create `.planning/quick/206-add-base-ref-to-gate-a-grounding-cjs-for/206-SUMMARY.md`
</output>
