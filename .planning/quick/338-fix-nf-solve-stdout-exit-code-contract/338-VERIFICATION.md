---
task: quick-338
verified: 2026-03-24T10:15:00Z
status: passed
score: 3/3 must-haves verified
---

# Quick Task 338: Fix nf-solve Exit-Code Contract Verification Report

**Task Goal:** Fix nf-solve.cjs exit-code contract — exit 0 on successful diagnostic regardless of residual, add has_residual JSON field.

**Verified:** 2026-03-24T10:15:00Z

**Status:** PASSED

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | nf-solve.cjs exits 0 on successful diagnostic even when residual > 0 | ✓ VERIFIED | Line 5246: `const exitCode = 0;` (unconditional). Exit code used in process.exit() calls (lines 5253, 5256). All 101 tests pass. |
| 2 | JSON output includes has_residual boolean field | ✓ VERIFIED | Line 4678 in formatJSON: `has_residual: truncatedResidual.total > 0,`. Tests TC-JSON-5 and TC-JSON-6 verify field presence and correctness. |
| 3 | Existing behavior for non-JSON (report) mode is unchanged | ✓ VERIFIED | formatReport still called (line 5235), no changes. Report mode tests (TC-CONV-1) pass. Non-JSON output path unaffected. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/nf-solve.cjs` | Exit code logic updated to always 0; has_residual field added to formatJSON | ✓ VERIFIED | Line 5246: `const exitCode = 0;` (changed from conditional). Line 4678: `has_residual: truncatedResidual.total > 0,` added to JSON return object. |
| `bin/nf-solve.test.cjs` | Tests for exit-code contract and has_residual field | ✓ VERIFIED | TC-JSON-5: Tests `has_residual=false` when total===0. TC-JSON-6: Tests `has_residual=true` when total>0. Both pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| formatJSON output | JSON stdout | has_residual field | ✓ WIRED | formatJSON includes has_residual (line 4678); jsonObj = formatJSON() (line 5239); JSON stringified and output (line 5241, 5247). |
| exit logic | process.exit | exitCode assignment | ✓ WIRED | const exitCode = 0 (line 5246); used in process.exit() calls (lines 5253, 5256). Always 0 on successful diagnostic. |

### Test Results

**Test Suite:** `node --test bin/nf-solve.test.cjs`

```
ℹ tests 101
ℹ pass 101
ℹ fail 0
```

**New Tests:**
- ✓ TC-JSON-5: formatJSON includes has_residual=false when total is 0
- ✓ TC-JSON-6: formatJSON includes has_residual=true when total > 0

**Existing Tests:** All 100 existing tests continue to pass (no regressions).

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| INTENT-01 | Not applicable | Referenced in plan but INTENT-01 is about quick task approach blocks, not this specific implementation. Task is autonomous and does not trigger workflow derivation. |

### Implementation Details

**Change 1: Exit Code (Line 5246)**

```javascript
// Before: const exitCode = finalResidual.total > 0 ? 1 : 0;
// After:
const exitCode = 0;
```

A successful diagnostic (reaching this point in the code) always exits 0. Callers can detect residual programmatically via the `has_residual` JSON field instead of relying on exit codes.

**Change 2: has_residual Field (Line 4678)**

```javascript
return {
  solver_version: '1.2',
  generated_at: new Date().toISOString(),
  fast_mode: fastMode ? true : false,
  iteration_count: iterations.length,
  max_iterations: maxIterations,
  converged: converged,
  has_residual: truncatedResidual.total > 0,  // NEW FIELD
  residual_vector: truncatedResidual,
  // ... rest of object
};
```

The `has_residual` boolean is true when `residual_vector.total > 0`, allowing callers to programmatically detect whether residual remains.

### Why This Achieves the Goal

**Clean Piping:** With exit code 0 on successful diagnostics, the JSON output can be safely piped to downstream consumers (observe-handler, orchestrators) without false failure signals.

**Programmatic Detection:** The `has_residual` field enables callers to check for residual via JSON parsing rather than exit code checking, which is more robust and explicit.

**Backward Compatibility:** Report mode (non-JSON output) is unchanged. Existing code consuming report output continues to work. Only callers expecting exit code 1 on residual will see a change, which is the intended fix.

---

_Verified: 2026-03-24T10:15:00Z_
_Verifier: Claude (nf-verifier)_
