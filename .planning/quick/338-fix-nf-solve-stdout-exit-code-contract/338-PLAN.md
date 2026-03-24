---
phase: quick-338
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - bin/nf-solve.test.cjs
autonomous: true
formal_artifacts: none
requirements:
  - INTENT-01

must_haves:
  truths:
    - "nf-solve.cjs exits 0 on successful diagnostic even when residual > 0"
    - "JSON output includes has_residual boolean field"
    - "Existing behavior for non-JSON (report) mode is unchanged"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "Updated exit code logic and has_residual JSON field"
      contains: "has_residual"
    - path: "bin/nf-solve.test.cjs"
      provides: "Tests for exit-code contract and has_residual field"
      contains: "has_residual"
  key_links:
    - from: "bin/nf-solve.cjs"
      to: "formatJSON return object"
      via: "has_residual field added to JSON output"
      pattern: "has_residual"
    - from: "bin/nf-solve.cjs"
      to: "process.exit"
      via: "exit code always 0 on successful diagnostic"
      pattern: "exitCode.*=.*0"
---

<objective>
Fix the nf-solve.cjs exit-code contract so that a successful diagnostic always exits 0, regardless of residual magnitude. Add a `has_residual` boolean field to the JSON output so callers can programmatically detect whether residual remains without relying on exit codes.

Purpose: Enables clean piping of nf-solve JSON output to downstream consumers (observe, orchestrators) without false failure signals from non-zero exit codes.
Output: Updated bin/nf-solve.cjs with new exit-code behavior and has_residual field, plus tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/nf-solve.cjs
@bin/nf-solve.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Change exit code to 0 and add has_residual field</name>
  <files>bin/nf-solve.cjs</files>
  <action>
Two changes in bin/nf-solve.cjs:

1. In formatJSON() (around line 4671-4689), add `has_residual` boolean field to the returned object. Insert it after `converged`:
   ```
   has_residual: finalResidual.total > 0,
   ```
   This goes between the `converged` field (line 4677) and `residual_vector` (line 4678).

2. In the main exit logic (around line 5245), change:
   ```
   const exitCode = finalResidual.total > 0 ? 1 : 0;
   ```
   to:
   ```
   const exitCode = 0;
   ```
   A successful diagnostic always exits 0. The `has_residual` field in JSON output replaces the exit-code signal for residual detection.

Do NOT change anything else — stderr routing, JSON schema fields, report mode output, or session persistence are all correct as-is.
  </action>
  <verify>
Run: `grep -n 'has_residual' bin/nf-solve.cjs` — should show the field in formatJSON.
Run: `grep -n 'exitCode' bin/nf-solve.cjs` — should show `const exitCode = 0`.
  </verify>
  <done>formatJSON returns has_residual boolean; exit code is unconditionally 0 on successful diagnostic.</done>
</task>

<task type="auto">
  <name>Task 2: Add tests for exit-code contract and has_residual field</name>
  <files>bin/nf-solve.test.cjs</files>
  <action>
Add test cases to bin/nf-solve.test.cjs that verify the new contract:

1. **has_residual field test**: If formatJSON is not directly exported, test via the JSON output of a spawned nf-solve process. Spawn `node bin/nf-solve.cjs --json` in a temp directory with minimal .planning/formal/ fixtures. Parse stdout JSON and assert:
   - `has_residual` field exists and is a boolean
   - When residual.total > 0, `has_residual === true`

2. **Exit code contract test**: Spawn nf-solve.cjs with `--json` flag. Assert that the process exits with code 0 regardless of whether residual is present. Use `child_process.spawnSync` and check `result.status === 0`.

If nf-solve.test.cjs already has spawn-based integration tests, follow the same fixture pattern. If it uses unit-test style with mocked internals, add the has_residual assertion to the existing formatJSON test group.

Run: `node --test bin/nf-solve.test.cjs` to confirm all tests pass (both new and existing).
  </action>
  <verify>Run: `node --test bin/nf-solve.test.cjs` — all tests pass, 0 failures.</verify>
  <done>Tests verify has_residual field is present in JSON output and exit code is 0 on successful diagnostic.</done>
</task>

</tasks>

<verification>
- `grep 'has_residual' bin/nf-solve.cjs` returns match in formatJSON
- `grep 'const exitCode = 0' bin/nf-solve.cjs` confirms unconditional exit 0
- `node --test bin/nf-solve.test.cjs` passes with 0 failures
- `npm run test:ci` passes (no regressions)
</verification>

<success_criteria>
- nf-solve.cjs exits 0 on any successful diagnostic run (residual or not)
- JSON output contains `has_residual: true` when residual > 0, `has_residual: false` when residual === 0
- All existing and new tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/338-fix-nf-solve-stdout-exit-code-contract/338-SUMMARY.md`
</output>
