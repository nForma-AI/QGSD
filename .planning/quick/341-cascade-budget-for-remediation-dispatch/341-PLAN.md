---
phase: quick-341
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/solve.md
  - commands/nf/solve-remediate.md
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "Orchestrator computes r_to_f_limit when F->T has pending work and R->F > 10"
    - "Remediation Agent truncates R->F dispatch list to cascade budget limit"
    - "Budget formula: remaining_iterations * 10"
    - "Null limit means no cap (backward compatible)"
---

<objective>
Add cascade budget to prevent R->F cascade blowup in large projects.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Add cascade budget to solve.md and solve-remediate.md</name>
  <files>commands/nf/solve.md, commands/nf/solve-remediate.md</files>
  <action>Add 3a-budget step to solve.md, cascade_budget to input contract, limit check to 3a R->F section.</action>
  <verify>grep 'cascade_budget' in both files returns matches</verify>
  <done>Cascade budget computed in orchestrator, respected in remediation Agent</done>
</task>
</tasks>
