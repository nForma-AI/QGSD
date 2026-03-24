---
task: 341
title: Cascade budget for remediation dispatch
status: complete
date: 2026-03-24
---

## Summary

Added cascade budget to prevent R→F cascade blowup in large projects. When F→T already has pending work and R→F residual > 10, the orchestrator caps R→F dispatches to `remaining_iterations * 10`.

## Changes

**commands/nf/solve.md:**
- Added Phase 3a-budget step between 3a-pre (inline dispatch) and 3a (Agent dispatch)
- Computes `r_to_f_limit` based on F→T pending work and remaining iterations
- Passes `cascade_budget: { r_to_f_limit: N }` to the Agent

**commands/nf/solve-remediate.md:**
- Input contract: added `cascade_budget` optional field
- Section 3a (R→F): truncates uncovered IDs list to budget limit before dispatching
- Backward compatible: missing/null budget = no limit

## Design Decisions

- Threshold: only activates when R→F > 10 AND F→T > 0 (small residuals don't cascade)
- Budget formula: `remaining_iterations * 10` gives each iteration room for 10 new formal models
- Deferred IDs processed in subsequent iterations as downstream clears
