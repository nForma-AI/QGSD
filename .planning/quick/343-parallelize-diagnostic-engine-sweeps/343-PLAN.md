---
phase: quick-343
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - bin/solve-parallel-sweeps.cjs
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "F→C (run-formal-verify.cjs) is pre-spawned as background process before other sweeps"
    - "sweepFtoC() waits for background process instead of re-running synchronously"
    - "Falls back to synchronous behavior when background spawn fails"
    - "All 101 existing tests pass with 0 regressions"
---

<objective>Parallelize the most expensive diagnostic sweep (F→C) by pre-spawning it as a background process.</objective>

<tasks>
<task type="auto">
  <name>Task 1: Background pre-spawn F→C in computeResidual</name>
  <files>bin/nf-solve.cjs, bin/solve-parallel-sweeps.cjs</files>
  <action>Pre-spawn run-formal-verify.cjs async, modify sweepFtoC to wait for it</action>
  <verify>node --test bin/nf-solve.test.cjs — 101 pass, 0 fail</verify>
  <done>F→C runs in parallel with other sweeps, saving ~20-30s per diagnostic</done>
</task>
</tasks>
