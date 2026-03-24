---
phase: quick-346
plan: 01
type: execute
wave: 1
depends_on: [345]
files_modified: [bin/solve-session.cjs, commands/nf/solve.md]
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "appendIteration() persists iteration state to solve-session.json after each convergence check"
    - "getResumePoint() returns resume_iteration and last_residual from in_progress sessions"
    - "--resume flag skips completed iterations and continues from saved state"
    - "Phase 3d writes iteration state after debt resolution (fail-open)"
---
<objective>Enable crash recovery via persistent solve state and --resume flag.</objective>
