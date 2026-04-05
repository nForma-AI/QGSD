---
phase: quick-379
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/check-model-staleness.cjs
  - bin/check-model-staleness.test.cjs
  - bin/nf-solve.cjs
  - commands/nf/solve-report.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "SHA-256 content hashes are computed for each model file in model-registry.json"
    - "Source files referenced in model header comments are parsed and hashed"
    - "MODEL_STALE residuals are detected when model or source hashes differ from stored values"
    - "Staleness appears as an informational signal in the solve-report table"
    - "Entries without stored hashes degrade gracefully (skip, no error)"
    - "First run populates hashes without flagging anything stale"
  artifacts:
    - path: "bin/check-model-staleness.cjs"
      provides: "Standalone staleness detection script"
      exports: ["checkStaleness"]
    - path: "bin/check-model-staleness.test.cjs"
      provides: "Unit tests for staleness detection"
      min_lines: 40
  key_links:
    - from: "bin/nf-solve.cjs"
      to: "bin/check-model-staleness.cjs"
      via: "spawnTool() in sweepModelStaleness"
      pattern: "check-model-staleness"
    - from: "commands/nf/solve-report.md"
      to: "model_stale"
      via: "informational signal row in report table"
      pattern: "Model.Stale|model_stale"
---

<objective>
Add formal model staleness detection via SHA-256 content hashing. Compute hashes of model files and their declared source files (parsed from `-- Source:` / `* Source:` header comments), store hashes in model-registry.json, detect MODEL_STALE residuals during the nf-solve diagnostic sweep, and surface staleness in the solve report as an informational signal.

Purpose: Enable early detection of formal models that have drifted from their source code, preventing false confidence in verification results from stale specs.
Output: `bin/check-model-staleness.cjs` script, `sweepModelStaleness()` in nf-solve.cjs, solve-report table row.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/formal/model-registry.json (first 80 lines -- schema reference)
@bin/nf-solve.cjs (sweepFormalLint pattern ~line 3401, computeResidual ~line 4021, informational bucket ~line 4246, exports ~line 6080)
@commands/nf/solve-report.md (informational signals table ~line 81)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/check-model-staleness.cjs with tests</name>
  <files>bin/check-model-staleness.cjs, bin/check-model-staleness.test.cjs</files>
  <action>
Create `bin/check-model-staleness.cjs` (CommonJS, 'use strict') that:

1. **Reads model-registry.json** from `.planning/formal/model-registry.json`. If missing, exit 0 with `{ stale: [], total: 0, skipped: true }`.

2. **For each model entry** in `registry.models`:
   - Compute SHA-256 of the model file content. If file missing, skip (graceful degradation).
   - Parse the model file's first 10 lines for a `-- Source:` or `* Source:` comment line. Extract comma-separated source file paths (trim whitespace). Source paths are relative to project root.
   - Compute SHA-256 of each source file that exists. Skip non-existent source files silently.
   - Build a hash record: `{ model_hash: string, source_hashes: { [path]: string } }`.

3. **Compare against stored hashes** in the registry entry's `content_hashes` field (if present):
   - If `content_hashes` is absent (first run or legacy entry): compute and store hashes, mark as `"first_hash"` (not stale).
   - If `content_hashes.model_hash` differs from computed: mark as stale, reason `"model_changed"`.
   - If any source file hash differs: mark as stale, reason `"source_changed"`, list changed files.

4. **Update model-registry.json** in place with new `content_hashes` field on each entry. Only write if any hashes changed (avoid unnecessary git noise). Use atomic write pattern (write to tmp then rename).

5. **Output JSON to stdout** when `--json` flag is present:
   ```json
   {
     "stale": [{ "model": "path", "reason": "model_changed|source_changed", "changed_sources": [] }],
     "total_checked": N,
     "total_stale": N,
     "first_hash_count": N
   }
   ```

6. **CLI flags**: `--json` (JSON output), `--project-root=PATH` (override root), `--dry-run` (compute but do not update registry).

Use `crypto.createHash('sha256')` from Node built-ins. Follow fail-open pattern: wrap everything in try/catch, exit 0 on unexpected errors. Use `process.stderr.write` for diagnostics, never stdout (stdout is the data channel).

Export `checkStaleness(root)` for programmatic use (returns the same object as JSON output).

For the **test file** `bin/check-model-staleness.test.cjs`:
- Test that missing registry returns skipped result
- Test hash computation for a mock model file with `-- Source:` header
- Test that first run (no `content_hashes`) returns `first_hash_count > 0` and zero stale
- Test that changed model content is detected as stale
- Test that changed source content is detected as stale
- Test graceful degradation when source file is missing
- Use `node:test` and `node:assert`, create temp directories with `fs.mkdtempSync`
  </action>
  <verify>
Run: `node --test bin/check-model-staleness.test.cjs` -- all tests pass.
Run: `node bin/check-model-staleness.cjs --json --dry-run` -- exits 0, produces valid JSON with `total_checked > 0`.
  </verify>
  <done>
`bin/check-model-staleness.cjs` computes SHA-256 hashes for model files and their source dependencies, detects staleness by comparing against stored hashes, and degrades gracefully for entries without hashes. Test suite passes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire sweepModelStaleness into nf-solve.cjs diagnostic sweep</name>
  <files>bin/nf-solve.cjs</files>
  <action>
Add `sweepModelStaleness()` function to `bin/nf-solve.cjs`, following the exact pattern of `sweepFormalLint()` (~line 3401) and `sweepAssetStaleness()` (~line 3753):

