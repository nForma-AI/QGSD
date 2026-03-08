---
phase: quick-225
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/run-formal-check.cjs
  - bin/run-formal-check.test.cjs
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "PRISM checks in run-formal-check.cjs delegate to run-prism.cjs instead of calling prism binary directly"
    - "PRISM invocations get properties file injection, scoreboard-based tp_rate/unavail, cold-start detection, and policy.yaml loading via run-prism.cjs"
    - "Test proves delegation by mocking/intercepting the spawnSync call to node bin/run-prism.cjs"
  artifacts:
    - path: "bin/run-formal-check.cjs"
      provides: "PRISM delegation to run-prism.cjs"
      contains: "run-prism.cjs"
    - path: "bin/run-formal-check.test.cjs"
      provides: "Test coverage for PRISM delegation"
      contains: "run-prism"
  key_links:
    - from: "bin/run-formal-check.cjs"
      to: "bin/run-prism.cjs"
      via: "spawnSync(process.execPath, [runPrismPath, ...])"
      pattern: "run-prism\\.cjs"
---

<objective>
Centralize PRISM invocation in run-formal-check.cjs by replacing the bare-bones inline spawnSync(prismBin, [checkDef.prismModel]) with delegation to run-prism.cjs.

Purpose: The current inline PRISM code (lines 241-274) is missing properties file injection, -const tp_rate/unavail injection from scoreboard, cold-start detection, and policy.yaml loading -- all features that run-prism.cjs provides. This creates a divergent code path where PRISM checks triggered via run-formal-check behave differently than direct run-prism.cjs invocations.

Output: Modified run-formal-check.cjs that delegates to run-prism.cjs for tool==='prism' checks, plus a new test file verifying the delegation.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/run-formal-check.cjs
@bin/run-prism.cjs
@bin/resolve-prism-bin.cjs
@bin/run-prism.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace inline PRISM spawnSync with delegation to run-prism.cjs</name>
  <files>bin/run-formal-check.cjs</files>
  <action>
Replace the `else if (tool === 'prism')` branch in the `runCheck()` function (lines 241-274) with delegation to `bin/run-prism.cjs` as a subprocess.

The new implementation should:

1. Remove the `require('./resolve-prism-bin.cjs')` call and direct `spawnSync(prismBin, ...)` invocation from the prism branch.

2. Instead, spawn `node bin/run-prism.cjs` with the appropriate `--model` flag derived from the check definition. The model name can be derived from `checkDef.prismModel` -- extract the basename without extension (e.g., `.planning/formal/prism/quorum.pm` becomes `quorum`). Use:
   ```js
   const modelName = path.basename(checkDef.prismModel, '.pm');
   const runPrismPath = path.join(__dirname, 'run-prism.cjs');
   const result = spawnSync(process.execPath, [runPrismPath, '--model', modelName], {
     cwd,
     stdio: 'pipe',
     encoding: 'utf8',
     timeout: 180000
   });
   ```

3. Interpret the exit code: 0 = pass, non-zero = fail. If `result.error` exists (e.g., spawn failure), mark as 'skipped' with the error message (fail-open, consistent with existing TLC/Alloy skip behavior for missing tools).

4. For the skip case when PRISM is not installed: run-prism.cjs itself exits with code 1 and writes "PRISM binary not found" to stderr. Detect this in the result.stderr to distinguish "prism not installed" (should be 'skipped') from "prism check failed" (should be 'fail'). Check if stderr contains 'binary not found' or 'PRISM_BIN' to mark as 'skipped' rather than 'fail'.

5. Keep the return shape identical: `{ module, tool: 'prism', status, detail, runtimeMs }`.

Do NOT change TLC or Alloy branches -- only the prism branch. Do NOT change the MODULE_CHECKS data structure (it still stores prismModel for reference/documentation, though the cmd field remains null).
  </action>
  <verify>
