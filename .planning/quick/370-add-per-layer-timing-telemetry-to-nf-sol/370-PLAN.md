---
phase: quick-370
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "Each sweep call in computeResidual() is timed with Date.now() deltas"
    - "formatJSON() output includes a timing object with per-layer duration_ms and skipped flag"
    - "formatJSON() output includes total_diagnostic_ms summing all layer durations"
    - "Existing residual_vector and convergence behavior are unchanged"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "Per-layer timing telemetry in computeResidual() and formatJSON()"
      contains: "total_diagnostic_ms"
  key_links:
    - from: "computeResidual() timing collection"
      to: "formatJSON() timing output"
      via: "timing object returned from computeResidual, consumed by formatJSON"
      pattern: "timing"
---

<objective>
Add per-layer timing telemetry to nf-solve.cjs so every sweep call in computeResidual() reports its wall-clock duration, and the JSON output includes a `timing` object alongside `residual_vector`.

Purpose: Enable diagnosing which sweeps are slow, supporting performance optimization and deadline tuning.
Output: Modified bin/nf-solve.cjs with timing instrumentation and JSON output.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/nf-solve.cjs (lines 3900-4120 for computeResidual, lines 5167-5223 for formatJSON)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Instrument computeResidual() with per-layer timing and emit timing in formatJSON()</name>
  <files>bin/nf-solve.cjs</files>
  <action>
In `computeResidual()` (around line 3916):

1. Add a `const _diagStart = Date.now();` at the very start of computeResidual(), before the F->C background spawn block.

2. Create a `const _timing = {};` object to accumulate per-layer timings.

3. For EVERY sweep assignment (r_to_f, f_to_t, c_to_f, t_to_c, f_to_c, r_to_d, d_to_c, p_to_f, c_to_r, t_to_r, d_to_r, l1_to_l3, l3_to_tc, per_model_gates, git_heatmap, git_history, formal_lint, hazard_model, h_to_m, b_to_f, req_quality, config_health, security, trace_health, asset_stale, arch_constraints, debt_health, memory_health), wrap the assignment with timing:

Pattern for each layer (example for r_to_f on line 3944):
```javascript
const _t_r_to_f = Date.now();
const r_to_f = checkLayerSkip('r_to_f') || (pastDeadline() ? deadlineSkip() : sweepRtoF());
_timing.r_to_f = { duration_ms: Date.now() - _t_r_to_f, skipped: !!(r_to_f.detail && r_to_f.detail.skipped) };
```

Use the SAME pattern for every layer. The variable name follows `_t_{layer_key}`. The skipped flag reads from the result's `detail.skipped` boolean.

For layers with compound skip logic (like t_to_c which has fastMode/skipTests checks), the timing still wraps the entire assignment including the skip check -- no special handling needed since we want to know whether it was skipped AND how long even the skip took.

4. After all sweeps, compute total: `const _totalDiagMs = Date.now() - _diagStart;`

5. Add `timing: _timing` and `total_diagnostic_ms: _totalDiagMs` to the return object of computeResidual() (around line 4079-4118), alongside the existing fields.

6. In `formatJSON()` (line 5167), extract timing from finalResidual and add it to the returned JSON object:
```javascript
// Per-layer timing telemetry
const timing = finalResidual.timing || {};
timing.total_diagnostic_ms = finalResidual.total_diagnostic_ms || 0;
```
Add `timing: timing` to the return object (around line 5203-5222), after `oscillation`.

IMPORTANT CONSTRAINTS:
- Do NOT modify any sweep function implementations -- only wrap their calls with Date.now() deltas.
- Do NOT change the existing residual calculation logic or return values -- timing is purely additive.
- Do NOT add timing to the `truncatedResidual` or modify `truncateResidualDetail()`.
- The `rebuildCodeTraceIndex()` call (line 3964) should also be timed: add a `code_trace_rebuild` entry to _timing.
- The `crossReferenceFormalCoverage` call (line 3952) and `compute-semantic-scores.cjs` spawn (line 4003) should NOT be timed -- they are post-processing, not sweeps.
- Formal invariant: EventualConvergence is unaffected since timing is observational only (no change to residual values or convergence checks).
  </action>
  <verify>
1. `node bin/nf-solve.cjs --report-only --json --max-iterations=1 2>/dev/null | node -p "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const t=d.timing; console.log('has_timing:', !!t); console.log('has_total:', typeof t.total_diagnostic_ms === 'number'); console.log('layer_count:', Object.keys(t).filter(k=>k!=='total_diagnostic_ms').length); console.log('sample_r_to_f:', JSON.stringify(t.r_to_f))"` -- should show has_timing: true, has_total: true, layer_count >= 28, and sample with duration_ms and skipped fields.
2. `node bin/nf-solve.cjs --report-only --json --max-iterations=1 2>/dev/null | node -p "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('residual_vector_present:', !!d.residual_vector); console.log('converged_present:', typeof d.converged === 'boolean')"` -- residual_vector and converged still present.
3. `npm run test:ci` passes (no regressions).
  </verify>
  <done>
- Every sweep call in computeResidual() is wrapped with Date.now() timing
- formatJSON() output contains a `timing` object with `{ layer_key: { duration_ms, skipped } }` for all layers plus `total_diagnostic_ms`
- Existing residual_vector, convergence logic, and all other JSON fields are unchanged
- Test suite passes
  </done>
</task>

</tasks>

<verification>
- JSON output includes `timing` key with per-layer entries and `total_diagnostic_ms`
- Each timing entry has `duration_ms` (number) and `skipped` (boolean)
- Residual values and convergence behavior are identical to pre-change
- No sweep implementation was modified
</verification>

<success_criteria>
Running `node bin/nf-solve.cjs --report-only --json` produces JSON with a `timing` object containing duration_ms and skipped for every layer, plus total_diagnostic_ms. All existing tests pass.
</success_criteria>

<output>
After completion, create `.planning/quick/370-add-per-layer-timing-telemetry-to-nf-sol/370-SUMMARY.md`
</output>