```javascript
// -- Model Staleness sweep (informational) --------------------------------
function sweepModelStaleness() {
  if (fastMode) {
    return { residual: -1, detail: { skipped: true, reason: 'fast mode' } };
  }
  try {
    const scriptPath = path.join(ROOT, 'bin', 'check-model-staleness.cjs');
    if (!fs.existsSync(scriptPath)) {
      return { residual: -1, detail: { skipped: true, reason: 'check-model-staleness.cjs not found' } };
    }
    const result = spawnTool('bin/check-model-staleness.cjs', ['--json']);
    if (!result.stdout) {
      return { residual: -1, detail: { error: true, stderr: (result.stderr || '').slice(0, 500) } };
    }
    const data = JSON.parse(result.stdout);
    if (data.skipped) {
      return { residual: -1, detail: { skipped: true, reason: 'no model-registry.json' } };
    }
    return {
      residual: data.total_stale,
      kind: 'informational',
      detail: {
        total_checked: data.total_checked,
        total_stale: data.total_stale,
        first_hash_count: data.first_hash_count,
        stale: (data.stale || []).slice(0, 20).map(s => ({ model: s.model, reason: s.reason })),
      },
    };
  } catch (err) {
    return { residual: -1, detail: { error: err.message } };
  }
}
```

Place it after `sweepMemoryHealth` (around line 3845) to keep informational sweeps grouped.

In `computeResidual()`:
1. Add timing + invocation after `memory_health` (~line 4225):
   ```javascript
   const _t_model_stale = Date.now();
   const model_stale = checkLayerSkip('model_stale') || sweepModelStaleness();
   _timing.model_stale = { duration_ms: Date.now() - _t_model_stale, skipped: !!(model_stale.detail && model_stale.detail.skipped) };
   ```

2. Add `model_stale` to the `informational` bucket sum (~line 4260):
   ```javascript
   (model_stale.residual >= 0 ? model_stale.residual : 0) +
   ```

3. Add `model_stale` to the return object (~line 4290, after `memory_health`).

4. Add `sweepModelStaleness` to the module.exports object (after `sweepBtoF` in the exports block ~line 6108).

Do NOT add model_stale to `automatable` or `manual` buckets -- it is purely informational. Do NOT modify autoClose() -- staleness is a signal, not an auto-fixable gap.
  </action>
  <verify>
Run: `grep 'sweepModelStaleness' bin/nf-solve.cjs` -- returns matches for function def, invocation in computeResidual, addition to informational sum, return object, and exports.
Run: `grep 'model_stale' bin/nf-solve.cjs` -- returns matches in computeResidual timing, informational bucket, and return object.
Run: `node bin/nf-solve.cjs --json --report-only --fast --project-root=$(pwd) 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('model_stale' in d ? 'FOUND' : 'MISSING')"` -- prints FOUND (even if skipped in fast mode, the key exists).
  </verify>
  <done>
`sweepModelStaleness()` is wired into the nf-solve diagnostic sweep as an informational signal. It appears in the residual output, timing telemetry, and module exports. It does not affect the automatable or manual residual totals.
  </done>
</task>

<task type="auto">
  <name>Task 3: Surface MODEL_STALE in solve-report informational signals table</name>
  <files>commands/nf/solve-report.md</files>
  <action>
In `commands/nf/solve-report.md`, add a `Model Stale` row to the informational signals table (Step 6, ~line 88, after the `H -> M` row and before `Signal count`):

```
Model Stale (drift)          {N}    {M}    {delta}   [signal]
```

Also add expansion guidance after the existing informational detail sections (~line 103 area). Add this pattern for non-zero model_stale:

```
- **Model Stale**: List each stale model path with reason (model_changed or source_changed). If first_hash_count > 0, note "N models hashed for first time (baseline established)".
```

Example expansion:
```
Model Stale Detail:
  ! .planning/formal/alloy/autoclose-signals.als -- source_changed (bin/nf-solve.cjs)
  i 12 models hashed for first time (baseline)
```

Also add `model_stale` to the list of diagnostic health sweeps mentioned in the informational section description near line 81, so solve-report readers know to include it in their rendering loop. The key in the residual object is `model_stale`.
  </action>
  <verify>
Run: `grep -c 'Model.Stale\|model_stale' commands/nf/solve-report.md` -- returns at least 3 (table row, expansion, key reference).
  </verify>
  <done>
MODEL_STALE appears in the solve-report informational signals table with expansion guidance for non-zero residuals. The report template references `model_stale` as the residual object key.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/check-model-staleness.test.cjs` passes all tests
2. `node bin/check-model-staleness.cjs --json --dry-run` produces valid JSON
3. `grep 'sweepModelStaleness' bin/nf-solve.cjs` shows function, invocation, informational sum, return, exports
4. `grep 'model_stale' commands/nf/solve-report.md` shows table row and expansion
5. No existing tests break: `node --test bin/nf-solve.test.cjs` passes
</verification>

<success_criteria>
- SHA-256 content hashes are computed for model files and their Source-declared dependencies
- Staleness is detected when hashes diverge from stored values in model-registry.json
- Entries without content_hashes degrade gracefully (first-run populates, no false stale)
- MODEL_STALE is an informational signal in nf-solve (not automatable, not manual)
- Solve-report renders the staleness row with detail expansion for non-zero counts
- All tests pass, no regressions
</success_criteria>

<output>
After completion, create `.planning/quick/379-issue-46-add-formal-model-staleness-dete/379-SUMMARY.md`
</output>
