---
task: 342
title: N-layer cycle detection
status: complete
date: 2026-03-24
---

## Summary

Extended solve-cycle-detector.cjs with N-layer cycle detection (depth 2-4) via state hashing, per-layer bounce counting, and auto-block threshold.

## Changes

**bin/solve-cycle-detector.cjs:**
- `hashState()`: SHA-256 hash of sorted residual state vector for deterministic comparison
- `detectStateCycles()`: checks stateHash[i] === stateHash[i-K] for K in [2,3,4], with double-period verification when history is deep enough
- `countBounces()`: counts direction changes (up→down, down→up) per layer
- `CycleDetector.detectStateCycle()`: new method for N-cycle detection
- `CycleDetector.getBlockedLayers()`: returns layers exceeding bounce threshold (default: 2)
- `CycleDetector.stateHashes`: records per-iteration state hashes
- All original A-B-A-B detection preserved (backward compatible)

**bin/solve-cycle-detector.test.cjs** (new):
- 21 tests covering all functions and CycleDetector class integration

## Design Decisions

- State hashing uses SHA-256 with sorted keys for deterministic comparison across iterations
- Period detection checks K=2,3,4 (covers A-B, A-B-C, A-B-C-D cycles)
- Double-period verification (stateHash[i-K] === stateHash[i-2K]) reduces false positives
- Bounce threshold of 2 is conservative — a layer must change direction twice before auto-blocking
- Flat segments (no direction change) are explicitly excluded from bounce counting
