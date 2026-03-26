---
phase: 353
plan: quick-353
title: Add state-space preflight guard to run-tlc.cjs
status: completed
completed_at: 2026-03-25T10:05:00Z
duration_ms: 8000
tasks_completed: 2
files_modified: 2
commits: 1
key_decision: Fail-open guard design prevents catastrophic hangs while allowing override for intentional large models
---

# Quick Task 353: Add State-Space Preflight Guard

## Summary

Implemented a pre-flight state-space analyzer guard in run-tlc.cjs that blocks HIGH-risk TLA+ models before launching the Java TLC process. This prevents catastrophic hangs like the 25+ hour run on NFHazardModelMerge.

**One-liner:** State-space risk classifier prevents runaway TLC processes by blocking HIGH-risk models pre-launch while allowing intentional runs via NF_SKIP_STATE_SPACE_GUARD=1.

## Tasks Completed

### Task 1: Export analyzeModel from analyze-state-space.cjs

**Objective:** Make analyzeModel() available as a module API for run-tlc.cjs

**Completed:**
- Extracted internal analyzeModel(tlaRelPath, moduleToCfg) → analyzeModelByPath(tlaRelPath, moduleToCfg)
- Created new analyzeModel(configName, projectRoot) export that:
  - Takes config name (e.g., 'MCsafety') instead of relative TLA path
  - Looks up .cfg file by config name
  - Auto-discovers spec file from cfg header
  - Returns { estimated_states, risk_level, risk_reason, has_unbounded }
- Wrapped main() in `if (require.main === module)` guard
- Exported analyzeModel in module.exports

**Files modified:** bin/analyze-state-space.cjs

**Verification:**
- `require('./bin/analyze-state-space.cjs').analyzeModel` is a function ✓
- CLI mode still works: `node bin/analyze-state-space.cjs --json` produces valid JSON ✓
- Main() only runs when script is executed directly ✓

### Task 2: Add state-space preflight guard to run-tlc.cjs

**Objective:** Block HIGH-risk models before Java spawn, write error check result with triage_tags

**Completed:**
- Added state-space guard after specPath/cfgPath/workers resolution (line 377, before TLC spawn at line 421)
- Guard checks `!process.env.NF_SKIP_STATE_SPACE_GUARD` to allow override
- Calls `analyzeModel(configName, ROOT)` to get risk classification
- On risk_level === 'HIGH':
  - Writes stderr: "[run-tlc] BLOCKED: {config} estimated {N} states (HIGH risk). Set NF_SKIP_STATE_SPACE_GUARD=1 to override."
  - Calls writeCheckResult() with:
    - result: 'error'
    - triage_tags: ['state-space-blocked']
    - metadata: { config, estimated_states, risk: 'HIGH' }
  - Exits with code 1
- Fail-open on analysis errors: logs warning and proceeds with TLC launch

**Files modified:** bin/run-tlc.cjs

**Verification:**
- Guard placed before Java spawn ✓
- Uses CHECK_ID_MAP/PROPERTY_MAP lookups early (lines 383-385) ✓
- state-space-blocked tag present in triage_tags ✓
- NF_SKIP_STATE_SPACE_GUARD bypass functional ✓
- result: 'error' schema used per write-check-result.cjs ✓
- Fail-open error handling in place ✓

## Deviations from Plan

None - plan executed exactly as written.

## Pre-existing Test Status

- run-tlc.test.cjs: 9/10 tests pass (1 pre-existing failure: tla2tools.jar resolution test, acceptable per plan)
- Full test suite: lint-isolation violations are pre-existing, not introduced by this task

## Implementation Notes

**State-Space Risk Classification:**
- MINIMAL: ≤1,000 states
- LOW: ≤100,000 states
- MODERATE: ≤10,000,000 states
- HIGH: >10,000,000 states or unbounded domains

**Fail-Open Design:** If analyzeModel() throws an error during preflight check, the guard logs a warning and proceeds with TLC launch. This ensures model checking is never broken by analysis infrastructure issues.

**Bypass Mechanism:** Setting NF_SKIP_STATE_SPACE_GUARD=1 allows intentional execution of HIGH-risk models (e.g., for debugging or validating models that appear risky but actually have bounded state-space).

## Files Modified

- **bin/analyze-state-space.cjs** (+84 lines)
  - Renamed internal analyzeModel() → analyzeModelByPath()
  - Added exported analyzeModel(configName, projectRoot) with config name API
  - Wrapped main() in require.main check
  - Updated module.exports

- **bin/run-tlc.cjs** (+39 lines)
  - Added state-space preflight guard after cfgPath/specPath resolution
  - Guard blocks HIGH-risk models before Java spawn
  - Uses CHECK_ID_MAP/PROPERTY_MAP early for check_id/surface/property
  - Fail-open on analysis errors

## Commit

- **1d52a48e** feat(quick-353): add state-space preflight guard to run-tlc.cjs

## Self-Check: PASSED

- analyzeModel export exists ✓
- CLI still works ✓
- Guard placement correct ✓
- Error schema correct (result:'error', triage_tags:['state-space-blocked']) ✓
- Bypass mechanism functional ✓
- Fail-open on analysis errors ✓
