# Roadmap: nForma v0.42 — Deep coderlm Solve Integration

**Created:** 2026-04-07
**Milestone:** v0.42
**Profile:** cli
**Depth:** standard
**Global phase range:** 54-57

## Overview

4 phases, 11 requirements. This milestone wires coderlm's call-graph queries (getCallers, getImplementation, findTests, peek) into 7 high-value solve layers so the convergence loop makes evidence-based decisions instead of static heuristics. Every integration is fail-open: if coderlm is unavailable, each layer falls back to its existing heuristic with zero degradation. The dependency chain is: adapter infrastructure with LRU cache, fail-open wrappers, metrics, symbol precision, and reindex (Phase 54) -> remediation enrichment uses the adapter for R->F seed files and F->T test patterns (Phase 55) -> diagnostic enrichment layers use getCallers for heatmap ranking and reverse discovery evidence (Phase 56) -> accuracy and safety layers use getCallers for scope scan and incremental filter, where incorrect skips could break convergence (Phase 57).

---

## Phases

- [ ] **Phase 54: Adapter Foundation** - LRU cache, fail-open wrappers, query metrics, symbol-level edge discovery, and inter-iteration reindex
- [ ] **Phase 55: Remediation Enrichment** - R->F seed files via getImplementation/getCallers, F->T test patterns via findTests/peek
- [ ] **Phase 56: Diagnostic Enrichment** - Heatmap caller ranking via getCallers frequency, reverse discovery evidence with dead-code detection
- [ ] **Phase 57: Accuracy & Safety** - Scope scan call-graph backward walk, incremental filter transitive dependency safety

## Phase Details

### Phase 54: Adapter Foundation
**Goal**: Solve layers can query coderlm through a cached, fail-open adapter that tracks metrics and keeps the call graph current across iterations
**Depends on**: Nothing (foundation phase)
**Requirements**: CADP-01, CADP-02, CADP-03, CDIAG-01, CDIAG-04
**Success Criteria** (what must be TRUE):
  1. Running `nf:solve` with coderlm available shows LRU cache hit/miss statistics in stderr diagnostic output, and repeated queries for the same symbol within a solve session return cached results
  2. Running `nf:solve` with coderlm unavailable (server not running, binary missing) completes the full convergence loop with zero errors -- every layer produces the same output as before coderlm integration
  3. `queryEdgesSync()` in nf-solve.cjs resolves symbol-level function call edges via getImplementation instead of file-name string matching -- edges for a changed function connect to its actual callers, not all importers of its module
  4. After remediation modifies or creates files, the coderlm server is re-indexed before the next solve iteration begins, so subsequent queries reflect the current codebase state
  5. Solve session stderr output reports total coderlm query count, cache hit rate percentage, and aggregate query latency -- enabling diagnosis of whether coderlm is helping or adding overhead
**Plans**: TBD

Plans:
- [ ] 54-01: TBD
- [ ] 54-02: TBD

### Phase 55: Remediation Enrichment
**Goal**: Remediation dispatch produces higher-quality formal specs and test stubs by seeding them with actual code structure and observed test patterns from the codebase
**Depends on**: Phase 54 (adapter infrastructure must exist for coderlm queries)
**Requirements**: CREM-01, CREM-02
**Success Criteria** (what must be TRUE):
  1. When R->F remediation dispatches `/nf:close-formal-gaps`, the `--seed-files` argument includes files discovered via getImplementation and getCallers -- the generated formal spec references actual function signatures and call relationships from the codebase
  2. When F->T stub generation runs, test stubs contain assert patterns and setup code observed in existing tests via findTests/peek -- not generic boilerplate
  3. When coderlm is unavailable, R->F dispatch and F->T stub generation fall back to their existing behavior (no seed files, generic stubs) with no errors and no degradation of solve loop progress
**Plans**: TBD

Plans:
- [ ] 55-01: TBD
- [ ] 55-02: TBD

### Phase 56: Diagnostic Enrichment
**Goal**: Heatmap ranking and reverse discovery layers produce evidence-backed prioritization by incorporating call-graph frequency data into their scoring
**Depends on**: Phase 54 (adapter infrastructure must exist for coderlm queries)
**Requirements**: CREM-03, CREM-04
**Success Criteria** (what must be TRUE):
  1. Git heatmap hot-zone ranking incorporates getCallers callee count alongside git churn score -- files with more callers appear higher in the prioritized list for formal modeling, even if their git churn is moderate
  2. Reverse discovery (C->R, T->R) candidates include getCallers call counts as evidence in their quorum context -- modules with 0 callers are explicitly flagged as likely dead code
  3. When coderlm is unavailable, heatmap ranking uses git churn alone and reverse discovery uses its existing heuristics -- no errors, no missing candidates, solve loop residuals are unchanged from pre-integration behavior
**Plans**: TBD

Plans:
- [ ] 56-01: TBD

### Phase 57: Accuracy & Safety
**Goal**: Scope scan and incremental filter layers use call-graph data to prevent incorrect layer skips and missed formal models, preserving solve convergence correctness
**Depends on**: Phase 54 (adapter infrastructure must exist for coderlm queries), Phase 56 (diagnostic enrichment validates call-graph data quality before safety-critical use)
**Requirements**: CDIAG-02, CDIAG-03
**Success Criteria** (what must be TRUE):
  1. `formal-scope-scan.cjs` Layer 2.5 walks getCallers backward from changed files and discovers affected formal models that file-name matching would miss -- a change to a utility function used by a formal model's source triggers that model's re-verification
  2. `solve-incremental-filter.cjs` prevents incorrect layer skips by checking getCallers transitive dependencies -- if a changed file is called by a layer script (directly or transitively), that layer is not skipped even if its own files appear unchanged
  3. When coderlm is unavailable, scope scan uses file-name matching and incremental filter uses its existing skip heuristics -- the solve loop converges to the same result, just potentially slower (fewer models discovered, more layers run unnecessarily)
  4. The solve convergence loop reaches a terminal state (all layers at residual 0 or blocked by Option C) on every run where at least one layer has non-zero residual -- call-graph integration does not introduce new oscillation modes or prevent convergence [derived from EventualConvergence formal invariant]
**Plans**: TBD

Plans:
- [ ] 57-01: TBD
- [ ] 57-02: TBD

## Progress

**Execution Order:** Phase 54 -> Phase 55 -> Phase 56 -> Phase 57

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 54. Adapter Foundation | 0/? | Not started | - |
| 55. Remediation Enrichment | 0/? | Not started | - |
| 56. Diagnostic Enrichment | 0/? | Not started | - |
| 57. Accuracy & Safety | 0/? | Not started | - |
