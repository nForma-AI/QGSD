---
phase: quick-187
verified: 2026-03-06T12:00:00Z
status: passed
score: 6/6 must-haves verified
formal_check:
  passed: 0
  failed: 1
  skipped: 0
  counterexamples: ["convergence:tlc"]
counterexample_override:
  acknowledged_at: 2026-03-06T12:00:00Z
  reason: "Pre-existing convergence:tlc failure unrelated to V8 coverage task. Task declared formal_artifacts: none and did not modify any formal specs or convergence/oscillation code."
  override_by: user
---

# Quick 187: V8 Line-Level Coverage in T->C Sweep Verification Report

**Phase Goal:** Add V8 line-level coverage to T->C sweep and cross-reference with F->T recipe source_files to close the full Formal->Test->Code traceability chain
**Verified:** 2026-03-06
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | sweepTtoC collects V8 line-level coverage when runner is node-test | VERIFIED | Lines 752-756: `mkdtempSync` + `NODE_V8_COVERAGE` env var set on spawnSync. Lines 802-820: coverage JSON read from temp dir after spawn. |
| 2 | crossReferenceFormalCoverage returns per-property coverage ratios against recipe source_files | VERIFIED | Lines 862-937: loads recipes via `loadFormalTestSync()`, builds covered file Set from V8 data, computes ratio per recipe, returns `coverage_ratios` array. |
| 3 | Properties with passing tests but 0% source_file coverage are flagged as false greens | VERIFIED | Lines 907-914: `if (ratio === 0 && hasTest)` pushes to `falseGreens` array with property, test_file, source_files, covered fields. |
| 4 | T->C residual detail includes formal_coverage sub-object when coverage data is available | VERIFIED | Lines 1950-1951 in computeResidual: `t_to_c.detail.formal_coverage = crossReferenceFormalCoverage(t_to_c.detail.v8_coverage)` gated on `v8_coverage` existence. |
| 5 | Coverage collection failure does not break existing T->C pass/fail counting (fail-open) | VERIFIED | Three layers: (1) covDir creation try/catch lines 754-758, (2) coverage read try/catch lines 804-815 with `coverageData = null` fallback, (3) crossReferenceFormalCoverage outer try/catch line 934-936 returns `{ available: false }`. Runtime confirmed: `crossReferenceFormalCoverage(null)` returns `{"available":false}`. |
| 6 | formatReport and formatJSON include F->T->C coverage summary when present | VERIFIED | Lines 2284-2291: formatReport outputs `F->T->C coverage: N/M properties fully traced (K false greens)` when `formal_coverage.available === true`. formatJSON passes through via `t_to_c.detail` object. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/nf-solve.cjs` | V8 coverage collection, crossReferenceFormalCoverage, formatReport/computeResidual integration | VERIFIED | `NODE_V8_COVERAGE` at line 756, function at line 862, export at line 2601. `os` require at line 33. |
| `bin/nf-solve.test.cjs` | Tests for crossReferenceFormalCoverage and V8 coverage integration | VERIFIED | 5 TC-COV tests at lines 588-630. Import at line 34. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| sweepTtoC() | NODE_V8_COVERAGE temp dir | env var set before spawnSync, read after | WIRED | Line 756 sets env, lines 805-811 reads coverage JSON, line 818 cleanup in finally block |
| crossReferenceFormalCoverage() | loadFormalTestSync() recipes | reads recipe.source_files_absolute | WIRED | Line 866 calls `loadFormalTestSync()`, line 893 reads `source_files_absolute` |
| crossReferenceFormalCoverage() | V8 coverage JSON files | reads url field from coverage result entries | WIRED | Lines 871-883: iterates entries, extracts `result[].url`, strips `file://`, checks function ranges for `count > 0` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QUICK-187 | 187-PLAN.md | V8 line-level coverage in T->C sweep with false green detection | SATISFIED | All 6 truths verified, both artifacts substantive and wired |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No TODOs, FIXMEs, placeholders, or empty implementations found |

### Human Verification Required

### 1. End-to-End Coverage Report Output

**Test:** Run `node bin/nf-solve.cjs --report-only` on a project with formal-test-sync recipes and verify the F->T->C coverage line appears in the report.
**Expected:** Report includes a line like `F->T->C coverage: N/M properties fully traced (K false greens)` with accurate counts.
**Why human:** Requires a project with actual formal-test-sync recipes and test files to produce meaningful coverage data.

### Formal Verification

**Status: COUNTEREXAMPLE FOUND (PRE-EXISTING, OVERRIDDEN)**

The `convergence:tlc` failure is a pre-existing issue related to the oscillation breaker's Haiku classifier (`ConvergenceEventuallyResolves` invariant). This task declared `formal_artifacts: none`, did not modify any formal specs or convergence/oscillation code, and is entirely unrelated to V8 coverage collection. Override acknowledged per prompt context.

| Module:Tool | Result |
|-------------|--------|
| convergence:tlc | COUNTEREXAMPLE (pre-existing) |

### Gaps Summary

No gaps found. All must-haves verified. The implementation is substantive across all three levels: artifacts exist, contain real logic (not stubs), and are properly wired together. The V8 coverage collection, cross-referencing logic, fail-open behavior, and report integration all match the plan specification.

---

_Verified: 2026-03-06_
_Verifier: Claude (nf-verifier)_
