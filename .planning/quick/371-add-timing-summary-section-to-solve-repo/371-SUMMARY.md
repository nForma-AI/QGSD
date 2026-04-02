---
phase: quick-371
plan: 01
status: complete
---

# Quick Task 371: Add timing summary section to solve-report.md

## What Changed

Added a "Diagnostic Timing" section (Step 6.3) to the solve-report.md sub-skill that displays per-layer timing from the new `timing` object in nf-solve.cjs JSON output.

## Implementation

- **solve-report.md**: Added Step 6.3 between drift check (6.2) and convergence report (6.5). Displays total wall-clock, top 5 slowest layers, and skipped layer count.
- **solve.md**: Updated Phase 4 report agent context to forward `timing` data from post_residual.
- **Input contract**: Extended to accept optional `timing` field (fail-open for older solve runs).

## Files Modified

| File | Change |
|------|--------|
| commands/nf/solve-report.md | Added Step 6.3 timing summary display |
| commands/nf/solve.md | Forward timing to report agent |

## Commit

749472c8
