---
phase: quick-379
verified: 2026-04-05T22:30:00Z
status: passed
score: 8/8 must-haves verified
formal_check:
  passed: 5
  failed: 0
  skipped: 0
  counterexamples: []
---

# Quick Task 379: Formal Model Staleness Detection Verification Report

**Task Goal:** Issue #46: Add formal model staleness detection via content hashing. Compute SHA-256 hashes of model files and their described source files, store in model-registry.json, detect MODEL_STALE residuals during nf-solve diagnostic sweep, surface in solve report, and ensure graceful degradation for entries without hashes.

**Verified:** 2026-04-05T22:30:00Z
**Status:** PASSED
**Score:** 8/8 must-haves verified

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SHA-256 content hashes are computed for each model file in model-registry.json | ✓ VERIFIED | `crypto.createHash('sha256')` in bin/check-model-staleness.cjs line 17; hashFile() function computes model hashes |
| 2 | Source files referenced in model header comments are parsed and hashed | ✓ VERIFIED | parseSourceFiles() extracts paths from `-- Source:` or `* Source:` headers (lines 28-42); source hashes computed for each file found |
| 3 | MODEL_STALE residuals are detected when model or source hashes differ from stored values | ✓ VERIFIED | comparison logic at lines 136-176: model_changed when hashes differ, source_changed when any source hash diverges |
| 4 | Staleness appears as an informational signal in the solve-report table | ✓ VERIFIED | "Model Stale (drift)" row appears in commands/nf/solve-report.md line 88 with {N}, {M}, {delta} columns |
| 5 | Entries without stored hashes degrade gracefully (skip, no error) | ✓ VERIFIED | Missing registry returns skipped=true (line 56-63); missing model files continue loop (line 94); missing source files skipped silently (lines 112-114) |
| 6 | First run populates hashes without flagging anything stale | ✓ VERIFIED | When content_hashes absent: first_hash_count incremented (line 127), NOT added to stale array (line 132 continue) |
| 7 | Diagnostic sweep is read-only -- hashes only written with explicit --update-hashes flag | ✓ VERIFIED | Default updateHashes=false (line 51); --dry-run forces updateHashes=false (line 221); writes only when updateHashes=true AND modified (line 180) |
| 8 | model_stale appears in formatReport() CLI output alongside other diagnostic rows | ✓ VERIFIED | diagRows array at line 4949 includes `{ label: 'MS (Model Stale)', key: 'model_stale' }` |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/check-model-staleness.cjs` | Standalone staleness detection script with checkStaleness export | ✓ VERIFIED | 266 lines, exports checkStaleness() at line 260; CLI entry point at lines 201-258 |
| `bin/check-model-staleness.test.cjs` | Unit tests for staleness detection, 40+ lines, all tests pass | ✓ VERIFIED | 272 lines; 8 tests covering all scenarios; all passed: missing registry, hash computation, first-run, model-changed, source-changed, missing source, read-only mode, update mode |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| bin/nf-solve.cjs | bin/check-model-staleness.cjs | spawnTool() with --dry-run | ✓ WIRED | Line 3857: `spawnTool('bin/check-model-staleness.cjs', ['--json', '--dry-run'])` ensures read-only invocation |
| bin/nf-solve.cjs | formatReport() diagRows | model_stale entry in diagnostic rows | ✓ WIRED | Line 4949: `{ label: 'MS (Model Stale)', key: 'model_stale' }` renders in CLI table |
| commands/nf/solve-report.md | model_stale signal | Table row and expansion guidance | ✓ WIRED | Line 88: "Model Stale (drift)" row; line 104: expansion guidance; lines 119-124: example output format |

### Integration Points Verified

| Integration | Location | Status | Details |
|-------------|----------|--------|---------|
| Sweep function invocation | bin/nf-solve.cjs:4262 | ✓ WIRED | `const model_stale = checkLayerSkip('model_stale') \|\| sweepModelStaleness()` |
| Timing telemetry | bin/nf-solve.cjs:4263 | ✓ WIRED | `_timing.model_stale = { duration_ms: ..., skipped: ... }` |
| Informational bucket | bin/nf-solve.cjs:4299 | ✓ WIRED | `(model_stale.residual >= 0 ? model_stale.residual : 0)` added to informational sum |
| Return object | bin/nf-solve.cjs:4330 | ✓ WIRED | `model_stale` included in computeResidual() return |
| Module exports | bin/nf-solve.cjs:6150 | ✓ WIRED | `sweepModelStaleness` exported for testing/reuse |

### Test Coverage

| Test | Status | Evidence |
|------|--------|----------|
| missing registry returns skipped result | ✓ PASSED | Test 1 verifies graceful degradation |
| hash computation for mock model with Source: header | ✓ PASSED | Test 2 verifies parsing and hashing |
| first run (no content_hashes) returns count, zero stale | ✓ PASSED | Test 3 verifies first-run behavior |
| changed model content is detected as stale | ✓ PASSED | Test 4 verifies model_changed detection |
| changed source content is detected as stale | ✓ PASSED | Test 5 verifies source_changed detection |
| graceful degradation for missing source file | ✓ PASSED | Test 6 verifies silent skip of missing sources |
| default mode (no --update-hashes) is read-only | ✓ PASSED | Test 7 verifies registry unchanged after checkStaleness(false) |
| --update-hashes mode writes content_hashes | ✓ PASSED | Test 8 verifies content_hashes written when flag set |

All 8 tests pass (9/9 node --test framework output; test duration 81.26ms total).

### Formal Verification

**Status: PASSED**

| Checks | Passed | Skipped | Failed |
|--------|--------|---------|--------|
| Total | 5 | 0 | 0 |

All formal properties in related modules (breaker, quorum, solve-convergence) passed their invariant checks. No counterexamples found. The implementation:

- **Breaker (MonitoringReachable):** Model staleness sweep does not affect breaker state transitions — it is informational only and cannot trigger oscillation detection.
- **Quorum (EventualConsensus):** Model staleness does not affect quorum voting or consensus — it is computed post-consensus as a diagnostic signal.
- **Solve-Convergence (EventualConvergence):** Model staleness contributes to informational residual only, not to automatable or manual buckets that gate convergence.

### Anti-Patterns Found

| Category | Finding | Severity | Impact |
|----------|---------|----------|--------|
| Null returns | hashFile(), parseSourceFiles() return null for missing files | ℹ️ INFO | Intentional; enables fail-open graceful degradation |
| Error handling | try/catch wrapping all file I/O, process.exit(0) on error | ℹ️ INFO | Correct fail-open pattern; verified in security rules |
| Console output | console.log() for JSON output in CLI | ℹ️ INFO | Correct usage; stdout is the data channel, stderr for diagnostics |

No blockers, warnings, or stubs detected.

### Execution Context

**Implementation commits:**
- 6ab08951 feat(quick-379): add check-model-staleness.cjs with SHA-256 content hashing
- 95646b93 feat(quick-379): add sweepModelStaleness to nf-solve diagnostic sweep
- bb660b30 feat(quick-379): surface MODEL_STALE in solve-report informational signals table
- 7ae0fe01 docs(quick-379): Issue #46: Add formal model staleness detection via content hashing

**Verification commands executed:**
```bash
node --test bin/check-model-staleness.test.cjs
# ✔ 8 tests passed (81.26ms)

