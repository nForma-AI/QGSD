---
task: 343
title: Parallelize diagnostic engine sweeps
status: complete
date: 2026-03-24
---

## Summary

Pre-spawns the most expensive sweep (F→C / run-formal-verify.cjs, ~30-40s) as a background child process at the start of `computeResidual()`, overlapping it with the R→F, F→T, C→F, and T→C sweeps. `sweepFtoC()` then waits for the background process instead of spawning a new synchronous one.

## Changes

**bin/nf-solve.cjs:**
- Added `_formalVerifyBgPid` module-level variable to track background process PID
- `computeResidual()`: pre-spawns `run-formal-verify.cjs` as async `child_process.spawn` before synchronous sweeps
- `sweepFtoC()`: polls for background PID completion (via `process.kill(pid, 0)`) instead of re-running the script; falls back to synchronous spawnTool if no background process

**bin/solve-parallel-sweeps.cjs** (new):
- Standalone script for future parallel sweep orchestration (currently used as reference; the actual parallelization is done inline in computeResidual)

## Design Decisions

- **Why not full async refactoring?** All 20+ sweep functions use `spawnSync` — converting to async would cascade through the entire 5383-line file. The background pre-spawn is a surgical change that gets ~60% of the benefit with ~5% of the risk.
- **Why only F→C?** It's the single most expensive sweep at ~30-40s. T→C (~20-30s) is harder to parallelize because its output (V8 coverage) is used immediately for crossReferenceFormalCoverage.
- **PID polling:** Uses `process.kill(pid, 0)` (signal 0 = existence check) with 500ms sleep intervals. Max wait of 10 minutes matches the sync spawnTool timeout.
- **Backward compatible:** If solve-parallel-sweeps.cjs or the background spawn fails, sweepFtoC falls back to synchronous behavior.

## Test Results

101 pass / 0 fail (no regressions in nf-solve.test.cjs)
