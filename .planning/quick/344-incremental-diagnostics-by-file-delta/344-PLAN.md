---
phase: quick-344
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [bin/nf-solve.cjs, bin/nf-solve.test.cjs, bin/solve-incremental-filter.cjs, bin/solve-incremental-filter.test.cjs, commands/nf/solve.md, commands/nf/solve-remediate.md]
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "nf-solve.cjs accepts --skip-layers flag and skips specified layer sweeps"
    - "solve-incremental-filter.cjs maps file paths to affected layer domains"
    - "solve.md Phase 3b uses incremental filtering when files_touched available"
    - "solve-remediate.md output includes files_touched array"
---

<objective>Track remediation file changes and skip unaffected layer sweeps in convergence diagnostics.</objective>
