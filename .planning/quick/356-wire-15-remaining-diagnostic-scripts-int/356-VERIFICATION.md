---
phase: quick-356
verified: 2026-03-25T00:00:00Z
status: passed
score: 6/6 must-haves verified
---

# Phase quick-356: Wire 15 Remaining Diagnostic Scripts into nf-solve.cjs — Verification Report

**Phase Goal:** Wire 15 diagnostic scripts into nf-solve.cjs as 7 new sweeps + 8 fold enrichments, enabling complete diagnostic coverage in the residual vector and solve report.

**Verified:** 2026-03-25
**Status:** ✓ PASSED
**Score:** 6/6 observable truths verified

## Observable Truths Verification

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 15 diagnostic scripts are invoked by nf-solve.cjs during computeResidual | ✓ VERIFIED | 7 new sweeps defined at lines 3537–3724; 8 folds integrated into existing sweeps (validate-traces, check-trace-schema-drift, aggregate-requirements, baseline-drift, check-spec-sync, annotate-tests, check-coverage-guard, fingerprint-drift, check-liveness-fairness each called via spawnTool or require) |
| 2 | 7 new sweeps produce {residual, detail} objects consistent with existing pattern | ✓ VERIFIED | All 7 sweeps (ConfigHealth, Security, TraceHealth, AssetStaleness, ArchConstraints, DebtHealth, MemoryHealth) return `{residual: N, detail: {...}}` with fail-open fallback `{residual: -1, detail: {skipped: true, reason: ...}}` |
| 3 | 8 folds enrich their host sweeps with additional diagnostic data | ✓ VERIFIED | Each fold wraps in inner try/catch; merges results into host detail object without breaking on fold failure; e.g., sweepReqQuality enriched with aggregate_sync and baseline_drift; sweepFtoC with spec_sync_drift; sweepFtoT with test_annotations; sweepTtoC with coverage_guard_fail; sweepDtoC with fingerprint_drift; sweepFormalLint with liveness_fairness_violations |
| 4 | New sweeps appear in the residual table renderer output | ✓ VERIFIED | Lines 4655–4671: "Diagnostic Health" section renders all 7 rows with labels (CH, SEC, TH, AS, AC, DH, MH) using renderRow() |
| 5 | New automatable sweeps are included in automatable/informational totals | ✓ VERIFIED | Lines 4006–4020: All 7 new sweeps added to informational total (not automatable, as documented in plan); line 4056 returns `informational` in result object |
| 6 | New sweep layer keys appear in DEFAULT_WAVES for autoClose dispatch | ✓ VERIFIED | Line 4320: DEFAULT_WAVES includes all 7 keys: `['f_to_t', 'c_to_f', 't_to_c', 'r_to_f', 'f_to_c', 'r_to_d', 'd_to_c', 'p_to_f', 'per_model_gates', 'req_quality', 'config_health', 'security', 'trace_health', 'asset_stale', 'arch_constraints', 'debt_health', 'memory_health']` |

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `bin/nf-solve.cjs` (sweepConfigHealth) | ✓ VERIFIED | Lines 3537–3557: calls config-audit.cjs, parses JSON, returns {residual: warnings.length + missing.length, detail: {warnings, missing}} |
| `bin/nf-solve.cjs` (sweepSecurity) | ✓ VERIFIED | Lines 3561–3580: calls security-sweep.cjs, returns {residual: findings.length, detail: {findings_count, findings}} |
| `bin/nf-solve.cjs` (sweepTraceHealth) | ✓ VERIFIED | Lines 3584–3629: two-part sweep (validate-traces + check-trace-schema-drift), returns {residual: divergence_count + schema_drift_count, detail: {divergences, schema_drift}} |
| `bin/nf-solve.cjs` (sweepAssetStaleness) | ✓ VERIFIED | Lines 3633–3648: calls check-assets-stale.cjs, returns {residual: exitCode !== 0 ? 1 : 0, detail: {stale, stderr}} |
| `bin/nf-solve.cjs` (sweepArchConstraints) | ✓ VERIFIED | Lines 3652–3667: calls check-bundled-sdks.cjs, returns {residual: violations ? 1 : 0, detail: {violations, output}} |
| `bin/nf-solve.cjs` (sweepDebtHealth) | ✓ VERIFIED | Lines 3671–3691: requires debt-retention.cjs, calls applyRetentionPolicy(), returns {residual: expired_count, detail: {expired, retained}} |
| `bin/nf-solve.cjs` (sweepMemoryHealth) | ✓ VERIFIED | Lines 3695–3724: requires validate-memory.cjs with fallback to spawnTool, returns {residual: issues.length or exitCode check, detail: {issues}} |
| `computeResidual()` return object | ✓ VERIFIED | Lines 4022–4061: includes all 7 new keys (config_health, security, trace_health, asset_stale, arch_constraints, debt_health, memory_health) in return object |
| `informational` total | ✓ VERIFIED | Lines 4006–4020: all 7 sweeps contribute to informational bucket |
| `LAYER_HANDLERS` dispatch map | ✓ VERIFIED | Lines 4309–4315: all 7 diagnostics have no-op handlers (fail-open, no auto-remediation) |
| `DEFAULT_WAVES` array | ✓ VERIFIED | Line 4320: all 7 keys present in wave 1 layers |
| Table renderer "Diagnostic Health" section | ✓ VERIFIED | Lines 4655–4671: renders all 7 rows with correct labels and residual values |

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| sweepConfigHealth, sweepSecurity, sweepTraceHealth, sweepAssetStaleness, sweepArchConstraints, sweepDebtHealth, sweepMemoryHealth | computeResidual | variable assignments lines 3979–3985 | ✓ WIRED | All 7 sweep calls correctly assigned to named variables with checkLayerSkip guards |
| New sweep variables | informational total | addition lines 4014–4020 | ✓ WIRED | All 7 residuals summed into informational bucket |
| New sweep variables | computeResidual return object | lines 4044–4050 | ✓ WIRED | All 7 keys returned in result object |
| New sweep layer keys | DEFAULT_WAVES | line 4320 array elements | ✓ WIRED | All 7 keys present in DEFAULT_WAVES wave 1 layers array |
| New sweep keys | LAYER_HANDLERS dispatch | lines 4309–4315 | ✓ WIRED | All 7 handlers defined (no-op) |
| New sweep keys | table renderer | lines 4658–4671 diagRows | ✓ WIRED | All 7 keys rendered with correct labels |

