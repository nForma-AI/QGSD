---
phase: quick-163
plan: "01"
subsystem: solve-skill
tags: [solve, documentation, auto-remediation, developer-docs, R->D]
dependency_graph:
  requires: []
  provides: [sweepRtoD-developer-scope, solve-auto-doc-generation]
  affects: [bin/qgsd-solve.cjs, commands/qgsd/solve.md]
tech_stack:
  added: []
  patterns: [developer-category-filtering, batch-dispatch-with-quick]
key_files:
  created: []
  modified:
    - bin/qgsd-solve.cjs
    - commands/qgsd/solve.md
decisions:
  - "sweepRtoD filters to developer-category docs (docs/dev/) only; falls back to all docs if none present"
  - "R->D gaps are now auto-remediated via /qgsd:quick batches targeting docs/dev/requirements-coverage.md"
  - "User docs (docs/) are never auto-generated — human-controlled only"
  - "D->C (Step 3g) remains informational-only; only R->D was upgraded to auto"
metrics:
  duration: "5 minutes"
  completed: "2026-03-04"
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 163: Add Developer Doc Auto-Generation to QGSD Solve Skill

**One-liner:** sweepRtoD scoped to developer docs only + Step 3f now auto-dispatches /qgsd:quick batches to generate docs/dev/requirements-coverage.md entries for undocumented requirements.

## What Was Done

### Task 1: Scope sweepRtoD to Developer-Category Docs Only (bin/qgsd-solve.cjs)

Changed `discoverDocFiles()` result in `sweepRtoD()` to filter to developer-category files only. The R->D gap detection now counts only requirements missing from `docs/dev/` rather than all docs including user-controlled `docs/`. Falls back to all discovered docs when no developer-category files are present (legacy project support).

Added `developer_docs_only` flag to the detail object so callers can know which scoping was applied.

Verification: `sweepRtoD()` returns `doc_files_scanned: 2` (only docs/dev/ files) and `developer_docs_only: true`.

Commit: `aa50f1a6`

### Task 2: Add Auto-Remediation Dispatch to Step 3f in solve.md

Replaced the "informational only / do not dispatch" Step 3f with an active auto-remediation flow:

1. Display undocumented IDs (kept)
2. Read `.formal/requirements.json` for requirement text
3. Grep codebase for relevant source files per requirement
4. Group into batches of up to 10
5. Dispatch `/qgsd:quick Generate developer doc entries for requirements {IDS}` per batch
6. Target `docs/dev/requirements-coverage.md` exclusively
7. Log progress and continue on batch failure

Also updated:
- Step 5 iteration loop: `automatable_residual` now includes `r_to_d`
- Step 6 summary table: R->D status changed from `[MANUAL]` to `[AUTO]`
- Step 6 final note: distinguishes R->D (auto) from D->C (manual-only)
- D->C (Step 3g) remains informational-only (no change)

Commit: `ea9363ea`

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

1. `node -e "const {sweepRtoD}=require('./bin/qgsd-solve.cjs'); console.log(JSON.stringify(sweepRtoD(),null,2))"` — runs without error, `doc_files_scanned: 2`, `developer_docs_only: true`
2. `grep -n "qgsd:quick Generate developer doc" commands/qgsd/solve.md` — matches line 236
3. `grep -n "informational only" commands/qgsd/solve.md` — only Step 3g (D->C) has it, Step 3f does not
4. `grep -n "automatable_residual.*r_to_d" commands/qgsd/solve.md` — matches line 295

## Self-Check: PASSED

- bin/qgsd-solve.cjs modified: confirmed (contains `f.category === 'developer'`)
- commands/qgsd/solve.md modified: confirmed (contains `/qgsd:quick Generate developer doc entries`)
- Commits exist: aa50f1a6, ea9363ea confirmed in git log
