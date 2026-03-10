---
task: 254
title: "Review observe-pipeline extraction and README per-model gates section"
date: 2026-03-10
status: COMPLETE
issues_found: 0
---

# Quick Task 254: Code Review Summary

## Objective
Code review of the observe-pipeline extraction and related command updates to ensure:
1. Handler registration correctness
2. Edge case handling
3. Test coverage completeness
4. Command integration (solve-diagnose.md and observe.md)
5. README accuracy

## Review Status
**PASS** — All review points verified. No critical issues found.

---

## Task 1: Handler Registration and Edge Case Handling

### Handler Registration Correctness
- **✓ Handler names match exports** (observe-handlers.cjs lines 374-396):
  - `handleGitHub` → registered as 'github' ✓
  - `handleSentry` → registered as 'sentry' ✓
  - `handleSentryFeedback` → registered as 'sentry-feedback' (HYPHENATED, not underscore) ✓✓✓
  - `handleBash` → registered as 'bash' ✓
  - `handleInternal` → registered as 'internal' ✓
  - `handleUpstream` → registered as 'upstream' ✓
  - `handleDeps` → registered as 'deps' ✓

- **✓ Optional handlers use typeof check** (observe-pipeline.cjs lines 52-60):
  - `handlePrometheus` checked with `typeof handlers.handlePrometheus === 'function'` ✓
  - `handleGrafana` checked with `typeof handlers.handleGrafana === 'function'` ✓
  - `handleLogstash` checked with `typeof handlers.handleLogstash === 'function'` ✓
  - Pattern prevents "handler not found" errors on missing handlers ✓

### Edge Case Handling in refreshDebtLedger()

- **✓ Config error path** (lines 82-88): Returns zero-state with `configError` field ✓