## Fold Enrichments Verification

| Fold Script | Host Sweep | Integration | Status | Details |
|-------------|-----------|-------------|--------|---------|
| aggregate-requirements | sweepReqQuality | lines 3495–3498 | ✓ WIRED | Calls spawnTool, adds aggregate_sync to detail, increments residual on failure |
| baseline-drift | sweepReqQuality | lines 3501–3514 | ✓ WIRED | Requires baseline-drift.cjs, calls detectBaselineDrift(), merges count into residual and detail |
| check-spec-sync | sweepFtoC | lines 1601–1608 | ✓ WIRED | Calls spawnTool, adds spec_sync_drift to detail, increments residual on failure |
| annotate-tests | sweepFtoT | lines 874–881 | ✓ WIRED | Calls spawnTool, adds test_annotations to detail (informational, no residual impact) |
| check-coverage-guard | sweepTtoC | lines 1183–1189 | ✓ WIRED | Calls spawnTool, sets coverageGuardFail flag, increments residual on failure |
| fingerprint-drift | sweepDtoC | lines 2039–2060 | ✓ WIRED | Requires fingerprint-drift.cjs, calls fingerprintDrift(), merges count into residual and detail |
| check-liveness-fairness | sweepFormalLint | lines 3297–3311 | ✓ WIRED | Calls spawnTool, parses violation count, increments residual on failure |
| check-trace-schema-drift | sweepTraceHealth | lines 3610–3619 | ✓ WIRED | Calls spawnTool, checks exit code, sets schema_drift flag, increments residual |

## Anti-Patterns

No blocking anti-patterns found. All implementations follow the required pattern:
- Every sweep has try/catch with fail-open fallback
- Every fold wraps in inner try/catch, never breaks host sweep
- No console.log-only stubs; all return {residual, detail}
- All spawnTool calls check .ok before parsing
- All require() calls guard with fs.existsSync()

## Syntax & Load Verification

✓ `node -e "require('./bin/nf-solve.cjs'); console.log('Syntax OK')"` — **PASSED** (no syntax errors)

## Summary

All 15 diagnostic scripts are correctly wired into nf-solve.cjs:

- **7 new sweeps** defined, invoked in computeResidual, included in informational total, returned in residual object, rendered in table, present in DEFAULT_WAVES, handled in LAYER_HANDLERS
- **8 fold enrichments** integrate into 6 existing sweeps (ReqQuality×2, FtoC, FtoT, TtoC, DtoC, FormalLint), each wrapped in own try/catch, each merging diagnostic data into host detail without breaking on failure
- **Pattern consistency**: All return {residual, detail} or -1 on failure; all fail-open
- **Table rendering**: "Diagnostic Health" section displays all 7 rows with correct labels
- **Wave dispatch**: All 7 layer keys in DEFAULT_WAVES for autoClose
- **Informational classification**: Correct — none are automatable, all are hygiene/diagnostic

**Goal achievement: COMPLETE** — Phase 356 delivers full diagnostic coverage. The 15 diagnostic scripts now participate fully in the consistency solve loop, their residuals roll up into the informational total, and the solve report table shows complete diagnostic health status.

---
_Verified: 2026-03-25_
_Verifier: Claude (nf-verifier)_
