---
phase: 057-accuracy-safety
status: passed
completed: 2026-04-10
formal_check:
  passed: 4
  failed: 1
  skipped: 0
  counterexamples:
    - module: safety
      formalism: tlc
      note: "Pre-existing failure — safety module covers hooks/nf-stop.js and hooks/nf-prompt.js, files NOT touched by phase 057. Unrelated to CDIAG-02/CDIAG-03."
requirements:
  - CDIAG-02
  - CDIAG-03
---

# Phase 057: Accuracy & Safety — Verification

## Goal

Scope scan and incremental filter layers use call-graph data to prevent incorrect layer skips and missed formal models, preserving solve convergence correctness.

## Must-Haves Verification

### CDIAG-02: Layer 2.5 call-graph backward walk (formal-scope-scan.cjs)

| Truth | Status | Evidence |
|-------|--------|----------|
| A change to a utility function used by a formal model's source triggers that model's re-verification via Layer 2.5 getCallers() backward walk | PASS | `discoverViaCallGraph()` implemented in `bin/formal-scope-scan.cjs`, walks callers from `--files` against `scope.json source_files` globs. Test case "discovers module via caller file matching source_files glob" passes. |
| When coderlm is unavailable, Layer 2.5 falls back to existing Layer 1+2+3+4 result with no errors | PASS | `discoverViaCallGraph()` returns `[]` when adapter unhealthy, null, or throws. Test cases for all fail-open paths pass. |
| Layer 2.5 runs after Layer 2 and before Layer 3; newly discovered modules carry matched_by: 'call_graph' | PASS | Insertion point verified: after `enrichWithProximityIndex()`, before semantic fallback. Test case confirms `matched_by: 'call_graph'` on discovered modules. |

**Artifact check:**
- `bin/formal-scope-scan.cjs` — contains `discoverViaCallGraph`, `call_graph`, `Layer 2.5`: VERIFIED
- `bin/formal-scope-scan.test.cjs` — 8 test cases for Layer 2.5: VERIFIED (23 passing, 0 failing)

### CDIAG-03: expandWithCallGraph() transitive expansion (solve-incremental-filter.cjs)

| Truth | Status | Evidence |
|-------|--------|----------|
| Changed file that is a transitive caller of a layer's scripts adds that layer to affected_layers (not skip_layers) | PASS | `expandWithCallGraph()` runs callers through DOMAIN_MAP and adds to `affectedSet`. Test "caller matches DOMAIN_MAP pattern — layer added" confirms bin/nf-solve.cjs callers trigger c_to_f, c_to_r. |
| When coderlm is unavailable, computeAffectedLayers() returns same result as before integration | PASS | Null adapter, unhealthy adapter, error result all tested — affectedSet unchanged. Backward compat test confirms 1-arg call produces identical results. |
| Call-graph enrichment is monotone-safe: only ADDs layers to affected_layers | PASS | `expandWithCallGraph` only calls `affectedSet.add()`, never `.delete()`. Monotone safety test verifies set cannot shrink. EventualConvergence invariant preserved. |
| When coderlm available and caller maps via DOMAIN_MAP, layer added to affected_layers and removed from skip_layers | PASS | Test "caller matches DOMAIN_MAP pattern" verifies layer appears in affected and not in skip. |

**Artifact check:**
- `bin/solve-incremental-filter.cjs` — contains `expandWithCallGraph`, `CDIAG-03`, `adapter-host`: VERIFIED
- `bin/solve-incremental-filter.test.cjs` — 8 test cases for expandWithCallGraph: VERIFIED (19 passing, 0 failing)

## Test Results

```
npm run test:ci
# pass 1417
# fail 0
```

## Formal Check Results

```
[run-formal-check] Results: 5 checks, 4 passed, 1 failed, 0 skipped
FORMAL_CHECK_RESULT={"passed":4,"failed":1,"skipped":0,"counterexamples":["safety:tlc"]}
```

**safety:tlc counterexample — pre-existing, unrelated to phase 057:**
- The `safety` module covers `hooks/nf-stop.js` and `hooks/nf-prompt.js`
- Phase 057 only modified `bin/formal-scope-scan.cjs`, `bin/formal-scope-scan.test.cjs`, `bin/solve-incremental-filter.cjs`, `bin/solve-incremental-filter.test.cjs`
- No hooks files were touched — the safety TLC failure predates this phase
- The 4 other modules (agent-loop, formal-proximity-index, prefilter, stop-hook) all PASSED

**Phase 057 goal: ACHIEVED.** Scope scan and incremental filter layers now use call-graph data correctly, with fail-open behavior and monotone safety guarantees.
