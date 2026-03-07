---
phase: quick-207
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/_implement-stubs.cjs
  - bin/nf-solve.cjs
  - bin/nf-solve.test.cjs
autonomous: true
requirements: [QUICK-207]
formal_artifacts: none

must_haves:
  truths:
    - "_implement-stubs.cjs behavioral strategy generates tests that import source modules and call exported functions, not just file-exists checks"
    - "autoClose() in nf-solve.cjs calls _implement-stubs.cjs after formal-test-sync generates stubs, upgrading TODO stubs to real tests"
    - "All existing tests pass after changes (npm test, node --test bin/nf-solve.test.cjs)"
  artifacts:
    - path: ".planning/formal/generated-stubs/_implement-stubs.cjs"
      provides: "Improved behavioral test generation using recipe import_hint and template_boilerplate"
      contains: "import_hint"
    - path: "bin/nf-solve.cjs"
      provides: "autoClose integration with _implement-stubs.cjs"
      contains: "_implement-stubs.cjs"
    - path: "bin/nf-solve.test.cjs"
      provides: "Test coverage for autoClose stub implementation dispatch"
      contains: "implement-stubs"
  key_links:
    - from: "bin/nf-solve.cjs"
      to: ".planning/formal/generated-stubs/_implement-stubs.cjs"
      via: "spawnTool() call in autoClose()"
      pattern: "_implement-stubs"
    - from: ".planning/formal/generated-stubs/_implement-stubs.cjs"
      to: "*.stub.recipe.json"
      via: "recipe.import_hint and recipe.template_boilerplate"
      pattern: "import_hint"
---

<objective>
Improve nf-solve's auto-remediation pipeline so that TODO test stubs are automatically upgraded to real test logic during the autoClose() phase, with particular focus on the behavioral test strategy which currently generates only file-exists checks instead of proper import-and-call tests.

Purpose: The current _implement-stubs.cjs behavioral strategy ignores the recipe's import_hint and template_boilerplate fields, producing tests that merely check file existence — identical to structural tests. This leaves the F->T gap effectively unclosed for behavioral requirements. Additionally, autoClose() in nf-solve.cjs never calls _implement-stubs.cjs, so even structural/constant stub upgrades are not triggered during the solve loop.

