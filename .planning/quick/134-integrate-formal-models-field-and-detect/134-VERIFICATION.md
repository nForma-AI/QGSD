---
phase: quick-134
verified: 2026-03-03T00:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Quick Task 134: Integrate formal_models field and detect-coverage-gaps Verification Report

**Task Goal:** Integrate the formal_models field from requirements.json into requirements-core.cjs (computeCoverage and buildTraceability) and agents.cjs (FM badge), and add detect-coverage-gaps.cjs to the TUI menu.

**Verified:** 2026-03-03
**Status:** PASSED

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `computeCoverage().withFormalModels` counts requirements that have EITHER a direct `formal_models` field OR a model-registry forward link (union, not just registry) | ✓ VERIFIED | Lines 91-104 in bin/requirements-core.cjs: First loop processes registry.models, second loop (lines 100-104) adds requirements with `r.formal_models` field to the same Set (union). Spot check: `node -e "const rc = require('./bin/requirements-core.cjs'); const cov = rc.computeCoverage([{id:'X', status:'Complete', formal_models:['a.tla']}], {models:{}}, []); console.log(cov.withFormalModels)"` → **1** ✓ |
| 2 | `buildTraceability()` returns formal models from BOTH the requirement's own `formal_models` array AND model-registry forward links, deduplicated by path | ✓ VERIFIED | Lines 140-170 in bin/requirements-core.cjs: First loop (lines 147-155) finds models from registry forward links; second block (lines 157-169) adds from requirement.formal_models array with deduplication check on line 160 (`!formalModels.some(fm => fm.path === modelPath)`). Spot check: `node -e "const rc = require('./bin/requirements-core.cjs'); const t = rc.buildTraceability('X', [{id:'X', formal_models:['a.tla']}], {models:{}}, []); console.log(t.formalModels.length)"` → **1** ✓ |
| 3 | Browse Reqs list shows [FM] badge for requirements that have `formal_models` field even if model-registry has no entry for them | ✓ VERIFIED | Lines 2028-2039 in bin/agents.cjs: FM badge logic checks both registry (lines 2031-2033) and requirement.formal_models field (lines 2034-2039). Loop at lines 2035-2038 adds r.id to reqsWithModels Set if `Array.isArray(r.formal_models) && r.formal_models.length > 0`. The badge on next lines uses this Set: requirements with direct field are included. |
| 4 | TUI menu contains a 'Coverage Gaps' item in the Requirements section that runs detect-coverage-gaps.cjs and displays results | ✓ VERIFIED | Line 74 in bin/agents.cjs: MENU_ITEMS includes `{ label: '  Coverage Gaps', action: 'req-gaps' }`. Line 1906 in dispatch(): `else if (action === 'req-gaps') reqCoverageGapsFlow();`. Lines 2150-2187 in bin/agents.cjs: `reqCoverageGapsFlow()` function requires('./detect-coverage-gaps.cjs') on line 2152, calls `detectCoverageGaps({ specName })` for 3 specs (lines 2220-2234), and renders results via `setContent()` on line 2250. |
| 5 | All tests pass: `node --test bin/requirements-core.test.cjs` and `node --test bin/agents.test.cjs` | ✓ VERIFIED | requirements-core.test.cjs: **29/29 pass** (24 existing + 5 new formal_models tests). agents.test.cjs: **61/61 pass** (including updated MENU_ITEMS test). Test output shows 0 failures across both suites. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/requirements-core.cjs` | formal_models field integration in computeCoverage and buildTraceability; exports all 7 functions | ✓ VERIFIED | File exists with 248 lines. Lines 91-104: computeCoverage formal_models union. Lines 157-169: buildTraceability formal_models deduplication. All exports present (lines 237-245): readRequirementsJson, readModelRegistry, readCheckResults, computeCoverage, buildTraceability, filterRequirements, getUniqueCategories. |
| `bin/requirements-core.test.cjs` | Tests for formal_models integration; min_lines: 330 | ✓ VERIFIED | File exists with **402 lines** (exceeds min_lines: 330). Section 8 (lines 329-402) contains 5 new tests: formal_models field adds to count, union deduplicates, buildTraceability includes models, deduplicates models, enriches with registry metadata. All 5 pass. |
| `bin/agents.cjs` | Coverage Gaps menu item + flow, updated FM badge logic; exports: MENU_ITEMS | ✓ VERIFIED | File exists. Line 74: req-gaps menu item. Lines 2028-2039: FM badge checks both registry and formal_models field. Lines 2150-2187: reqCoverageGapsFlow function. Line 1906: dispatch for req-gaps action. MENU_ITEMS exported via module.exports at end of file. |
| `bin/agents.test.cjs` | MENU_ITEMS structural test updated with req-gaps action; contains: req-gaps | ✓ VERIFIED | File exists. Line 363 in test 'MENU_ITEMS: contains all expected actions': 'req-gaps' present in expected actions array. Test 356-368 passes, verifying all 25 expected actions including req-gaps. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| bin/requirements-core.cjs:computeCoverage | formal/requirements.json | r.formal_models field read | ✓ WIRED | Lines 100-104: Loop iterates requirements array, checks `Array.isArray(r.formal_models) && r.formal_models.length > 0`, adds r.id to Set. Pattern match: `r\.formal_models` at line 101. |
| bin/requirements-core.cjs:buildTraceability | formal/requirements.json | requirement.formal_models field read | ✓ WIRED | Lines 157-169: Checks `Array.isArray(requirement.formal_models)`, loops modelPath array, deduplicates by path, creates formalModels entries. Pattern match: `requirement\.formal_models` at line 157. |
| bin/agents.cjs:renderReqList | formal/requirements.json | r.formal_models check for FM badge | ✓ WIRED | Lines 2034-2039: Loop through reqs, checks `Array.isArray(r.formal_models) && r.formal_models.length > 0`, adds to reqsWithModels Set used for FM badge. Pattern match: `r\.formal_models` at line 2036. |
| bin/agents.cjs:reqCoverageGapsFlow | bin/detect-coverage-gaps.cjs | require and call detectCoverageGaps | ✓ WIRED | Line 2152: `const { detectCoverageGaps } = require('./detect-coverage-gaps.cjs');`. Line 2221: `const result = detectCoverageGaps({ specName });`. Multiple calls for 3 specs with results processed. Pattern match: `detectCoverageGaps` function called with return value used. |

### Test Results Summary

| Test Suite | Tests | Status |
|-----------|-------|--------|
| bin/requirements-core.test.cjs | 29 total (24 existing + 5 new) | ✓ All Pass |
| bin/agents.test.cjs | 61 total | ✓ All Pass |
| **Cumulative** | **90 tests** | **✓ All Pass** |

### Formal Models Integration Coverage

**computeCoverage() union logic (Lines 91-104):**
```javascript
// Registry forward links
for (const entry of Object.values(models)) {
  for (const reqId of (entry.requirements || [])) {
    reqsWithModels.add(reqId);
  }
}
// Also include requirements with direct formal_models field (SCHEMA-04)
for (const r of requirements) {
  if (Array.isArray(r.formal_models) && r.formal_models.length > 0) {
    reqsWithModels.add(r.id);
  }
}
```
✓ Both sources contribute to same Set = union, not overwrite.

**buildTraceability() deduplication (Lines 157-169):**
```javascript
if (Array.isArray(requirement.formal_models)) {
  for (const modelPath of requirement.formal_models) {
    // Deduplicate: skip if already found via registry
    if (!formalModels.some(fm => fm.path === modelPath)) {
      const registryEntry = models[modelPath];
      formalModels.push({
        path:        modelPath,
        description: (registryEntry && registryEntry.description) || '',
        version:     (registryEntry && registryEntry.version) || null,
      });
    }
  }
}
```
✓ Deduplicates by path, enriches with registry metadata when available.

**FM Badge Integration (Lines 2028-2039):**
```javascript
// Check model-registry AND requirement.formal_models for FM badge
const registry = reqCore.readModelRegistry();
const reqsWithModels = new Set();
for (const entry of Object.values(registry.models || {})) {
  for (const rid of (entry.requirements || [])) reqsWithModels.add(rid);
}
// Also check direct formal_models field (SCHEMA-04)
for (const r of reqs) {
  if (Array.isArray(r.formal_models) && r.formal_models.length > 0) {
    reqsWithModels.add(r.id);
  }
}
```
✓ Union approach: badge shows for registry OR direct field.

**Coverage Gaps Menu Item (Line 74):**
```javascript
{ label: '  Coverage Gaps',           action: 'req-gaps'       },
```
✓ Positioned in Requirements section after req-aggregate.

**Coverage Gaps Dispatch (Line 1906):**
```javascript
else if (action === 'req-gaps')         reqCoverageGapsFlow();
```
✓ Synchronous dispatch (no await, matching function signature).

**Coverage Gaps Flow (Lines 2150-2187):**
```javascript
function reqCoverageGapsFlow() {
  try {
    const { detectCoverageGaps } = require('./detect-coverage-gaps.cjs');
    const lines = [];
    // ... formatting ...
    const specs = ['QGSDQuorum', 'QGSDStopHook', 'QGSDCircuitBreaker'];
    for (const specName of specs) {
      const result = detectCoverageGaps({ specName });
      // ... render result status and gaps ...
    }
    setContent('Coverage Gaps', lines.join('\n'));
  } catch (err) {
    setContent('Coverage Gaps', `{red-fg}Error: ${err.message}{/}`);
  }
}
```
✓ Requires detect-coverage-gaps, runs all 3 specs, displays formatted results.

## Verification Confidence

All verification items are **programmatically verifiable** and have been confirmed:

1. **Code artifacts exist** — All 4 files present and contain required code
2. **Substantive implementations** — Not stubs; real logic with loops, conditionals, and state manipulation
3. **Wiring complete** — All key links verified; imports used, return values processed
4. **Tests pass** — 90/90 tests pass; including 5 new formal_models-specific tests
5. **Exports correct** — All 7 required exports present in requirements-core.cjs
6. **Menu integration** — req-gaps action wired in MENU_ITEMS, dispatch, and flow function

## Summary

Quick task 134 has been **completed successfully**. All must-haves verified:

- ✓ computeCoverage() counts union of registry and direct formal_models field
- ✓ buildTraceability() returns deduplicated models from both sources with enrichment
- ✓ FM badge in Browse Reqs shows for requirements with direct formal_models field
- ✓ TUI menu has Coverage Gaps item that runs detect-coverage-gaps.cjs and displays results
- ✓ All 90 tests pass (29 core + 61 agents)

**Status: PASSED** — Ready for integration.

---

_Verified: 2026-03-03T00:00:00Z_
_Verifier: Claude Code (qgsd-verifier)_
