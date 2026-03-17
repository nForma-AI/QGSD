---
phase: quick-312
verified: 2026-03-16T15:45:00Z
status: passed
score: 4/4 must-haves verified
---

# Quick Task 312: Make nf-prompt.js Fall Back to providers.json for Model Dedup

**Task Goal:** Make deduplicateByModel in nf-prompt.js fall back to bin/providers.json when agent_config is empty or lacks a slot's model info. Enable dual-subscription slot deduplication (codex-1/codex-2, gemini-1/gemini-2) without explicit agent_config entries.

**Verified:** 2026-03-16T15:45:00Z
**Status:** PASSED
**All 4 Must-Haves Verified**

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dual-subscription slots with the same model are deduplicated even when agent_config is empty | ✓ VERIFIED | Test 11: `Empty agentCfg: fallback to providersList deduplicates codex-1/2` — PASS. Codex-1 and codex-2 both resolve to 'gpt-5.4' from providers.json, codex-2 demoted to duplicates. |
| 2 | deduplicateByModel falls back to providers.json model field when agentCfg lacks a slot entry | ✓ VERIFIED | Test 11, 14: deduplicateByModel accepts providersList parameter and constructs providersMap at lines 302-307. Model resolution line 310 cascades: `agentCfg[slot.slot]?.model \|\| providersMap.get(slot.slot) \|\| 'unknown'`. |
| 3 | Existing behavior preserved: agent_config takes precedence over providers.json when populated | ✓ VERIFIED | Test 12: `agentCfg precedence: custom model overrides providers.json` — PASS. Codex-1 with custom-model-x (from agentCfg) differs from codex-2 with gpt-5.4 (from providers), preventing dedup. AgentCfg precedence confirmed. |
| 4 | Fail-open on missing providers.json: slots with truly unknown models still kept as unique (no false dedup) | ✓ VERIFIED | Test 13: `No providersList: backward compatible with 2-arg calls` — PASS. Both codex-1 and codex-2 resolve to 'unknown' when providersList undefined. Both treated as unique. Lines 312-315 enforce: unknown models never deduplicated. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `hooks/nf-prompt.js` | Function deduplicateByModel with providers.json fallback | ✓ VERIFIED | Lines 291-330: Function signature accepts optional providersList parameter. Lines 302-307: providersMap built from providers array. Line 310: model resolution cascades agentCfg → providersMap → 'unknown'. Call site at line 655-656: passes providersList from findProviders(). |
| `hooks/dist/nf-prompt.js` | Synced copy of source | ✓ VERIFIED | No diff between hooks/nf-prompt.js and hooks/dist/nf-prompt.js. Files are identical. |
| `test/model-dedup.test.cjs` | Tests covering empty agentCfg fallback to providers.json | ✓ VERIFIED | 14 total tests pass (10 existing + 4 new). Test file 332 lines, includes Tests 11-14 validating: fallback dedup (Test 11), precedence (Test 12), backward compat (Test 13), mixed scenarios (Test 14). Lines 236-328 contain new test implementations. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| deduplicateByModel function | providersMap/providers array | providersMap construction at lines 302-307 | ✓ WIRED | providersMap is built from providersList parameter (if Array). Each provider entry {name, model} is added to map for O(1) lookup. |
| deduplicateByModel function | model resolution logic | Line 310 cascade pattern | ✓ WIRED | Model resolution: `const model = (agentCfg[slot.slot]?.model \|\| providersMap.get(slot.slot) \|\| 'unknown')` — three-tier fallback correctly wired. |
| Dispatch call site | deduplicateByModel | Line 655-656: providersList parameter | ✓ WIRED | Line 655: `const providersList = findProviders();`. Line 656: `dedupResult = deduplicateByModel(cappedSlots, agentCfg, providersList);`. Call site passes providers array to function. |
| deduplicateByModel | bin/providers.json | Via findProviders() cached read | ✓ VERIFIED | findProviders() function (existing, lines ~155) reads and caches providers.json. Called at dispatch site line 655. Module caching means minimal overhead. |

### Implementation Details

**Function Signature Change (Line 296):**
```javascript
// FROM:
function deduplicateByModel(orderedSlots, agentCfg)

// TO:
function deduplicateByModel(orderedSlots, agentCfg, providersList)
```
Third parameter optional for backward compatibility.

