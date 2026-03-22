---
created: 2026-03-22T15:32:54.418Z
title: Parallelize diagnostic engine sweeps
area: tooling
priority: high
effort: medium
files:
  - bin/nf-solve.cjs
---

## Problem

nf-solve.cjs runs 18 sweeps sequentially. The dependency graph is sparse — clusters A-E (R->F, R->D, F->T, C->F, T->C, F->C, reverse) are independent. Running them sequentially means ~90s diagnostic time bounded by the sum of all sweeps.

## Solution

Group independent sweeps into clusters and run them with `Promise.all`. Clusters A-E are independent; only gates/signals (Cluster F) depend on A-D. Expected reduction: ~90s -> ~40-50s (bounded by slowest: F->C at ~40s). Savings: ~40-50s per diagnostic x (iterations + 1) = 2-4 minutes per solve.
