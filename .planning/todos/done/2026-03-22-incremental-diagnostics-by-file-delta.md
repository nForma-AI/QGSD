---
created: 2026-03-22T15:32:54.418Z
title: Incremental diagnostics by file delta
area: tooling
priority: medium
effort: large
files:
  - bin/nf-solve.cjs
  - commands/nf/solve-remediate.md
---

## Problem

Every convergence check runs the full 18-sweep diagnostic (~60-90s). Most layers didn't change between iterations — e.g., if only formal models were created, T->C/C->R/T->R/D->R/D->C/R->D sweeps are wasted work.

## Solution

Track which files were modified by remediation and only re-sweep affected layers. Remediation reports `actions_taken` but not `files_touched` — extend the remediation report to include modified file paths. Then map file paths to layer domains and skip unaffected sweeps. Expected savings: 50-70% of diagnostic time on iterations 2+.
