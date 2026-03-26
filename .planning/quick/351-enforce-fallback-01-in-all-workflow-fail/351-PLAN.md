---
task: 351
title: Enforce FALLBACK-01 in all workflow fail-open rules and add preflight slot/fallback preview display
type: fix + enhancement
risk: low
formal_artifacts: none
files_modified:
  - core/workflows/execute-phase.md
  - core/references/quorum-dispatch.md
  - commands/nf/quorum.md
must_haves:
  - All 7 quorum fail-open rules across 4 workflows require FALLBACK-01 exhaustion before triggering (quick.md — 3 sites; discuss-phase.md — 1 site; plan-phase.md — 1 site; execute-phase.md — 2 sites)
  - Preflight display shows primary dispatch slots AND fallback order (T1 then T2) before first dispatch
  - commands/nf/quorum.md updated first (authoritative source), then synced to quorum-dispatch.md
  - Existing quorum-dispatch.md §11 quick reference updated to include preflight preview step
---

# Plan

## Context

When a quorum slot returns UNAVAIL, the orchestrator should cascade through fallback tiers (T1 same-subscription, T2 cross-subscription) before applying fail-open. Currently, 5 of 7 dispatch sites already have the fix (applied earlier this session). 2 sites in execute-phase.md still lack FALLBACK-01 enforcement. Additionally, no workflow shows the user which slots are primary vs fallback before dispatch — making it hard to diagnose issues.

## Tasks

### Task 1: Fix remaining execute-phase.md fail-open rules

**Files:** `core/workflows/execute-phase.md`

Add FALLBACK-01 required clause before each of the 2 remaining fail-open rules:

1. **Line ~264** (human-verify checkpoint quorum): Add FALLBACK-01 requirement between dispatch instruction and fail-open
2. **Line ~525** (human_needed quorum in verify_phase_goal): Add FALLBACK-01 requirement between dispatch instruction and fail-open

Pattern (same as already applied in quick.md):
```
- **FALLBACK-01 required:** If ANY dispatched slot returns UNAVAIL, follow the tiered fallback protocol from @core/references/quorum-dispatch.md §6 before evaluating consensus. Dispatch T1 (same `auth_type=sub`) then T2 (cross-subscription) unused slots from the preflight `available_slots` list. Complete the FALLBACK_CHECKPOINT before proceeding.

Fail-open: if all slots AND all fallback tiers are exhausted (UNAVAIL), ...
```

### Task 2: Add preflight slot/fallback preview display

**Files:** `commands/nf/quorum.md` (authoritative), `core/references/quorum-dispatch.md` (synced copy)

**Step 2a:** Update `commands/nf/quorum.md` first — add the QUORUM SLOT ASSIGNMENT display template in the Adaptive Fan-Out section. This template must be emitted by the orchestrator after computing `$DISPATCH_LIST` and before first dispatch:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► QUORUM SLOT ASSIGNMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Primary slots (${FAN_OUT_COUNT - 1}):
   ${DISPATCH_LIST entries with model names}

 Fallback order:
   T1 (same-sub): ${T1_UNUSED slots, or "none"}
   T2 (cross-sub): ${T2_FALLBACK slots, or "none"}

 Total available: ${available_slots count}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Step 2b:** Sync the same addition to `core/references/quorum-dispatch.md` §3. Also update §11 quick reference to include this step.

## Verification

- Grep all `Fail-open.*UNAVAIL` across workflows — all 7 must include "all fallback tiers are exhausted"
- Grep for "FALLBACK-01 required" — must appear in all 4 workflow files (7 sites total)
- quorum-dispatch.md AND quorum.md both contain the QUORUM SLOT ASSIGNMENT display template