**Model Resolution Cascade (Lines 302-310):**
```javascript
const providersMap = new Map();
if (Array.isArray(providersList)) {
  for (const p of providersList) {
    if (p.name && p.model) providersMap.set(p.name, p.model);
  }
}
// ...
const model = (agentCfg[slot.slot]?.model || providersMap.get(slot.slot) || 'unknown');
```

**Call Site Integration (Lines 655-656):**
```javascript
const providersList = findProviders();
const dedupResult = deduplicateByModel(cappedSlots, agentCfg, providersList);
```

### Test Coverage

**All 14 Tests Pass (10 existing + 4 new):**

1-10. Existing tests (regression check):
- No duplicates: all unique models
- One pair of duplicates: codex-1 + codex-2
- Two pairs of duplicates: codex-1/2 and gemini-1/2
- Auth-type sort order: first slot in orderedSlots wins
- Unknown model: slots not in agentCfg all treated as unique
- Model-dedup tier rendered in FALLBACK-01
- Empty model-dedup tier: no MODEL-DEDUP in output
- Step numbering with model-dedup tier
- Model-dedup + T2 only (no T1)
- Full integration: deduplicateByModel + buildFalloverRule

11. **Test 11: Empty agentCfg with providersList deduplicates codex-1/2** (Line 236)
   - Input: agentCfg={}, providersList=[{codex-1, gpt-5.4}, {codex-2, gpt-5.4}, {gemini-1, gemini-3-pro-preview}]
   - Result: unique=[codex-1, gemini-1], duplicates=[codex-2]
   - Status: PASS — Core bug fix validated

12. **Test 12: agentCfg takes precedence over providersList** (Line 260)
   - Input: agentCfg={codex-1: custom-model-x}, providersList=[{codex-1, gpt-5.4}, {codex-2, gpt-5.4}]
   - Result: unique=[codex-1, codex-2], duplicates=[] (different models, no dedup)
   - Status: PASS — AgentCfg precedence confirmed

13. **Test 13: No providersList (undefined) — backward compatible** (Line 285)
   - Input: agentCfg={}, providersList=undefined (2-arg call)
   - Result: unique=[codex-1, codex-2], duplicates=[] (both unknown, never dedup)
   - Status: PASS — Backward compatibility verified

14. **Test 14: Mixed agentCfg + providers fallback** (Line 302)
   - Input: agentCfg={gemini-1: model}, providersList=[{codex-1, gpt-5.4}, {codex-2, gpt-5.4}]
   - Result: unique=[codex-1, gemini-1], duplicates=[codex-2]
   - Status: PASS — Mixed resolution verified

### Compliance Checks

**Compilation:** ✓ Module loads without error
- `node` heredoc eval: require('./hooks/nf-prompt.js') → OK

**Dist Sync:** ✓ No differences
- `diff hooks/nf-prompt.js hooks/dist/nf-prompt.js` → (no output, files identical)

**Function Exports:** ✓ deduplicateByModel exported for testing
- Lines 717-724: `module.exports.deduplicateByModel = deduplicateByModel;`

**Module Exports Check:**
```javascript
if (typeof module !== 'undefined') {
  module.exports = module.exports || {};
  // ... other exports ...
  module.exports.deduplicateByModel = deduplicateByModel;
  module.exports.buildFalloverRule = buildFalloverRule;
}
```

### Requirements Coverage

**QUICK-312:** "Make nf-prompt.js fall back to providers.json when agent_config is empty for model dedup"

- ✓ SATISFIED by implementation
- Evidence: Tests 11, 14 demonstrate fallback behavior. Lines 302-310 show cascade resolution. Call site line 655 provides fallback data.

## Summary

All 4 must-haves verified. Task achieves stated goal:

**Goal Achieved:** ✓

The deduplicateByModel function now resolves models via three-tier cascade:
1. **agentCfg entries** (if present) — explicit configuration takes precedence
2. **providers.json entries** (fallback) — discovered model configuration
3. **'unknown' default** — fail-open for missing entries

**Dual-subscription slots are now deduplicated even when agent_config is empty**, solving the original bug where empty agent_config caused all slots to resolve to 'unknown' (never deduplicated).

**Backward compatible:** Optional providersList parameter allows existing 2-arg callers to work unchanged.

**Fail-safe:** Unknown models never deduplicated (can't assert they're duplicates).

---

_Verified: 2026-03-16T15:45:00Z_
_Verifier: Claude (nf-verifier)_
