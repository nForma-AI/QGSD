---
phase: quick-79
plan: 01
subsystem: fix-tests-workflow
tags: [fix-tests, workflow, python-runner, test-categorization]
dependency_graph:
  requires: []
  provides: [fix-tests-unconditional-runner]
  affects: [get-shit-done/workflows/fix-tests.md]
tech_stack:
  added: []
  patterns: [unconditional-python-runner, state-handoff-block]
key_files:
  created: []
  modified:
    - get-shit-done/workflows/fix-tests.md
decisions:
  - Python batch runner is the unconditional default for all fix-tests runs regardless of suite size
  - Manual loop retained as portability fallback (Python unavailable only)
  - State Handoff Block documents structured RUNNER COMPLETE output for Claude to read
metrics:
  duration: 5min
  completed: 2026-02-23
---

# Phase quick-79 Plan 01: Generalize fix-tests Workflow for Extremely Large Test Suites Summary

**One-liner:** Python batch runner made unconditional default in fix-tests with manual loop demoted to explicit Python-unavailable fallback and new State Handoff Block section.

## What Was Built

Updated `get-shit-done/workflows/fix-tests.md` Step 5 section to eliminate the threshold-based execution strategy (> 5 batches) and make the Python batch runner the unconditional default for all runs.

### Changes Made

**Step 5 Execution Strategy** — replaced the "Small suite (≤ 5 batches)" / "Large suite (> 5 batches)" split with:
- Default (all runs): generate and execute the Python batch runner script
- Fallback (runner unavailable): manual loop for portability only when Python is unavailable

**Python Batch Runner subsection heading** — renamed from "(large suite path)" to "(default path)". Python script template unchanged byte-for-byte.

**Step 5-post** — scope updated from "(large suite path only)" to "(all runs)". Body text updated:
- "After the batch runner exits" → "After the Python batch runner exits"
- Removed "The batch loop below does NOT run for large suites."
- Added: "The manual loop below is fallback-only (see Execution Strategy above)."

**State Handoff Block** — new section inserted after Step 5-post reclassification text and before the `---` separator. Documents:
- `batches_complete` value to read from runner output
- Category counts from `results_by_category`
- Count of heuristic `real_bug` verdicts needing AI review
- Skip condition: if heuristic real_bug count is 0, skip Step 5-post and go directly to Step 6h dispatch

**Manual Loop header** — renamed from plain "For each batch index B..." to "### Manual Loop (fallback only — use only when Python is unavailable)" with the original loop text immediately below.

## Verification

All six verification checks passed:
1. `grep "unconditional\|all runs\|fallback"` — finds new labels at lines 74, 252, 259, 272
2. `grep "large suite path"` — zero matches (old label fully removed)
3. `grep "State Handoff Block"` — found at line 261
4. `grep "Manual Loop (fallback"` — found at line 272
5. `grep "def heuristic_categorize\|RUNNER COMPLETE\|batches_complete"` — all three present (Python script untouched)
6. `grep "6h\|6h.1\|dispatch" | tail -20` — dispatch steps intact

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite Step 5 to make Python runner unconditional and manual loop a fallback | 122e815 | get-shit-done/workflows/fix-tests.md |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `get-shit-done/workflows/fix-tests.md` modified
- [x] Commit 122e815 exists
- [x] All six grep verifications pass
- [x] Python script template unchanged
- [x] Step 6h and 6h.1 dispatch steps intact
