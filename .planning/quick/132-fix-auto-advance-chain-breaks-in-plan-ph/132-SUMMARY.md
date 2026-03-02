---
quick: 132
type: execute
title: "Fix auto-advance chain breaks in plan-phase.md and verify-work.md"
completed_date: 2026-03-02
duration: "~5 minutes"
status: complete
tags:
  - auto-advance
  - workflow
  - plan-phase
  - verify-work
  - SlashCommand
---

# Quick Task 132 Summary: Fix Auto-Advance Chain Breaks

## Objective

Fix two broken auto-advance chain links:
1. **plan-phase** stops after PHASE_COMPLETE instead of continuing to the next workflow step
2. **verify-work** stops after gap verification instead of routing to execute-phase (if gaps) or discuss-phase (if no gaps)

Purpose: Auto-advance pipeline requires each workflow to invoke the next step via SlashCommand — displaying text and stopping breaks the chain.

## What Was Built

### Task 1: Fixed plan-phase PHASE_COMPLETE auto-advance

**File:** `qgsd-core/workflows/plan-phase.md` (lines 737-772)

**Changes:**
- Replaced the static "Display final summary" block with dynamic auto-advance logic
- Added NEXT_PHASE determination from execute-phase result
- Added CONTEXT.md existence check via bash command
- Added conditional SlashCommand invocation:
  - If `$NEXT_CONTEXT` exists: invoke `/qgsd:plan-phase ${NEXT_PHASE} --auto`
  - Otherwise: invoke `/qgsd:discuss-phase ${NEXT_PHASE} --auto`
- Updated banner to show which next workflow will be invoked
- Preserved "GAPS FOUND" branch (unchanged — still displays and stops)
- Preserved interactive mode path to `<offer_next>` (unchanged)

**Pattern:** Follows transition.md model (lines 361-393) for CONTEXT.md check + SlashCommand pattern.

### Task 2: Fixed verify-work present_ready auto-advance

**File:** `qgsd-core/workflows/verify-work.md` (lines 519-552)

**Changes:**
- Added auto-advance section after the static "FIXES READY" banner
- Added AUTO_CFG config check via `gsd-tools.cjs config-get workflow.auto_advance`
- Added two sub-cases for --auto mode:
  - **Sub-case A (gaps found):** Displays "AUTO-ADVANCING TO EXECUTE GAPS" banner, invokes `/qgsd:execute-phase ${PHASE} --gaps-only --auto`
  - **Sub-case B (no gaps):** Displays "VERIFICATION COMPLETE" banner, invokes `/qgsd:discuss-phase ${NEXT_PHASE} --auto`
- Static banner and "/clear" hint preserved for interactive mode (no change)
- If neither --auto nor config enabled: keeps existing display-and-stop behavior

**Pattern:** Matches plan spec exactly; integrates NEXT_PHASE from `gsd-tools.cjs roadmap get-phase` next field.

## Verification

### Checklist

- [x] plan-phase.md PHASE_COMPLETE block (lines 737-772) contains bash command checking for NEXT_PHASE CONTEXT.md
- [x] plan-phase.md has SlashCommand invocations for both routing branches (discuss-phase and plan-phase)
- [x] "GAPS FOUND" branch still displays text and stops (no SlashCommand)
- [x] Interactive fallback to `<offer_next>` is unchanged
- [x] verify-work.md present_ready step (lines 519-552) has auto-advance section after static banner
- [x] Sub-case A: gaps found → SlashCommand("execute-phase ... --gaps-only --auto")
- [x] Sub-case B: no gaps → SlashCommand("discuss-phase NEXT_PHASE --auto")
- [x] AUTO_CFG bash check is present
- [x] Static banner + "/clear" hint still exists for interactive mode (unchanged)
- [x] No Skill() calls introduced (correct pattern: SlashCommand)

### Test Results

All changes verified by grep:
```
plan-phase.md:759:     4. Invoke SlashCommand:
plan-phase.md:760:        - If `$NEXT_CONTEXT` is non-empty (CONTEXT.md exists): `SlashCommand("/qgsd:plan-phase ${NEXT_PHASE} --auto")`
plan-phase.md:761:        - Otherwise: `SlashCommand("/qgsd:discuss-phase ${NEXT_PHASE} --auto")`

verify-work.md:538:Invoke: `SlashCommand("/qgsd:execute-phase ${PHASE} --gaps-only --auto")`
verify-work.md:548:Invoke: `SlashCommand("/qgsd:discuss-phase ${NEXT_PHASE} --auto")`
```

No Skill() calls found in either file.

## Key Decisions

1. **Pattern Source:** Used transition.md (lines 361-393) as authoritative model for CONTEXT.md check + SlashCommand routing
2. **Gap Detection:** Determined that `present_ready` step is only reached when gaps are found; when no gaps (issues == 0), the flow shows "All tests passed" and offers manual next steps (not using `present_ready`)
3. **Sub-case B Logic:** For no-gaps path, use `gsd-tools.cjs roadmap get-phase` to find NEXT_PHASE (the phase immediately after current phase)

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `qgsd-core/workflows/plan-phase.md` | 737-772 | Replaced static PHASE_COMPLETE handler with dynamic auto-advance logic + CONTEXT.md routing |
| `qgsd-core/workflows/verify-work.md` | 519-552 | Added auto-advance section with gap/no-gap sub-cases + SlashCommand invocation |

## Success Criteria Met

- [x] plan-phase.md PHASE_COMPLETE handler invokes SlashCommand in --auto mode (CONTEXT.md-aware routing: discuss-phase or plan-phase)
- [x] verify-work.md present_ready invokes SlashCommand in --auto mode (gaps → execute-phase --gaps-only --auto; no gaps → discuss-phase NEXT_PHASE --auto)
- [x] Both files leave interactive-mode paths unchanged
- [x] No Skill() calls introduced (wrong pattern — SlashCommand is correct)

## Notes

- Both edits are structural and non-breaking: they ADD auto-advance paths without affecting existing interactive paths
- The changes enable the full auto-advance chain: plan-phase → execute-phase → verify-work → execute-gaps/discuss-next-phase
- No new dependencies or configuration required; uses existing SlashCommand infrastructure and gsd-tools.cjs utilities
