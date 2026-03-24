---
phase: quick-342
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/solve-cycle-detector.cjs
  - bin/solve-cycle-detector.test.cjs
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "detectStateCycles detects period 2-4 cycles via state hashing"
    - "countBounces counts direction changes per layer"
    - "getBlockedLayers returns layers exceeding bounce threshold"
    - "Original A-B-A-B detectCycles preserved and still works"
    - "21 tests pass with 0 regressions in nf-solve.test.cjs"
---

<objective>
Extend solve-cycle-detector.cjs to detect N-layer cycles (depth 2-4) and per-layer bounce counting.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Extend cycle detector with state hashing and bounce counting</name>
  <files>bin/solve-cycle-detector.cjs, bin/solve-cycle-detector.test.cjs</files>
  <action>Add hashState, detectStateCycles, countBounces functions. Extend CycleDetector class.</action>
  <verify>node --test bin/solve-cycle-detector.test.cjs — 21 pass; node --test bin/nf-solve.test.cjs — 0 fail</verify>
  <done>N-layer cycle detection with state hashing, bounce counting, and auto-block threshold</done>
</task>
</tasks>
