---
phase: quick-262
status: complete
---

# Quick Task 262: Fix 27 Orphaned L3 Reasoning Entries for Gate B

## What Changed

1. **Updated model-registry.json**: Set `source_layer = 'L3'` for 27 models that were incorrectly classified as L2
2. **Added requirements**: Mapped SPEC-03 to 3 quorum models (quorum-votes.als, quorum.pm, NFQuorum.tla) that had 0 requirements
3. **Fixed inferSourceLayer()** in `bin/promote-gate-maturity.cjs`: Changed default for TLA+/Alloy/PRISM models from L2 to L3, added .pm extension support

## Results

- Gate B score: **1.0** (was 0.85), target met
- All 180 models grounded, 0 orphaned (was 27)
- 10 models auto-promoted from ADVISORY to SOFT_GATE after layer fix

## Root Cause

The `inferSourceLayer()` function classified all `.tla`/`.als`/`.props` files as L2 (operational semantics). However, formal models in `.planning/formal/` are reasoning artifacts (L3) — they encode system properties and design rationale, not operational behavior traces. Only models in `semantics/` subdirectory should be L2.
