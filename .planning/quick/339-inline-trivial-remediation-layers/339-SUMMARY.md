---
task: 339
title: Inline trivial remediation layers
status: complete
date: 2026-03-24
---

## Summary

Created `bin/solve-inline-dispatch.cjs` and wired it into the solve orchestrator to pre-run trivial remediation layers before the main Agent dispatch. This saves ~15-30s of Agent startup overhead per remediation iteration.

## Changes

**bin/solve-inline-dispatch.cjs** (new):
- Pre-runs hazard_model refresh (`hazard-model.cjs --json`)
- Formats d_to_c broken claims table (display-only, no Agent needed)
- Pre-runs l3_to_tc gate scripts (test-recipe-gen.cjs + gate-c-validation.cjs)
- Returns structured JSON with `inline_results`, `skip_layers`, `preflight_data`

**bin/solve-inline-dispatch.test.cjs** (new):
- 5 tests: d_to_c display, skip behaviors, integration with zero residual

**commands/nf/solve.md**:
- Added Phase 3a-pre step that calls solve-inline-dispatch.cjs before the Agent
- Forwards skip_layers and preflight_data to the Agent prompt

**commands/nf/solve-remediate.md**:
- Input contract: added skip_inline_layers and preflight_data optional fields
- Section 3g (D->C): skip check when in skip_inline_layers
- Section 3j (Hazard Model): skip check when in skip_inline_layers
- Section 3m (Gate C): preflight check for l3_to_tc_unvalidated

## Design Decisions

- Only d_to_c and hazard_model are fully inlined (no Agent needed)
- l1_to_l3, l3_to_tc, h_to_m still need Agents because they dispatch /nf:quick
- l3_to_tc gate scripts are pre-computed but the /nf:quick dispatch stays in the Agent
- All changes are backward compatible (missing fields default to no-op)
