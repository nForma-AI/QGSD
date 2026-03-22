---
created: 2026-03-22T15:32:54.418Z
title: Cascade budget for remediation dispatch
area: tooling
priority: medium
effort: medium
files:
  - commands/nf/solve-remediate.md
  - commands/nf/solve.md
---

## Problem

Fixing N requirements can cascade into M test stubs, K test failures, L doc updates, etc. In larger projects, fixing 50 R->F gaps could cascade into 200+ F->T stubs, blowing past max iterations. Residual swings wildly: 10 -> 50 -> 30 -> 20 -> 5 -> 0.

## Solution

Implement a cascade budget per iteration: if R->F residual > 10 and F->T already has pending work, limit R->F dispatches to `remaining_iterations x estimated_cascade_factor`. Don't create more downstream work than the loop can absorb in remaining iterations. Also prioritize high-formalizability requirements to minimize downstream stubs.
