---
phase: quick-326
verified: 2026-03-18T00:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Quick Task 326: Add Implicit State Machine Detection Verification Report

**Task Goal:** Add implicit state machine detection heuristics to `solve-diagnose` and `close-formal-gaps` workflows to surface ad-hoc control flow patterns before formal modeling.

**Verified:** 2026-03-18
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | solve-diagnose flags files with 3+ related boolean flags as implicit FSM candidates in its diagnostic output | ✓ VERIFIED | `commands/nf/solve-diagnose.md` lines 261-262: Heuristic A defined, searching for state-indicator suffixes (Pending, Active, Done, etc.) with ≥3 matches per file |
| 2 | solve-diagnose flags files with string/enum variables having 3+ distinct values used in conditionals as implicit FSM candidates | ✓ VERIFIED | `commands/nf/solve-diagnose.md` lines 264-265: Heuristic B defined, searching for `===\s*['"][A-Z_]` and `case '[A-Z_]` patterns with ≥3 matches |
| 3 | close-formal-gaps includes 'implicit FSM' as a recognized gap type when scanning for uncovered files | ✓ VERIFIED | `core/workflows/close-formal-gaps.md` lines 47-62: New "Implicit FSM Gap Detection" subsection in detect_gaps step implements both heuristics A and B |
| 4 | close-formal-gaps suggests running fsm-to-tla.cjs --scaffold-config when an implicit FSM gap is detected | ✓ VERIFIED | `core/workflows/close-formal-gaps.md` lines 72-73: "Recommended action: run `node bin/fsm-to-tla.cjs --scaffold-config`" in gap summary template |
| 5 | core/workflows/close-formal-gaps.md is the repo-internal source; to propagate to the installed location, run node bin/install.js --claude --global | ✓ VERIFIED | Documented in plan line 21 and SUMMARY.md line 15; file is the canonical source, not a copy |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `commands/nf/solve-diagnose.md` | Implicit FSM detection step added after issue classification; fsm_candidates in output_contract | ✓ VERIFIED | Lines 252-274: New subsection after Issue Classification block. Lines 50: fsm_candidates field added to output_contract JSON schema as array field |
| `core/workflows/close-formal-gaps.md` | Implicit FSM gap type in detect_gaps; fsm-to-tla.cjs suggestion | ✓ VERIFIED | Lines 47-76: New subsection in detect_gaps step with both heuristics, gap summary template, and fsm-to-tla.cjs recommendation |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|------|--------|---------|
| solve-diagnose Step 1 | .planning/formal/evidence/git-heatmap.json | uncovered_hot_zones field extraction via jq | ✓ WIRED | Lines 256-258: Shell command extracts file list from uncovered_hot_zones array, filtering to code files and excluding dist/node_modules/.planning |
| solve-diagnose output | fsm_candidates in JSON output_contract | Array field in JSON schema | ✓ WIRED | Line 50: fsm_candidates declared as sibling of issues field with comment explaining its purpose |
| close-formal-gaps detect_gaps | Same heatmap source | Same jq extraction logic | ✓ WIRED | Lines 51-54: Identical jq shell command references uncovered_hot_zones, matching solve-diagnose for consistency |
| close-formal-gaps detect_gaps | fsm-to-tla.cjs tool | Recommendation in gap summary | ✓ WIRED | Lines 72-73: Recommended action includes tool name and flag; callable by user for FSM scaffolding |

### Anti-Patterns Found

| File | Pattern | Severity | Status |
|------|---------|----------|--------|
| commands/nf/solve-diagnose.md | No TODO/FIXME/placeholder comments | — | ✓ CLEAN |
| core/workflows/close-formal-gaps.md | No TODO/FIXME/placeholder comments | — | ✓ CLEAN |

### Verification Checks

**✓ All verification criteria from plan pass:**

1. `grep -n "fsm_candidates" commands/nf/solve-diagnose.md` returns 2 matches (process section + output_contract)
   ```
   50:  "fsm_candidates": [], /* implicit FSM candidates from heatmap scan */
   274:Store the candidates array as `fsm_candidates` in the solve context.
   ```

