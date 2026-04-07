---
phase: quick-381
plan: 01
subsystem: workflow-quick
tags: [delegate, mode-c, coding-task-router, quick-workflow]
dependency_graph:
  requires: [bin/coding-task-router.cjs, bin/providers.json]
  provides: [delegate-mode-in-quick-workflow]
  affects: [core/workflows/quick.md, ~/.claude/nf/workflows/quick.md]
tech_stack:
  patterns: [mode-c-dispatch, slot-validation, delegate-branch]
key_files:
  modified:
    - core/workflows/quick.md
    - ~/.claude/nf/workflows/quick.md
decisions:
  - "Delegate mode skips Steps 4.5, 5, 5.5, 5.7, 5.8, 6, 6.3, 6.5, 6.7 — external agent handles planning, execution, formal checks, and quorum"
  - "Steps 2-2.8, 3, 4 preserved for delegate mode to maintain local tracking (scope contract, branching, directories)"
  - "Slot validation requires subprocess type AND has_file_access — API-only slots rejected"
  - "Delegate results mapped to STATE.md status: Delegated (OK/Partial/Failed/Unavail)"
metrics:
  completed: 2026-04-07
---

# Quick Task 381: Add --delegate flag to nf:quick for full task delegation via Mode C dispatch

Delegate flag enables full task dispatch to external agent CLIs via coding-task-router.cjs, bypassing local planning/execution while preserving scope contracts and STATE.md tracking.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add --delegate flag parsing and Mode C dispatch branch | e77c29eb | core/workflows/quick.md |
| 2 | Sync workflow to installed location | (sync only) | ~/.claude/nf/workflows/quick.md |

## What Changed

### core/workflows/quick.md

1. **Step 1 (argument parsing):** Added `--delegate {slot-name}` flag with mutual exclusivity check against `--full`. Delegate-specific display banner added.

2. **Step 2.8 (NEW):** Slot validation step reads `bin/providers.json`, verifies the named slot exists, is type `subprocess`, and has `has_file_access: true`. Invalid or non-subprocess slots produce descriptive error messages listing available options.

3. **Steps 5D/6D (delegate branch):** When `$DELEGATE_SLOT` is set, the workflow skips local planning (Step 5), quorum review (Step 5.7), debug routing (Step 5.8), execution (Step 6), and all `--full`-only steps (5.5, 6.3, 6.5, 6.7). Instead:
   - **Step 5D** dispatches via `node bin/coding-task-router.cjs --slot ... --task ... --cwd ... --timeout 300000`
   - **Step 6D** records the result in a delegate-specific SUMMARY.md template, updates STATE.md with mapped status, commits atomically, and displays the completion banner

4. **Success criteria:** Six new delegate-specific items added to the checklist.

### Invariant Compliance

- **EventualConsensus:** Not violated -- quorum skip is valid because no local plan artifact exists to review
- **RouteCLiveness:** Preserved -- delegate mode creates STATE.md entries identically to normal mode
- **R3.2 (no direct MCP):** Compliant -- delegation goes through coding-task-router.cjs -> call-quorum-slot.cjs subprocess dispatch

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

1. Step 1 parses `--delegate {slot-name}` with mutual exclusivity check: CONFIRMED
2. Step 2.8 validates slot against providers.json: CONFIRMED
3. Delegate branch (Steps 5D/6D) dispatches via coding-task-router.cjs CLI: CONFIRMED
4. Result recording creates SUMMARY.md and updates STATE.md: CONFIRMED
5. Success criteria section includes 6 delegate items: CONFIRMED
6. `grep -c 'delegate' core/workflows/quick.md` returns 20 (>= 15): CONFIRMED
7. Installed copy at ~/.claude/nf/workflows/quick.md contains delegate content (20 matches): CONFIRMED
8. Diff between repo and installed shows only expected ~/path expansion: CONFIRMED