Output: Updated _implement-stubs.cjs with proper behavioral test generation, autoClose() integration, and test coverage.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/nf-solve.cjs
@bin/nf-solve.test.cjs
@.planning/formal/generated-stubs/_implement-stubs.cjs
@.planning/formal/generated-stubs/ANNOT-04.stub.recipe.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Upgrade _implement-stubs.cjs behavioral strategy to use recipe import_hint and template_boilerplate</name>
  <files>.planning/formal/generated-stubs/_implement-stubs.cjs</files>
  <action>
  Rewrite the behavioral branch (lines 117-155) in _implement-stubs.cjs to generate proper import-and-call tests using recipe metadata:

  1. Read `recipe.import_hint` — this contains a ready-to-use require() statement like `const mod = require('/abs/path/to/source.cjs');`
  2. Read `recipe.template_boilerplate` — this contains a test template like `const mod = require(SOURCE);\nconst result = mod.FUNCTION(INPUT);\nassert.strictEqual(result, EXPECTED);`
  3. Read `recipe.template` — this indicates the test shape (e.g., "import-and-call")

  For the behavioral strategy, generate test code that:
  a. Uses the import_hint to require the source module (wrapped in try/catch for fail-open if module has side effects)
  b. Asserts the module exports the expected function/property based on `recipe.formal_property.name`
  c. If `recipe.template === 'import-and-call'` AND `recipe.template_boilerplate` is non-empty, use the boilerplate as a starting template (replace SOURCE with the actual path from import_hint)
  d. Falls back to structural checks (file exists + non-empty) ONLY when import_hint is missing or empty

  Keep the existing structural and constant strategies unchanged. Keep the "already implemented" skip logic (line 19: skip if no `assert.fail('TODO')`) so re-runs are idempotent.

  Also add a `--dry-run` flag that prints what would be changed without writing files, for debugging.

  IMPORTANT: The generated behavioral tests must still use `node:test` and `node:assert/strict`. Wrap the require() in a try/catch — some modules (like nForma.cjs) launch TUI on import, so use source-grep fallback if require fails (per NAV-04 pattern from STATE.md decisions).
  </action>
  <verify>
  Run: `node .planning/formal/generated-stubs/_implement-stubs.cjs --dry-run 2>&1 | head -20`
  Confirm it does not crash and reports behavioral stubs it would upgrade.
  Also verify idempotency: running without --dry-run then running again should report "Skipped: N" for already-implemented stubs.
  </verify>
  <done>
  _implement-stubs.cjs behavioral strategy generates tests using recipe.import_hint and recipe.template_boilerplate instead of file-exists checks. Dry-run mode works. Existing structural/constant strategies are unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire _implement-stubs.cjs into autoClose() and add test coverage</name>
  <files>bin/nf-solve.cjs, bin/nf-solve.test.cjs</files>
  <action>
  Part A — Wire into autoClose() in bin/nf-solve.cjs:

  In the autoClose() function (around line 2322), after the existing F->T stub generation block (lines 2326-2341), add a second step that runs _implement-stubs.cjs to upgrade any remaining TODO stubs to real test logic:

  ```javascript
  // F->T stubs upgrade: implement TODO stubs with real test logic
  if (residual.f_to_t.residual > 0) {
    const implResult = spawnTool(
      path.join(ROOT, '.planning/formal/generated-stubs/_implement-stubs.cjs'),
      [],
      { timeout: 60000 }
    );
    if (implResult.ok) {
      actions.push('Upgraded TODO stubs via _implement-stubs.cjs: ' + implResult.stdout.trim());
    }
  }
  ```

  NOTE: spawnTool() resolves relative to SCRIPT_DIR (bin/), but _implement-stubs.cjs lives in .planning/formal/generated-stubs/. Use an absolute path via `path.join(ROOT, '.planning/formal/generated-stubs/_implement-stubs.cjs')` and spawn it directly with spawnSync instead of spawnTool (which prepends SCRIPT_DIR). Create a small helper or inline the spawnSync call:

  ```javascript
  const implPath = path.join(ROOT, '.planning/formal/generated-stubs/_implement-stubs.cjs');
  if (fs.existsSync(implPath)) {
    const implResult = spawnSync(process.execPath, [implPath], {
      encoding: 'utf8', cwd: ROOT, timeout: 60000, stdio: 'pipe'
    });
    if (implResult.status === 0) {
      actions.push('Upgraded TODO stubs: ' + (implResult.stdout || '').trim());
    }
  }
  ```

  Part B — Add test coverage in bin/nf-solve.test.cjs:

  Add a test `TC-AUTOCLOSE-STUBS-1` that verifies autoClose() includes the _implement-stubs.cjs dispatch in its actions when f_to_t residual is > 0. This can be a unit test that calls autoClose() with a mock residual and checks the actions array contains a string referencing stub upgrade (or a message about _implement-stubs).

  Since autoClose() calls external scripts via spawnSync, the integration test should just verify the function shape — checking that the returned object has `actions_taken` array and `stubs_generated` number. The actual _implement-stubs.cjs behavior is tested by running it directly in Task 1's verify step.

  Also export `autoClose` from the module.exports if not already exported (check line ~3024).
  </action>
  <verify>
  1. `node --test bin/nf-solve.test.cjs` — all existing tests pass plus new TC-AUTOCLOSE-STUBS-1
  2. `grep '_implement-stubs' bin/nf-solve.cjs` — confirms wiring exists
  3. `node bin/nf-solve.cjs --json --report-only | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('ok:', typeof j.converged)"` — full script still runs without crash
  </verify>
  <done>
  autoClose() in nf-solve.cjs calls _implement-stubs.cjs after formal-test-sync generates stubs. New test TC-AUTOCLOSE-STUBS-1 passes. All existing tests continue to pass.
  </done>
</task>

</tasks>

<verification>
1. `node .planning/formal/generated-stubs/_implement-stubs.cjs --dry-run` runs without error
2. `node --test bin/nf-solve.test.cjs` passes all tests including new ones
3. `node bin/nf-solve.cjs --json --report-only` produces valid JSON output
4. `grep 'import_hint' .planning/formal/generated-stubs/_implement-stubs.cjs` confirms behavioral strategy reads recipe hints
5. `grep '_implement-stubs' bin/nf-solve.cjs` confirms autoClose wiring
</verification>

<success_criteria>
- _implement-stubs.cjs behavioral strategy uses recipe.import_hint and template_boilerplate to generate proper import-and-call tests
- autoClose() dispatches _implement-stubs.cjs after formal-test-sync stub generation
- All existing tests pass (no regressions)
- New test TC-AUTOCLOSE-STUBS-1 validates the autoClose integration
</success_criteria>

<output>
After completion, create `.planning/quick/207-improve-nf-solve-to-auto-remediate-todo-/207-SUMMARY.md`
</output>