2. `grep -n "Implicit FSM" core/workflows/close-formal-gaps.md` returns matches in detect_gaps step
   ```
   47:### Implicit FSM Gap Detection
   67:Implicit FSM Candidates (may not yet have a formal model)
   ```

3. `grep -n "fsm-to-tla" core/workflows/close-formal-gaps.md` returns the scaffold suggestion
   ```
   72:Recommended action: run `node bin/fsm-to-tla.cjs --scaffold-config` to generate
   ```

4. `grep -n "uncovered_hot_zones" core/workflows/close-formal-gaps.md` returns matches confirming correct heatmap field (not top_files)
   ```
   51:**File source:** Extract the top 10 code files from `.planning/formal/evidence/git-heatmap.json` using the `uncovered_hot_zones` array...
   53:jq -r '[.uncovered_hot_zones[] | ...] .planning/formal/evidence/git-heatmap.json | head -10
   ```

5. Both heuristics documented as fail-open:
   - `commands/nf/solve-diagnose.md` line 267: "Both heuristics are **fail-open**: if the heatmap file is missing, if grep errors, or if a target file does not exist, skip silently and proceed."
   - `core/workflows/close-formal-gaps.md` line 62: "Both greps are **fail-open**: if a file does not exist or grep errors, skip that file silently."

6. `.planning/quick/326-add-implicit-state-machine-detection-to-/326-SUMMARY.md` contains all three required headings
   ```
   ## Summary
   ## What Changed
   ## Verification
   (Count: 3 matches via grep -cE)
   ```

### Delivery Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| PLAN | `.planning/quick/326-add-implicit-state-machine-detection-to-/326-PLAN.md` | ✓ EXISTS |
| SUMMARY | `.planning/quick/326-add-implicit-state-machine-detection-to-/326-SUMMARY.md` | ✓ EXISTS |
| Modified workflow 1 | `commands/nf/solve-diagnose.md` | ✓ EXISTS + MODIFIED |
| Modified workflow 2 | `core/workflows/close-formal-gaps.md` | ✓ EXISTS + MODIFIED |

### Git History

| Commit | Message |
|--------|---------|
| beb0710e | feat(quick-326): add implicit FSM detection step to solve-diagnose |
| a9482dcf | feat(quick-326): add implicit FSM gap type to close-formal-gaps Step 1 |
| 859cb36e | docs(quick-326): add implicit state machine detection to solve-diagnose and close-formal-gaps |

---

## Summary

**Goal Achievement:** COMPLETE

All five must-haves are verified:

1. **solve-diagnose FSM detection (multi-flag boolean)** — ✓ Heuristic A implemented at lines 261-262, searching for state-indicator suffixes with ≥3 matches per file
2. **solve-diagnose FSM detection (enum-like strings)** — ✓ Heuristic B implemented at lines 264-265, searching for uppercase string comparisons with ≥3 matches
3. **close-formal-gaps gap type** — ✓ New "Implicit FSM Gap Detection" subsection added to detect_gaps step with both heuristics
4. **fsm-to-tla.cjs recommendation** — ✓ Documented at lines 72-73 with exact command and flag
5. **Deployment note** — ✓ Documented in plan and SUMMARY that core/workflows/ is canonical source; propagation via `node bin/install.js --claude --global`

**Quality Checks:**
- No TODO/FIXME/placeholder comments in modified files
- Both heuristics documented as fail-open (graceful degradation on missing/error)
- Consistent heatmap field usage (uncovered_hot_zones, not top_files)
- Output contract JSON schema updated with fsm_candidates field
- All verification criteria from plan pass
- SUMMARY.md contains all three required sections

**Task Completion:** The implicit FSM detection goal is fully achieved. Both workflows now surface ad-hoc state machines before they reach formal modeling, closing the detection gap identified in the objective.

---

_Verified: 2026-03-18_
_Verifier: Claude (nf-verifier)_
