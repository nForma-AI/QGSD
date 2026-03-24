---
phase: quick-345
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [commands/nf/solve.md, bin/solve-session.cjs]
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "--plan-only runs diagnostic and displays remediation plan summary then stops"
    - "--execute resumes from saved solve-session.json"
    - "solve-session.cjs persists/reads/clears session data"
    - "Plan summary includes estimated iterations and cascade forecast"
---
<objective>Two-phase solve: plan review before execution.</objective>
