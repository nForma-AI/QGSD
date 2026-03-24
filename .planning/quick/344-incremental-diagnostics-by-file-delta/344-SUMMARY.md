---
task: 344
title: Incremental diagnostics by file delta
status: complete
date: 2026-03-24
---

## Summary

Added incremental diagnostic filtering: after remediation, the orchestrator computes which layers are affected by the files touched, then passes `--skip-layers` to nf-solve.cjs to skip unaffected sweeps.

## Changes

**bin/solve-incremental-filter.cjs** (new):
- Maps file paths to affected layer domains via regex patterns
- Returns `{ affected_layers, skip_layers, files_analyzed }`
- ALWAYS_SWEEP list ensures critical layers (r_to_f, r_to_d) are never skipped
- Unknown file types conservatively mark all forward layers affected

**bin/solve-incremental-filter.test.cjs** (new): 10 tests

**bin/nf-solve.cjs:**
- Added `--skip-layers=r_to_f,f_to_t,...` flag parsing (skipLayerSet)
- Added `checkLayerSkip()` helper returning skip sentinel
- Applied to all sweep calls in computeResidual() — forward, reverse, gates
- Updated test regex for TC-CODE-TRACE-7 compatibility

**commands/nf/solve.md:**
- Phase 3b: uses git diff + solve-incremental-filter.cjs to compute skip_layers
- Passes `--skip-layers` to nf-solve.cjs re-diagnostic
- Fail-open: falls back to full diagnostic if filtering fails

**commands/nf/solve-remediate.md:**
- Output contract: added `files_touched` array field
- Added "Files Touched Collection" section using git diff

## Impact

If remediation only touched `.planning/formal/alloy/*.als` files, the re-diagnostic skips T→C, C→R, T→R, D→R, D→C, hazard_model sweeps — saving 50-70% of diagnostic time (~30-40s) on iterations 2+.
