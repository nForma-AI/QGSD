---
phase: quick-36
plan: 36
subsystem: workflows
tags: [quorum, verification, human_needed, execute-phase, quick]
dependency_graph:
  requires: []
  provides: [quorum-resolution-loop-for-human-needed]
  affects: [execute-phase.md, quick.md]
tech_stack:
  added: []
  patterns: [sequential-quorum-queries, fail-open-unavailable, resolved-unresolvable-votes]
key_files:
  created: []
  modified:
    - get-shit-done/workflows/execute-phase.md
    - get-shit-done/workflows/quick.md
decisions:
  - "Fail-open on unavailable models: remaining available models form the quorum"
  - "Consensus = all available models vote RESOLVED → treated as passed, no user interruption"
  - "Any UNRESOLVABLE vote → original user escalation preserved as fallback path"
  - "In quick.md: RESOLVED consensus sets VERIFICATION_STATUS = Verified (not Needs Review)"
  - "Repo source files (get-shit-done/workflows/) updated alongside installed (~/.claude/qgsd/workflows/) to keep in sync"
metrics:
  duration: 2 min
  completed: 2026-02-21
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 36: Add Quorum Resolution Loop for Human-Needed Verification Summary

**One-liner:** Quorum resolution loop inserted before human escalation in both execute-phase and quick workflows — automated models attempt RESOLVED/UNRESOLVABLE votes before bothering the user.

## What Was Built

Both workflow files (`execute-phase.md` and `quick.md`) now include a quorum resolution loop in their `human_needed` verification branch. When a verifier returns `human_needed` status, quorum models are consulted sequentially (R3.2 compliant) before the items are escalated to the user. Only if any model votes UNRESOLVABLE does the human see the verification items.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add quorum resolution loop to execute-phase.md human_needed branch | 8b3e408 | get-shit-done/workflows/execute-phase.md |
| 2 | Add quorum resolution loop to quick.md Step 6.5 human_needed row | 045f2fc | get-shit-done/workflows/quick.md |

## Changes Made

### execute-phase.md (verify_phase_goal step)

Replaced the original `**If human_needed:**` block (which immediately presented items to the user) with:

1. Read `human_verification` section from VERIFICATION.md
2. Form own position on each item
3. Query each quorum model sequentially per R3.2 with RESOLVED/UNRESOLVABLE votes
4. Evaluate votes: all RESOLVED → treat as `passed`, proceed to `update_roadmap`; any UNRESOLVABLE → escalate to user with updated message noting quorum attempted resolution

The user escalation block is preserved as the fallback path.

### quick.md (Step 6.5)

Updated `human_needed` row in status table to reference the quorum resolution loop. Added a prose block immediately after the status table describing:
- Read `human_verification` section from VERIFICATION.md
- Sequential quorum model queries per R3.2
- RESOLVED consensus → `$VERIFICATION_STATUS = "Verified"` (not "Needs Review")
- Any UNRESOLVABLE → display items, `$VERIFICATION_STATUS = "Needs Review"`

## Verification Results

All 7 verification checks passed:

1. `grep "quorum resolution loop" execute-phase.md` — match found in verify_phase_goal step
2. `grep "quorum resolution loop" quick.md` — match found in Step 6.5
3. `grep "RESOLVED|UNRESOLVABLE" execute-phase.md` — both votes documented
4. `grep "RESOLVED|UNRESOLVABLE" quick.md` — both votes documented
5. `grep "R3.2" execute-phase.md` — sequential call rule cited in new block
6. `grep "R3.2" quick.md` — sequential call rule cited in new block
7. `passed` and `gaps_found` branches verified untouched in both files

## Deviations from Plan

**1. [Rule 2 - Missing coverage] Repo source files updated alongside installed files**

- **Found during:** Task 1
- **Issue:** The plan specified `files_modified: ~/.claude/qgsd/workflows/...` (installed files only). The QGSD repo also contains source copies in `get-shit-done/workflows/` that get installed. Modifying only the installed copies would leave the repo source stale and out of sync.
- **Fix:** Applied identical changes to both `get-shit-done/workflows/execute-phase.md` and `get-shit-done/workflows/quick.md` in the repo.
- **Files modified:** `get-shit-done/workflows/execute-phase.md`, `get-shit-done/workflows/quick.md`
- **Commits:** 8b3e408, 045f2fc

## Self-Check: PASSED

- `get-shit-done/workflows/execute-phase.md` — confirmed exists and contains quorum resolution loop
- `get-shit-done/workflows/quick.md` — confirmed exists and contains quorum resolution loop
- Commit 8b3e408 — verified in git log
- Commit 045f2fc — verified in git log
