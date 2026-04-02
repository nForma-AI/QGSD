---
phase: quick-370
plan: 01
status: complete
---

# Quick Task 370: Add per-layer timing telemetry to nf-solve.cjs

## What Changed

Added per-layer timing instrumentation to `computeResidual()` in `bin/nf-solve.cjs`. Every sweep call is now wrapped with `Date.now()` deltas, and the JSON output includes a `timing` object alongside `residual_vector`.

## Implementation

- **29 layer entries** timed: all forward sweeps (r_to_f, f_to_t, c_to_f, t_to_c, f_to_c, r_to_d, d_to_c, p_to_f), reverse sweeps (c_to_r, t_to_r, d_to_r), alignment (l1_to_l3, l3_to_tc), informational (per_model_gates, git_heatmap, git_history, formal_lint, hazard_model, h_to_m, b_to_f, req_quality, config_health, security, trace_health, asset_stale, arch_constraints, debt_health, memory_health), plus `code_trace_rebuild`
- Each entry: `{ duration_ms: N, skipped: bool }`
- `total_diagnostic_ms` captures full sweep wall-clock time
- Timing emitted in `formatJSON()` output under the `timing` key

## Verification

- `node bin/nf-solve.cjs --report-only --json --fast` produces timing with 29 layer entries
- `total_diagnostic_ms` correctly reports ~2.8s for fast-mode diagnostic
- `residual_vector` and `converged` fields unchanged
- All existing tests pass (0 failures)

## Files Modified

| File | Change |
|------|--------|
| bin/nf-solve.cjs | Added timing instrumentation to computeResidual() and formatJSON() |
| bin/nf-solve.test.cjs | Updated TC-CODE-TRACE-7 regex for deadline guard pattern (from prior commit) |

## Commit

286ad404
