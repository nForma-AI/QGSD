---
phase: quick-340
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/solve.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-340]
must_haves:
  truths:
    - "Classification is skipped when verboseMode is false"
    - "Classification is skipped when --fast flag is passed"
    - "Classification is skipped when forward residual <= 3"
    - "Classification is skipped when cache hit ratio >= 80%"
    - "Skip reason is logged so user knows why classification was omitted"
  artifacts:
    - path: "commands/nf/solve.md"
      provides: "Conditional classification with 4 skip conditions"
      contains: "Skip conditions"
---

<objective>
Add skip conditions to Phase 1c (Classify) in solve.md so classification is only dispatched when it adds value. Saves ~80s per solve session when classification is redundant.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Add conditional skip logic to Phase 1c in solve.md</name>
  <files>commands/nf/solve.md</files>
  <action>Add 4 skip conditions to Phase 1c, parse --fast flag, add cache ratio check.</action>
  <verify>grep 'Skip conditions' commands/nf/solve.md returns 1; grep 'fastMode' returns >= 1</verify>
  <done>Phase 1c has 4 skip conditions: !verbose, --fast, residual<=3, cache>=80%</done>
</task>
</tasks>
