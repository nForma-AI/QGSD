---
phase: quick-309
plan: 01
status: Complete
---

# Quick Task 309: Fix 2 XState model gaps identified by Gate A grounding check

## What was done

Fixed 2 Gate A per-model grounding failures that caused l1_to_l3 residual=1.

### Root cause
Two Alloy models (`v8-coverage-digest.als` for TC-01 and `hypothesis-measurement.als` for H2M-01) lacked both:
1. `@requirement` annotations in the model files (needed for formal-test-sync to link them)
2. Unit test coverage for their backing requirements

### Changes
1. **Added `@requirement` annotations** to both Alloy model files so extract-annotations.cjs can link them to their requirements
2. **Added 3 unit tests for TC-01** in `bin/nf-solve.test.cjs` testing `digestV8Coverage()` — compact format conversion, null safety, boolean marker fallback
3. **Created `bin/hypothesis-measure.test.cjs`** with 7 unit tests for H2M-01 testing `compareAssumption()` — CONFIRMED, VIOLATED, UNMEASURABLE verdicts, scoreboard matching, schema compliance

### Results
- Gate A: 192/192 explained (was 190/192), model_gap: 0 (was 2)
- wiring_evidence_score: 1.0 (was 0.9896)
- All 10 new tests pass
- unit-test-coverage.json: TC-01 and H2M-01 now `covered: true`
- traceability-matrix.json: 367/367 requirements covered (100%)

## Files modified
- `bin/nf-solve.test.cjs` — added 3 TC-01 tests with `@requirement TC-01` annotations
- `bin/hypothesis-measure.test.cjs` — new file, 7 H2M-01 tests with `@requirement H2M-01` annotations
- `.planning/formal/alloy/v8-coverage-digest.als` — added `@requirement TC-01` annotation
- `.planning/formal/alloy/hypothesis-measurement.als` — added `@requirement H2M-01` annotation
- `.planning/formal/unit-test-coverage.json` — regenerated (TC-01, H2M-01 now covered)
- `.planning/formal/traceability-matrix.json` — regenerated (367/367 covered)
- `.planning/formal/formal-test-sync-report.json` — regenerated
