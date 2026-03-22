---
created: 2026-03-22T15:32:54.418Z
title: N-layer cycle detection
area: tooling
priority: medium
effort: medium
files:
  - bin/solve-cycle-detector.cjs
---

## Problem

Current oscillation detection only catches A-B-A-B (2-point oscillation). Misses A-B-C-A-B-C (3-layer circular dependency) and A-B-A (same layer bouncing with different values). These patterns can stall convergence without being detected.

## Solution

Use a sliding window with cycle detection on the full residual state vector: hash the full residual state per iteration, then check if stateHash[i] === stateHash[i-K] for any K in [2, 3, 4]. This catches any periodic pattern, not just 2-point oscillation. Also implement "bounce count" per layer and auto-block after 2 bounces per iteration.
