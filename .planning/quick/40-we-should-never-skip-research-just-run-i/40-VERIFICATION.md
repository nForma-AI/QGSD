---
phase: quick-40
verified: 2026-02-22T19:20:00Z
status: passed
score: 3/3 must-haves verified
gaps: []
human_verification: []
---

# Quick Task 40: Remove has_research Shortcut — Verification Report

**Task Goal:** we should never skip research, just run it
**Verified:** 2026-02-22T19:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

Research always runs on every `/qgsd:plan-phase` invocation. The `has_research` shortcut branch that silently reused an existing RESEARCH.md has been removed. Both the repo file and installed copy reflect the change.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Research always runs when /qgsd:plan-phase is invoked unless --skip-research or --gaps is explicitly passed | VERIFIED | Line 68-70: skip conditions listed; "Research always runs" statement present with no conditional gating the researcher spawn |
| 2 | An existing RESEARCH.md does NOT cause research to be silently skipped | VERIFIED | Zero matches for `has_research` as a branch condition; only appears in init variable listing (lines 21, 38) as documentation of the JSON field, not a skip gate |
| 3 | The success_criteria comment no longer says "unless ... or exists" | VERIFIED | Line 467: `Research completed (unless --skip-research or --gaps or research_enabled=false)` — "or exists" is gone |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `get-shit-done/workflows/plan-phase.md` | Updated Step 5 with research-always policy; contains "Research always runs" | VERIFIED | Line 70: `**Research always runs** (overwriting any existing RESEARCH.md unless skipped via flags above).` |
| `/Users/jonathanborduas/.claude/get-shit-done/workflows/plan-phase.md` | Installed copy updated to match (disk-only) | VERIFIED | `diff` of repo vs installed returns exit code 0 — files are identical |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| plan-phase.md Step 5 | qgsd-phase-researcher spawn | removal of has_research shortcut | WIRED | Researcher spawn block (lines 81+) follows directly after "Research always runs" with no conditional branch. Zero matches for `has_research` in skip logic context. |

### Specific Pattern Checks

| Pattern | Repo File | Installed File |
|---------|-----------|----------------|
| `has_research` as skip branch | 0 matches (only init var doc at lines 21, 38) | 0 matches (identical) |
| `Research always runs` | 1 match (line 70) | 1 match (line 70) |
| `or exists` in success_criteria | 0 matches | 0 matches |
| `Used existing` in offer_next | 0 matches | 0 matches |

### Anti-Patterns Found

None detected. No TODOs, FIXMEs, placeholders, or stub implementations in the modified file.

### Human Verification Required

None — all changes are textual/policy in a workflow markdown file and are fully verifiable via grep.

## Commit Evidence

Commit `8ac9ca8` confirmed: `fix(quick-40): remove has_research shortcut from plan-phase Step 5`

## Summary

The task achieved its goal. The `has_research` conditional branch in Step 5 of `plan-phase.md` is gone. Research now runs unconditionally on every `/qgsd:plan-phase` invocation; the only valid skip paths are `--skip-research`, `--gaps`, and `research_enabled=false`. Both the repo file and installed copy are identical. All three observable truths are satisfied.

---
_Verified: 2026-02-22T19:20:00Z_
_Verifier: Claude (gsd-verifier)_
