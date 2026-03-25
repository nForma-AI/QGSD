---
phase: quick-354
plan: 1
subsystem: solve-report
tags: [layer-rendering, table-structure, alignment-gates, signal-expansion]
completed_date: 2026-03-25
duration: ~2 min
dependency_graph:
  requires: []
  provides: [solve-report-20-layers]
  affects: [nf:solve reporting phase]
tech_stack:
  patterns: [markdown-table-syntax, LAYER_KEYS-canonical-array]
key_files:
  created: []
  modified:
    - commands/nf/solve-report.md
decisions:
  - "L2 (Semantics) layer collapsed per STRUCT-01; Gate A now evaluates L1→L3 directly"
  - "Signals section expanded to 6 informational rows (all non-gap diagnostic signals)"
---

# Phase Quick Task 354: Add 5 Missing Layers to Solve-Report Table Renderer

## Summary

Updated `commands/nf/solve-report.md` table renderer to display all 20 LAYER_KEYS from `bin/layer-constants.cjs` instead of 17 rows. The before/after comparison table now includes complete coverage with correct alignment section (2 gates, not 3) and expanded signals section (6 rows, not 3).

**One-liner:** Complete table rendering of all 20 diagnostic layers with L2 semantic collapse and per-model gate scoring.

## Changes Made

### 1. Added B -> F (Bug->Formal) Row to Forward Discovery

**Location:** Line 69 (after P -> F)

```
B -> F (Bug->Formal)        {N}    {M}    {delta}   [status]
```

**Purpose:** Captures bug-to-formal model gap analysis, enabling production issue tracing through formal verification.

**Impact:** Forward Discovery section now has 8 rows (was 7).

### 2. Fixed Alignment Section (3→2 Gates)

**Location:** Lines 77-78 (was lines 76-78)

**Changes:**
- **Removed:** `L2 -> L3 (Gate B)` row — L2 semantic layer collapsed per STRUCT-01
- **Renamed:** `L1 -> L2 (Gate A)` → `L1 -> L3 (Gate A)` — Gate A now evaluates L1 directly to L3, skipping L2

**Result:**
```
L1 -> L3 (Gate A)           {N}    {M}    {delta}   [status]
L3 -> TC (Gate C)           {N}    {M}    {delta}   [status]
```

Alignment subtotal: 2 rows (was 3).

### 3. Expanded Signals Section (3→6 Rows)

**Location:** Lines 81-86 (was lines 81-84)

**Added (in order):**
1. **PMG (Per-Model Gates)** — BEFORE Git Heatmap. Per-model gate score signals from formal verification.
2. **F-Lint (Formal Model Lint)** — AFTER GitHist. Formal model syntax and consistency issues.
3. **H -> M (Hazard->Model)** — AFTER Hazard. Hazard-to-model traceability signal.

**Result:**
```
PMG (Per-Model Gates)        {N}    {M}    {delta}   [signal]
G -> H (Git Heatmap)         {N}    {M}    {delta}   [signal]
GitHist (TLA+ drift)         {N}    {M}    {delta}   [signal]
F-Lint (Formal Model Lint)   {N}    {M}    {delta}   [signal]
Hazard (FMEA high-RPN)       {N}    {M}    {delta}   [signal]
H -> M (Hazard->Model)       {N}    {M}    {delta}   [signal]
```

Signal count: 6 rows (was 3).

## Layer Inventory

All 20 LAYER_KEYS now rendered:

| Section | Layers | Count |
|---------|--------|-------|
| Forward Discovery | r_to_f, f_to_t, c_to_f, t_to_c, f_to_c, r_to_d, d_to_c, p_to_f, **b_to_f** | 9 |
| Reverse Discovery | c_to_r, t_to_r, d_to_r | 3 |
| Layer Alignment | **l1_to_l3**, l3_to_tc | 2 |
| Informational Signals | **per_model_gates**, git_heatmap, git_history, **formal_lint**, hazard_model, **h_to_m** | 6 |
| **Total** | | **20** |