- **✓ Source filtering logic** (lines 91-103):
  - Source filter applied correctly (line 94-96) ✓
  - Internal source injected ONLY if not already present (line 99) ✓
  - Respects sourceFilter constraint (line 100: if filter exists and isn't 'internal', skip injection) ✓
  - Handles edge case: filter='internal' but no internal source → still injects (lines 100-101) ✓

- **✓ Empty sources handling** (lines 105-110): Returns zero-state when sources.length === 0 ✓

- **✓ Registry clearHandlers() call** (line 41): Called BEFORE first registerHandler() ✓
  - Prevents "already registered" errors on repeated calls (idempotent pattern) ✓

- **✓ Debt write conditional** (line 127): Only writes if `!opts.skipDebtWrite && observations.length > 0` ✓

- **✓ Return contract** (lines 131-136):
  - Returns: `{ written, updated, errors, merged, linked, observations, results, sourceCount }`
  - Matches solve-diagnose.md expectation (destructures { written, updated, sourceCount }) ✓
  - Includes all optional fields: errors, merged, linked for full traceability ✓

---

## Task 2: Test Coverage

### Test Infrastructure Verification

**Test file:** bin/observe-pipeline.test.cjs (71 lines)

**Test Results:** ✓ ALL TESTS PASS
```
✔ observe-pipeline exports (1.574792ms)
  ✔ exports refreshDebtLedger as async function
  ✔ exports registerAllHandlers as function
  ✔ exports _nfBin as function

✔ registerAllHandlers (1.983375ms)
  ✔ registers core handlers without throwing
  ✔ can be called twice without "already registered" error

✔ refreshDebtLedger (15245.167125ms)
  ✔ returns zero-state when no config exists and source filter blocks all
  ✔ always injects internal source when no filter or filter=internal
```

### Coverage Analysis

**Tested paths:**
- ✓ Export verification (all 3 exports tested)
- ✓ Handler registration (5+ core handlers found)
- ✓ Idempotency (registerAllHandlers() can be called twice)
- ✓ Edge case: nonexistent source filter → zero-state
- ✓ Edge case: internal source injection with filter='internal'

**Dependencies validated:**
- ✓ bin/observe-registry.cjs (exports: registerHandler, clearHandlers, listHandlers, dispatchAll)
- ✓ bin/observe-handlers.cjs (all 7 core handlers + 3 optional handlers exported)
- ✓ bin/observe-config.cjs (loadObserveConfig function available)
- ✓ bin/observe-debt-writer.cjs (writeObservationsToDebt function available)

**Missing test coverage (low-severity, not blocker):**
- No explicit test for config error path → zero-state (implicitly tested by filter test but not isolated)
- No test for successful debt write happy path (debt write is mocked/skipped in tests)
- No test for sourceCount accuracy with multiple sources (only tested with zero or one)

**Assessment:** Test coverage is sufficient for core functionality. Edge cases and idempotency are verified. Missing tests are refinements, not critical gaps.

---

## Task 3: Command Integration Verification

### solve-diagnose.md Integration

**Step 0d (lines 119-154):**
- ✓ References "shared observe pipeline (bin/observe-pipeline.cjs)" — correct
- ✓ Calls `refreshDebtLedger()` with correct destructuring: `{ written, updated, sourceCount }` (line 133)
- ✓ Return value contract matches observe-pipeline.cjs exports (lines 131-136)
- ✓ Logs structured output: `"Step 0d: Observe refresh complete — {written} new, {updated} updated debt entries (from {sourceCount} sources)"`
- ✓ Handles config error gracefully (line 83-88: fail-open pattern)
- ✓ Filters debt to targets if provided (line 151)

### observe.md Integration

**Step 3 (lines 83-90):**
- ✓ Calls `registerAllHandlers()` from observe-pipeline.cjs — correct
- ✓ Expects registry object with `dispatchAll()` method — correct
- ✓ Comment states "Use the shared pipeline to register ALL handlers" — accurate

**Step 4 (lines 99-106):**
- ✓ Calls `dispatchAll(config.sources, ...)` from registry — correct
- ✓ Uses output from Step 3's registerAllHandlers() ✓
- ✓ No duplicate registration (handlers already registered in Step 3) ✓

### Integration Consistency

**Critical insight verified:**
- solve-diagnose.md Step 0d runs the FULL pipeline: `refreshDebtLedger()` internally calls `registerAllHandlers()` (line 113) + `dispatchAll()` (line 118) + writes debt
- observe.md SPLITS registration from dispatch: Step 3 registers, Step 4b adds MCP bridge, then dispatch happens
- Both use the SAME `registerAllHandlers()` function ✓
- Both use the SAME handler names ✓
- **sentry-feedback is hyphenated everywhere** — NO underscore variants found ✓✓✓

---

## Task 4: README Per-Model Gates Section Accuracy

### Conceptual Accuracy

- ✓ **Line 480:** "bridges specs with observability" — correct philosophy
- ✓ **Lines 484-491:** Three gates accurately described:
  - Gate A (Grounding): emission points for model events — correct
  - Gate B (Abstraction): model traces to requirement — correct
  - Gate C (Validation): test recipes for failure modes — correct
- ✓ **Line 492:** "Gate A is the observability gate" — correct
- ✓ **Line 496:** "Models earn enforcement authority through evidence, not time" — correct principle

### Self-Improvement Loop (lines 498-535)

**Script verification:**
- ✓ `bin/instrumentation-map.cjs` exists (checked with ls)
- ✓ `bin/state-candidates.cjs` exists
- ✓ `bin/analyze-assumptions.cjs` exists
- ✓ `bin/compute-per-model-gates.cjs` exists
- ✓ `bin/refresh-evidence.cjs` exists

**Loop steps accurately described:**
- ✓ Step 1: Models start ADVISORY (correct per /nf:close-formal-gaps)
- ✓ Step 2: Three tools produce gaps ("Add gauge", "4 vocabulary actions have no emission point")
- ✓ Step 3: "YOU WIRE THE INSTRUMENTATION" — user adds emission points
- ✓ Step 4: Promotion path ADVISORY → SOFT_GATE → HARD_GATE (correct)
- ✓ Step 5: Enforcement model (SOFT_GATE = warnings, HARD_GATE = blocks)
- ✓ Step 6: solve loop feeds back into gate improvement
- ✓ Step 7: Continuous improvement cycle

### Pipeline Output (lines 537-546)

**Verified existence:**
- ✓ `.planning/formal/evidence/` directory exists
- ✓ `.planning/formal/gates/` directory exists
- ✓ Files listed are accurate:
  - `evidence/instrumentation-map.json` ✓
  - `evidence/state-candidates.json` ✓
  - `evidence/proposed-metrics.json` ✓
  - `gates/per-model-gates.json` ✓
  - `gates/gate-a-grounding.json` ✓
  - `model-complexity-profile.json` ✓

- ✓ **Line 551:** `refresh-evidence.cjs` is correct entry point (verified as existing)

### Integration with /nf:observe and /nf:solve

- ✓ **Line 554:** "/nf:observe surfaces unimplemented metrics as drifts" — correct per observe.md design
- ✓ **Line 554:** "/nf:solve runs observe data-gathering pipeline inline during Step 0d, refreshing debt ledger" — verified by solve-diagnose.md Step 0d analysis above ✓

### Philosophy Section (line 556)

- ✓ "Formal specs declare what to observe, not bottom-up" — correct inversion principle
- ✓ "The gap is mechanical wiring" — accurate post-extraction (handlers + registry + debt writer are the wiring)

**Assessment:** README Per-Model Gates section is accurate and well-documented. All referenced scripts and files exist. Philosophy is sound.

---

## Summary of Findings

| Area | Status | Notes |
|------|--------|-------|
| Handler naming | ✓ PASS | sentry-feedback is hyphenated everywhere (CRITICAL requirement verified) |
| Handler registration | ✓ PASS | All 7 core + 3 optional handlers registered correctly with typeof guards |
| Edge cases | ✓ PASS | Config errors, empty sources, repeated calls all handled correctly |
| Test coverage | ✓ PASS | Core paths tested, all tests pass, idempotency verified |
| solve-diagnose integration | ✓ PASS | Step 0d correctly calls refreshDebtLedger() |
| observe integration | ✓ PASS | Step 3 correctly registers handlers, Step 4 uses registry |
| Integration consistency | ✓ PASS | Both use same pipeline and handler names |
| README accuracy | ✓ PASS | All scripts exist, directories verified, concepts accurate |

---

## Critical Points Confirmed

1. **Naming consistency:** The breaking point from the review brief — `sentry-feedback` with hyphen (NOT underscore) — appears everywhere:
   - observe-handlers.cjs line 377: `handleSentryFeedback` export
   - observe-pipeline.cjs line 45: `registry.registerHandler('sentry-feedback', ...)`
   - Tests pass without naming errors

2. **ALL handlers registered:** observe-pipeline.cjs registerAllHandlers() includes:
   - Core: github, sentry, sentry-feedback, bash, internal, upstream, deps (7)
   - Optional: prometheus, grafana, logstash (3 with typeof guards)

3. **Step 3 → Step 4 flow works:** observe.md Step 3 calls registerAllHandlers() → returns registry → Step 4 calls registry.dispatchAll()

4. **Documentation matches implementation:** README Per-Model Gates section accurately describes gate system, references correct scripts and files

---

## Recommendations

**No blocking issues.** The extraction is complete and correct. Ready for production use by both `/nf:observe` and `/nf:solve-diagnose`.

**Optional improvements for future (not blockers):**
1. Add explicit test for config error path (currently implicit)
2. Add test for successful debt write happy path
3. Add test for sourceCount accuracy with multiple sources (refinement only)

These are test coverage refinements, not correctness issues.
