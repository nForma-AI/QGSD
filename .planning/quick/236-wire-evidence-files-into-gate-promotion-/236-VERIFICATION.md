---
phase: quick-236
verified: 2026-03-09T08:10:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Quick 236: Wire Evidence Files into Gate Promotion Pipeline Verification Report

**Phase Goal:** Wire evidence files into gate promotion pipeline -- fix all 5 gaps: evidence-aware promotion criteria, per-model gates in run-formal-verify, git-heatmap in convergence, normal-usage trace processing, autoClose readiness checks
**Verified:** 2026-03-09T08:10:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Gate promotion considers evidence file readiness (not just source_layer + check-results) | VERIFIED | `computeEvidenceReadiness()` at line 169 scores 5 evidence files; ADVISORY->SOFT_GATE requires score>=1 (line 258), SOFT_GATE->HARD_GATE requires score>=3 (line 273); `validateCriteria()` in promote-gate-maturity.cjs enforces thresholds (lines 77-82) |
| 2 | compute-per-model-gates runs as part of run-formal-verify pipeline | VERIFIED | STATIC_STEPS entry at line 418-423 of run-formal-verify.cjs: `{ tool: 'gates', id: 'gates:per-model', type: 'node', script: 'compute-per-model-gates.cjs', args: ['--json'], nonCritical: true }` |
| 3 | Git heatmap residual contributes to the convergence grand total | VERIFIED | `hmTotal2 = finalResidual.heatmap_total` at line 3014; `grandTotal = total + rdTotal + layerTotal + hmTotal2` at line 3015; heatmap subtotal display at line 2917. Correctly NOT added to convergence loop prevTotal. |
| 4 | Evidence files are refreshed from traces during nf-solve runs | VERIFIED | `spawnTool('bin/refresh-evidence.cjs', ['--json'])` at line 3373 of nf-solve.cjs, placed before convergence for-loop, guarded by `!reportOnly` |
| 5 | autoClose checks evidence readiness before reporting promotion-ready status | VERIFIED | Evidence readiness block at lines 2749-2779 of nf-solve.cjs: reads 5 evidence files, counts populated ones, pushes action warning if <3, success message if >=3 |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/compute-per-model-gates.cjs` | Evidence-aware gate evaluation | VERIFIED | 341 lines; `computeEvidenceReadiness()` function, `--skip-evidence` flag, evidence thresholds in promotion logic |
| `bin/run-formal-verify.cjs` | Per-model gates step in STATIC_STEPS | VERIFIED | `gates:per-model` entry at lines 418-423 |
| `bin/nf-solve.cjs` | Heatmap in convergence + evidence readiness in autoClose | VERIFIED | `hmTotal2` in grandTotal (line 3015), evidence readiness check (lines 2749-2779), refresh-evidence call (line 3373) |
| `bin/refresh-evidence.cjs` | Lightweight evidence refresh from recent traces | VERIFIED | 84 lines; runs 4 generators via spawnSync, fail-open, JSON output support |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| bin/compute-per-model-gates.cjs | .planning/formal/evidence/*.json | loadJSON reads evidence files | WIRED | `computeEvidenceReadiness()` reads instrumentation-map, state-candidates, failure-taxonomy, trace-corpus-stats, proposed-metrics from EVIDENCE_DIR |
| bin/run-formal-verify.cjs | bin/compute-per-model-gates.cjs | STATIC_STEPS entry with type: node | WIRED | Entry at line 418-423 with script: 'compute-per-model-gates.cjs' |
| bin/nf-solve.cjs | bin/refresh-evidence.cjs | spawnTool call before convergence loop | WIRED | `spawnTool('bin/refresh-evidence.cjs', ['--json'])` at line 3373, guarded by `!reportOnly` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GATE-01 | 236-PLAN | Gate A grounding evaluation | SATISFIED | evaluateGateA() with evidence-aware promotion |
| GATE-02 | 236-PLAN | Gate B abstraction evaluation | SATISFIED | evaluateGateB() with evidence-aware promotion |
| GATE-03 | 236-PLAN | Gate C validation evaluation | SATISFIED | evaluateGateC() with evidence-aware promotion |
| GATE-04 | 236-PLAN | Gate maturity promotion pipeline | SATISFIED | Evidence thresholds in validateCriteria(), per-model step in run-formal-verify |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns detected |

### Human Verification Required

None required. All verification is programmatic -- evidence scoring, pipeline wiring, and convergence logic are fully verifiable via code inspection.

---

_Verified: 2026-03-09T08:10:00Z_
_Verifier: Claude (nf-verifier)_
