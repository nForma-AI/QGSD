---
phase: quick-380
verified: 2026-04-06T00:00:00Z
status: gaps_found
score: 4/5 must-haves verified
re_verification: false
formal_check:
  passed: 2
  failed: 0
  skipped: 0
  counterexamples: []
gaps:
  - truth: "nf-solve uses coderlm adapter when NF_CODERLM_ENABLED=true and host is reachable, falls back to heuristics otherwise"
    status: failed
    reason: "nf-solve performs health check but never queries adapter for inter-layer edges or calls computeWavesFromGraph. Coderlm path is a logging stub: logs 'available' but falls through to existing computeWaves without utilizing the graph-driven variant."
    artifacts:
      - path: "bin/nf-solve.cjs"
        issue: "Lines 5800-5820: health check present, but no edge queries or computeWavesFromGraph call. TODO comment at line 5807 documents incomplete implementation."
    missing:
      - "Query adapter for inter-layer edges from active residual layers"
      - "Build dependency graph from adapter query results"
      - "Call computeWavesFromGraph(graph, priorityWeights) when graph construction succeeds"
      - "Assign result to waveOrder and skip fallback path"
      - "Remove TODO comment or replace with actual implementation"
---

# Quick Task 380 Verification Report

**Task Goal:** Integrate coderlm adapter and graph-driven computeWaves into nf:solve (issue #58)

**Verified:** 2026-04-06

**Status:** GAPS_FOUND — 4 of 5 must-haves verified. One critical truth fails: the coderlm integration is incomplete.

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                              | Status     | Evidence                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | coderlm adapter health-checks a configurable host and returns healthy/unhealthy status            | ✓ VERIFIED | `health()` and `healthSync()` methods implemented, configurable via opts/env vars, returns status object with latency   |
| 2   | coderlm adapter wraps getCallers, getImplementation, findTests, peek endpoints with error handling | ✓ VERIFIED | All 4 query methods implemented, timeout handling, HTTP error responses, disabled state, all return result objects       |
| 3   | computeWavesFromGraph produces correct wave order from arbitrary dependency graph with SCC collapsing | ✓ VERIFIED | Tarjan SCC algorithm implemented, condensation DAG built, topological sort applies longest-path, MAX_PER_WAVE enforced  |
| 4   | computeWaves existing behavior is identical when no dependency graph is provided (regression parity) | ✓ VERIFIED | computeWaves unchanged, all 29 existing tests still pass, no modifications to original function signature or logic       |
| 5   | nf-solve uses coderlm adapter when NF_CODERLM_ENABLED=true and host is reachable, falls back otherwise | ✗ FAILED   | Health check implemented and wired, but graph-driven execution path is a stub: logs "available" but never queries edges or calls computeWavesFromGraph |

**Score:** 4/5 truths verified

### Required Artifacts

| Artifact                        | Status        | Details                                                                                                                      |
| ------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| bin/coderlm-adapter.cjs         | ✓ VERIFIED    | 310 lines, CommonJS, exports createAdapter + healthCheck, fail-open pattern, all methods synchronous and async variants     |
| bin/coderlm-adapter.test.cjs    | ✓ VERIFIED    | 402 lines, 21 tests, all passing, covers success/timeout/4xx/5xx/disabled/healthSync synchronicity                         |
| bin/solve-wave-dag.cjs          | ✓ VERIFIED    | Exports computeWaves (unchanged) + computeWavesFromGraph (new), Tarjan SCC, topological sort, sequential compaction        |
| bin/solve-wave-dag.test.cjs     | ✓ VERIFIED    | 391 lines, 29 total tests (16 existing + 13 new), all passing, covers empty graph/chains/diamonds/SCCs/MAX_PER_WAVE/parity |
| docs/coderlm-integration.md     | ✓ VERIFIED    | 345 lines, comprehensive: env vars, setup, architecture, API reference, testing, troubleshooting, error patterns            |

### Key Link Verification

| From                | To                      | Via                                                   | Status     | Details                                                                                       |
| ------------------- | ----------------------- | ----------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| bin/nf-solve.cjs    | bin/coderlm-adapter.cjs | require + createAdapter call (line 59 + 5804)         | ✓ WIRED    | Adapter imported, createAdapter() called in health check block                               |
| bin/nf-solve.cjs    | bin/solve-wave-dag.cjs  | require computeWavesFromGraph (line 58)               | ✗ UNWIRED  | Function imported but NEVER CALLED. No reference to computeWavesFromGraph in nf-solve logic   |
| bin/coderlm-adapter | NF_CODERLM_HOST env var | process.env.NF_CODERLM_HOST (line 101)                | ✓ WIRED    | Adapter respects host configuration from environment variable with fallback default          |
| bin/coderlm-adapter | NF_CODERLM_ENABLED env var | process.env.NF_CODERLM_ENABLED === 'true' (line 100) | ✓ WIRED    | Adapter checks enabled flag; methods return {error: 'disabled'} when false                   |

### Requirements Coverage

| Requirement | Source Plan | Description                                       | Status     | Evidence                                                                    |
| ----------- | ----------- | ------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| INTENT-01   | 380-PLAN    | Enable graph-driven remediation wave scheduling   | ✗ PARTIAL  | Graph functions exist and work, but nf-solve never invokes them             |

### Anti-Patterns Found

| File                | Line | Pattern | Severity | Impact                                                                                       |
| ------------------- | ---- | ------- | -------- | --------------------------------------------------------------------------------------------- |
| bin/nf-solve.cjs    | 5807 | TODO    | ⚠️ WARN  | "TODO: Query adapter for inter-layer edges..." — documents incomplete implementation           |
| docs/coderlm-integration.md | 289 | TODO | ℹ️ INFO  | Documentation shows TODO in example code, mirrors actual incomplete state in nf-solve.cjs    |

### Human Verification Required

None at this time. Gaps are observable and documented in code.

### Formal Verification

**Status: PASSED**

| Checks | Passed | Skipped | Failed |
| ------ | ------ | ------- | ------ |
| Total  | 2      | 0       | 0      |

Formal model checker verified 2 properties without counterexamples.

### Gaps Summary

**CRITICAL GAP: Incomplete Graph-Driven Integration**

The plan's central promise is: "nf-solve uses coderlm adapter when NF_CODERLM_ENABLED=true and host is reachable."

Current implementation:
1. ✓ Adapter module works perfectly (health checks, query methods, error handling)
2. ✓ computeWavesFromGraph works perfectly (SCC collapsing, topological sort, wave assignment)
3. ✗ nf-solve never invokes the graph-driven path

The coderlm health check in nf-solve (lines 5800-5820) is a **logging stub**:
- Calls `adapter.healthSync()` to verify server is reachable
- Logs "coderlm graph-driven wave ordering available" if healthy
- **NEVER queries for inter-layer edges**
- **NEVER calls computeWavesFromGraph**
- **ALWAYS falls through to existing computeWaves**

This means:
- The expensive coderlm infrastructure (server, adapter, SCC algorithm) is never actually used
- `computeWavesFromGraph` is dead code (imported, exported, tested, but never called)
- nf-solve behavior is unchanged from before (hypothesis-driven waves only)

**Root cause:** Task 3 action text (lines 207-219) shows pseudocode with a comment on line 209: "// Query adapter for inter-layer edges... // const graph = { ... }; // waveOrder = computeWavesFromGraph(...)". This pseudocode was never implemented — only the health check stub was added.

**Impact:** Goal "Integrate... graph-driven computeWaves into nf:solve" is not achieved. Integration is incomplete.

---

_Verified: 2026-04-06_

_Verifier: Claude (nf-verifier)_
