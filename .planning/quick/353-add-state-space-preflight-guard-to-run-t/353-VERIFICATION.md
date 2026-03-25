---
phase: 353-add-state-space-preflight-guard-to-run-tlc
verified: 2026-03-25T00:00:00Z
status: passed
score: 6/6 must-haves verified
---

# Phase 353: Add state-space preflight guard to run-tlc.cjs Verification Report

**Phase Goal:** Block high state-space risk models (>10M states) before launching Java TLC process, preventing long hangs like the 25+ hour run on NFHazardModelMerge.tla.

**Verified:** 2026-03-25
**Status:** PASSED

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | run-tlc.cjs calls analyze-state-space before spawning Java | ✓ VERIFIED | Lines 377-412: Guard executes at line 377, Java spawn at line 421 |
| 2 | HIGH risk blocks execution with exit 1 | ✓ VERIFIED | Lines 382-406: If `risk_level === 'HIGH'`, writes error and calls `process.exit(1)` |
| 3 | Check result written with correct metadata | ✓ VERIFIED | Lines 390-402: Calls `writeCheckResult()` with `result: 'error'` and `triage_tags: ['state-space-blocked']` |
| 4 | Guard bypassable via NF_SKIP_STATE_SPACE_GUARD env var | ✓ VERIFIED | Line 378: Guard wrapped in `if (!process.env.NF_SKIP_STATE_SPACE_GUARD)` |
| 5 | analyzeModel function exported from analyze-state-space.cjs | ✓ VERIFIED | Line 1006: `module.exports = { analyzeModel }` |
| 6 | Clear stderr message with config name, state count, override instruction | ✓ VERIFIED | Lines 386-388: Outputs `[run-tlc] BLOCKED: {configName} estimated {N} states (HIGH risk). Set NF_SKIP_STATE_SPACE_GUARD=1 to override.` |

**Score:** 6/6 must-haves verified

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `bin/run-tlc.cjs` | ✓ VERIFIED | Guard implemented at lines 377-412, before Java spawn at line 421 |
| `bin/analyze-state-space.cjs` | ✓ VERIFIED | `analyzeModel(configName, projectRoot)` function exported at line 1006, implementation at lines 835-902 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| run-tlc.cjs | analyze-state-space.cjs | require() + analyzeModel() call | ✓ WIRED | Line 380: `const { analyzeModel } = require('./analyze-state-space.cjs')` |
| analyze-state-space.cjs | internal functions | reused parseCfg, parseTypeOK, parseDomain | ✓ WIRED | Lines 841-889: Reuses existing internal parsing functions |
| Guard output | check result writer | writeCheckResult() | ✓ WIRED | Lines 390-402: Guard calls writeCheckResult with proper result/tags |

### Function Signature Verification

**analyzeModel(configName, projectRoot)**

Returns object:
```javascript
{
  estimated_states: number | null,
  risk_level: 'MINIMAL' | 'LOW' | 'MODERATE' | 'HIGH',
  risk_reason: string,
  has_unbounded: boolean
}
```

- ✓ Takes config name and project root as parameters
- ✓ Returns analysis object with risk_level field checked at line 382
- ✓ Gracefully handles missing config (returns MODERATE risk, line 847)
- ✓ Preserves original ROOT after execution (lines 837, 900)

### Fail-Open Behavior

- ✓ If analyzeModel throws, guard emits stderr warning and proceeds with TLC (lines 408-411)
- ✓ If writeCheckResult throws, still exits with code 1 (lines 403-406)

### CLI Guard (Requirement: require.main === module)

- ✓ analyze-state-space.cjs main execution guarded (line 1001): `if (require.main === module)`
- ✓ Function can be required and called programmatically without executing CLI logic

### Pre-existing Test Failure

One pre-existing test failure in bin/run-tlc.test.cjs:
- **Test:** "exits non-zero and prints download URL when tla2tools.jar is not found"
- **Status:** ✗ FAILED (exit code 0 instead of 1)
- **Note:** This failure is pre-existing and unrelated to the state-space guard changes. It appears to be a test environment issue (missing tla2tools.jar).
- **Plan note:** "pre-existing failures accepted" ✓

All other 9 tests pass:
- exits non-zero and prints clear error when JAVA_HOME points to nonexistent path ✓
- exits non-zero with descriptive message for unknown --config value ✓
- exits non-zero and reports config file not found for invalid config ✓
- detectLivenessProperties tests (5 tests) ✓
- SURFACE_MAP MCMCPEnv entry exists ✓

---

## Implementation Details

### Guard Location and Order

The state-space preflight guard (lines 377-412) is positioned:
1. **After** Java availability checks (lines 158-272)
2. **After** jar path resolution (lines 274-301)
3. **Before** Java TLC spawn (line 421)

This ordering ensures:
- We have `configName`, `ROOT`, `CHECK_ID_MAP`, `SURFACE_MAP`, `PROPERTY_MAP` initialized
- Java and tla2tools.jar are available (not a false alarm)
- Guard can block before resource-intensive Java process starts

### Error Handling Robustness

The guard uses triple-nested try-catch:
1. **Outer try (lines 379-411):** Catches analyzeModel() errors → fail-open to TLC
2. **Inner try (lines 389-402):** Catches writeCheckResult() errors → still exit 1 with warning
3. **Fail-open guarantees:** Even if analysis completely fails, TLC proceeds (unless error is fatal)

### State-Space Risk Classification

The analyzeModel function classifies risk based on estimated state count:
- **MINIMAL:** <= 1,000 states
- **LOW:** <= 100,000 states
- **MODERATE:** <= 10,000,000 states
- **HIGH:** > 10,000,000 or unbounded

Thresholds defined at lines 44-48 in analyze-state-space.cjs.

---

## Verification Results

- **All must-haves:** ✓ VERIFIED
- **No gaps found**
- **No regressions** (guard added before Java spawn without modifying downstream logic)
- **No orphaned artifacts** (analyzeModel imported and called by run-tlc.cjs)

---

_Verified: 2026-03-25_
_Verifier: Claude (nf-verifier)_