node bin/check-model-staleness.cjs --json --dry-run
# {"stale":[],"total_checked":229,"total_stale":0,"first_hash_count":229}

# Read-only verification: registry unchanged after default mode
sha256sum .planning/formal/model-registry.json
# (hash before) == (hash after) ✓

grep -n "sweepModelStaleness" bin/nf-solve.cjs
# Lines 3848 (function), 4262 (invocation), 6150 (export)

grep "MS (Model Stale)" bin/nf-solve.cjs
# { label: 'MS (Model Stale)', key: 'model_stale' }
```

**Key file states:**
- bin/check-model-staleness.cjs: 266 lines, complete implementation, all error paths covered
- bin/check-model-staleness.test.cjs: 272 lines, 8 comprehensive unit tests
- bin/nf-solve.cjs: sweepModelStaleness() integrated at line 3848, wired into computeResidual() and formatReport()
- commands/nf/solve-report.md: Model Stale row added to informational table with expansion guidance

## Summary

All 8 must-haves verified. The formal model staleness detection feature is complete and working:

✓ **Hashing:** SHA-256 content hashing for models and source dependencies
✓ **Detection:** Staleness identified when hashes diverge from stored values
✓ **Graceful degradation:** Missing registries and files handled without errors
✓ **Read-only default:** Diagnostic sweep uses `--dry-run` to prevent accidental writes
✓ **Explicit baseline:** `--update-hashes` flag for intentional hash population
✓ **Integration:** wired into nf-solve as informational signal, appears in formatReport() CLI output
✓ **Reporting:** Model Stale row in solve-report with expansion guidance for non-zero residuals
✓ **Testing:** 8 comprehensive unit tests covering all scenarios; all passing

Formal verification passed with 5/5 checks passing and 0 counterexamples.

---

_Verified: 2026-04-05T22:30:00Z_
_Verifier: Claude (nf-verifier)_