Run `node -c bin/run-formal-check.cjs` to confirm syntax is valid.
Run `grep -n 'run-prism.cjs' bin/run-formal-check.cjs` to confirm delegation pattern exists.
Run `grep -c 'resolvePrismBin' bin/run-formal-check.cjs` to confirm the direct prism binary resolution is removed from the prism branch (should be 0).
  </verify>
  <done>The prism branch in runCheck() delegates to run-prism.cjs via spawnSync(process.execPath, [runPrismPath, '--model', modelName]). No direct prism binary invocation remains. TLC and Alloy branches are unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Add test verifying run-formal-check delegates PRISM to run-prism.cjs</name>
  <files>bin/run-formal-check.test.cjs</files>
  <action>
Create `bin/run-formal-check.test.cjs` using node:test (same pattern as `bin/run-prism.test.cjs`).

Tests to include:

1. **"runCheck delegates prism checks to run-prism.cjs"**: Import `runCheck` and `MODULE_CHECKS` from run-formal-check.cjs. Call `runCheck('quorum', MODULE_CHECKS.quorum.find(c => c.tool === 'prism'), null, process.cwd())`. Since PRISM_BIN may not be set in the test environment, the expected behavior is either:
   - status='skipped' with detail containing 'not found' or 'PRISM_BIN' (when prism not installed), OR
   - status='pass' (when prism is installed)
   Assert that status is one of ['pass', 'skipped'] (never 'fail' for a delegation issue). Also assert the result has the correct shape: `{ module: 'quorum', tool: 'prism', status, detail, runtimeMs }`.

2. **"prism delegation spawns run-prism.cjs not prism binary directly"**: Use `spawnSync` to run `node bin/run-formal-check.cjs --modules=quorum` with `PRISM_BIN` unset (delete from env). Capture stderr. Assert stderr contains 'run-prism' OR 'PRISM' (proving it went through run-prism.cjs path, not an inline prism call). Also verify exit code is 0 (fail-open: prism skipped does not cause overall failure if TLC/Alloy pass or are also skipped).

3. **"runCheck returns correct shape for prism tool"**: Call runCheck for a prism check and verify all expected keys exist: module, tool, status, detail, runtimeMs. Verify runtimeMs is a number >= 0.

Use `'use strict'` at top. Use `require('node:test')` and `require('node:assert')`. Follow the pattern from run-prism.test.cjs.
  </action>
  <verify>
Run `node --test bin/run-formal-check.test.cjs` and confirm all tests pass.
Run `npm test -- --grep "run-formal-check"` as a secondary check.
  </verify>
  <done>bin/run-formal-check.test.cjs exists with 3 tests, all passing. Tests confirm PRISM checks are delegated through run-prism.cjs and return the correct result shape.</done>
</task>

</tasks>

<verification>
1. `node -c bin/run-formal-check.cjs` -- syntax valid
2. `grep 'run-prism.cjs' bin/run-formal-check.cjs` -- delegation reference present
3. `grep 'resolvePrismBin' bin/run-formal-check.cjs` -- should return 0 matches (removed)
4. `node --test bin/run-formal-check.test.cjs` -- all tests pass
5. `node bin/run-formal-check.cjs --modules=quorum` -- runs without crash (TLC/Alloy may skip if jars missing, PRISM skips if binary missing, but no errors from delegation code)
</verification>

<success_criteria>
- The prism branch in run-formal-check.cjs delegates to run-prism.cjs via subprocess spawn
- No direct prism binary invocation remains in run-formal-check.cjs
- All PRISM features (properties file, scoreboard injection, cold-start, policy.yaml) are inherited automatically through run-prism.cjs
- Test file exists and passes, confirming delegation behavior
- Existing TLC and Alloy check paths are unmodified
</success_criteria>

<output>
After completion, create `.planning/quick/225-centralize-prism-invocation-in-run-forma/225-SUMMARY.md`
</output>
