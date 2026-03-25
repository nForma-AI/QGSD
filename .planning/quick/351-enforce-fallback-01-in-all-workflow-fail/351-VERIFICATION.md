---
phase: 351-enforce-fallback-01-in-all-workflow-fail
verified: 2026-03-25T15:32:00Z
status: passed
score: 4/4 must-haves verified
---

# Phase 351: Enforce FALLBACK-01 in all workflow fail-open rules Verification Report

**Phase Goal:** Enforce FALLBACK-01 exhaustion before fail-open in all 7 quorum dispatch sites across 4 workflows, and add preflight display showing primary slots and fallback tiers.

**Verified:** 2026-03-25 15:32 UTC
**Status:** PASSED
**All must-haves verified**

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 7 quorum fail-open rules require FALLBACK-01 exhaustion before triggering | ✓ VERIFIED | All 7 sites across 4 workflows contain "FALLBACK-01 required:" + "all fallback tiers are exhausted" language |
| 2 | Preflight display shows primary dispatch slots AND fallback order (T1 then T2) before first dispatch | ✓ VERIFIED | QUORUM SLOT ASSIGNMENT template documented in commands/nf/quorum.md with complete structure (primary, T1, T2, total) |
| 3 | commands/nf/quorum.md updated first (authoritative source), then synced to quorum-dispatch.md | ✓ VERIFIED | FAN-06 section in commands/nf/quorum.md with header stating quorum.md is authoritative; quorum-dispatch.md §3 contains identical template |
| 4 | quorum-dispatch.md §11 quick reference includes preflight preview step | ✓ VERIFIED | §11 step 3 explicitly includes "Display QUORUM SLOT ASSIGNMENT (preflight preview of primary + fallback tiers)" |

**Score:** 4/4 must-haves verified

---

## Required Artifacts

### FALLBACK-01 Enforcement Sites (7 Total)

| File | Section | Status | Details |
|------|---------|--------|---------|
| core/workflows/quick.md | Step 5.7, Quorum review (line 449) | ✓ VERIFIED | "FALLBACK-01 required:" + "all slots AND all fallback tiers are exhausted" |
| core/workflows/quick.md | Step 5.13, Verification quorum (line 775) | ✓ VERIFIED | "FALLBACK-01 required:" + "all slots AND all fallback tiers are exhausted" |
| core/workflows/quick.md | Step 6.2, R4 pre-filter quorum (line 811) | ✓ VERIFIED | "FALLBACK-01 required:" + "all slots AND all fallback tiers are exhausted" |
| core/workflows/discuss-phase.md | Step r4_pre_filter, line 222 | ✓ VERIFIED | "FALLBACK-01 required:" + "all slots AND all fallback tiers are exhausted" |
| core/workflows/plan-phase.md | Step R3 quorum, line 427 | ✓ VERIFIED | "FALLBACK-01 required:" + "all slots AND all fallback tiers are exhausted" |
| core/workflows/execute-phase.md | Step verify_checkpoint_quorum, line 264 | ✓ VERIFIED | "FALLBACK-01 required:" + "all slots AND all fallback tiers are exhausted" |
| core/workflows/execute-phase.md | Step verify_phase_goal, line 526 | ✓ VERIFIED | "FALLBACK-01 required:" + "all slots AND all fallback tiers are exhausted" |

### Preflight Display Template

| Artifact | Location | Status | Details |
|----------|----------|--------|---------|
| QUORUM SLOT ASSIGNMENT template | commands/nf/quorum.md (lines 229-249, §Preflight Slot Assignment Display) | ✓ VERIFIED | Complete template with primary slots, T1 fallback, T2 fallback, total available |
| QUORUM SLOT ASSIGNMENT template | core/references/quorum-dispatch.md (lines 101-116, §3) | ✓ VERIFIED | Identical sync from authoritative source |
| Preflight step in quick reference | core/references/quorum-dispatch.md (§11, step 3, line 405) | ✓ VERIFIED | Explicitly states "Display QUORUM SLOT ASSIGNMENT (preflight preview of primary + fallback tiers)" |

---

## Key Verification Details

### FALLBACK-01 Language Consistency

All 7 sites use consistent language pattern:

```
**FALLBACK-01 required:** If ANY dispatched slot returns UNAVAIL, follow the tiered
fallback protocol from @core/references/quorum-dispatch.md §6 before evaluating consensus.
Dispatch T1 (same `auth_type=sub`) then T2 (cross-subscription) unused slots from the
preflight `available_slots` list. Complete the FALLBACK_CHECKPOINT before proceeding.

Fail-open: if all slots AND all fallback tiers are exhausted (UNAVAIL), [action specific to context]
```

This pattern ensures:
1. No fail-open without exhausting T1
2. No fail-open without exhausting T2 (if T1 empty/exhausted)
3. FALLBACK_CHECKPOINT mandatory before consensus evaluation
4. All sites reference the canonical protocol from quorum-dispatch.md §6

### Authoritative Source Chain

**commands/nf/quorum.md → core/references/quorum-dispatch.md**

- FAN-06 section in quorum.md (lines 229-249): "Preflight Slot Assignment Display (FAN-06)"
- Header in quorum-dispatch.md states: "This is the implementation reference extracted from `commands/nf/quorum.md`. The quorum.md command remains the authoritative specification. Edit quorum.md first, then sync changes here."
- Template content identical in both locations
- quorum-dispatch.md sourced from commands/nf/quorum.md (line 4: `source: commands/nf/quorum.md`)

### Quick Reference Alignment

quorum-dispatch.md §11 "Quick Reference: Preflight → Dispatch → Deliberate → Consensus" (lines 400-420):

```
1. Provider health check
2. Build $DISPATCH_LIST
3. Display QUORUM SLOT ASSIGNMENT ← ✓ Explicitly included
4. Team fingerprint + scoreboard init
5. Dispatch Round 1
6. If ANY slot UNAVAIL → FALLBACK-01 [with T1, T2 detail]
7. Check consensus (only after FALLBACK-01 complete)
```

The quick reference includes the preflight display as step 3, before any dispatch occurs.

---

## Anti-Patterns Found

None. All sites use consistent, complete FALLBACK-01 language with proper fail-open guards.

---

## Gaps Summary

No gaps found. All 4 must-haves verified:

1. ✓ All 7 fail-open rules enforce FALLBACK-01 exhaustion
2. ✓ Preflight display template shows primary + fallback tiers
3. ✓ commands/nf/quorum.md is authoritative, synced to references
4. ✓ quorum-dispatch.md §11 quick reference includes preflight preview step

The phase goal is fully achieved. All workflows now have consistent FALLBACK-01 enforcement, users can see slot assignment before dispatch begins, and the canonical protocol is properly documented with authoritative sourcing.

---

_Verified: 2026-03-25 15:32 UTC_
_Verifier: Claude (nf-verifier)_