Layers shown in bold were added or corrected in this task.

## Verification Results

✅ All 20 LAYER_KEYS present in table (verified against bin/layer-constants.cjs)
✅ Forward Discovery: 9 rows (including new B -> F)
✅ Reverse Discovery: 3 rows (unchanged)
✅ Layer Alignment: 2 rows (L1->L3, L3->TC; no L2->L3 Gate B)
✅ Informational Signals: 6 rows (PMG, Git Heatmap, GitHist, F-Lint, Hazard, H->M)
✅ No layer names duplicated in table section
✅ All placeholder columns intact ({N}, {M}, {delta}, [status]/[signal])
✅ Subtotal labels updated: Forward 9, Discovery 3, Alignment 2, Signals 6
✅ Grand total row present (20 layers)
✅ No "L2 -> L3" gate row remaining
✅ No markdown table syntax errors

## Technical Details

### LAYER_KEY → Display Name Mapping

**Forward Discovery (9):**
- r_to_f → "R -> F (Req->Formal)"
- f_to_t → "F -> T (Formal->Test)"
- c_to_f → "C -> F (Code->Formal)"
- t_to_c → "T -> C (Test->Code)"
- f_to_c → "F -> C (Formal->Code)"
- r_to_d → "R -> D (Req->Docs)"
- d_to_c → "D -> C (Docs->Code)"
- p_to_f → "P -> F (Prod->Formal)"
- **b_to_f** → "B -> F (Bug->Formal)" [NEW]

**Reverse Discovery (3):**
- c_to_r → "C -> R (Code->Req)"
- t_to_r → "T -> R (Test->Req)"
- d_to_r → "D -> R (Docs->Req)"

**Alignment (2):**
- **l1_to_l3** → "L1 -> L3 (Gate A)" [RENAMED from l1_to_l2]
- l3_to_tc → "L3 -> TC (Gate C)"

**Informational Signals (6):**
- **per_model_gates** → "PMG (Per-Model Gates)" [NEW]
- git_heatmap → "G -> H (Git Heatmap)"
- git_history → "GitHist (TLA+ drift)"
- **formal_lint** → "F-Lint (Formal Model Lint)" [NEW]
- hazard_model → "Hazard (FMEA high-RPN)"
- **h_to_m** → "H -> M (Hazard->Model)" [NEW]

### Structural Notes

- **L2 Collapse (STRUCT-01):** The semantic layer (L2) has been collapsed from the alignment gates. Gate A originally evaluated L1→L2; now it evaluates L1→L3 directly, skipping the L2 evaluation step. This reflects the formal verification optimization where L2 checks are integrated into cross-layer analysis.
- **Signal Layer Status:** Signals (per_model_gates, git_heatmap, git_history, formal_lint, hazard_model, h_to_m) are diagnostic signals, not gap layers — they use [signal] status indicator instead of [status].
- **Table Totals:** Forward subtotal sums 9 rows, Discovery subtotal sums 3 rows, Alignment subtotal sums 2 rows, Signal count sums 6 rows. Grand total row references full 20-layer sum.

## Deviations from Plan

None — plan executed exactly as written.

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| commands/nf/solve-report.md | Added B->F row, fixed alignment gates (2→3 gates), expanded signals (3→6 rows), updated subtotals | 59, 68-69, 76-78, 80-86, 87 |

## Task Completion

| Item | Status |
|------|--------|
| All 20 layers rendered | ✅ COMPLETE |
| Alignment section corrected (2 gates) | ✅ COMPLETE |
| Signals section expanded (6 rows) | ✅ COMPLETE |
| B -> F layer added | ✅ COMPLETE |
| All verify checks passed | ✅ COMPLETE |
| Commit created | ✅ a931c0cc |

---

## Self-Check

File checks:
- [x] `/Users/jonathanborduas/code/QGSD/commands/nf/solve-report.md` — FOUND (modified)

Commit checks:
- [x] Commit a931c0cc — FOUND (`git log --oneline | grep a931c0cc`)

All checks passed.
