# Requirements: nForma v0.42 — Deep coderlm Solve Integration

**Defined:** 2026-04-08
**Core Value:** Planning decisions are multi-model verified by structural enforcement

## Milestone v0.42 Requirements

Requirements for deep coderlm integration into the solve loop. Every integration MUST be fail-open: if coderlm is unavailable, the layer falls back to its existing heuristic with zero degradation.

### Adapter Infrastructure

- [x] **CADP-01**: coderlm adapter caches query results in an LRU cache (100 entries, 5min TTL) to amortize costs across solve iterations — cache is cleared at convergence loop start *(Phase 54)*
- [x] **CADP-02**: Every coderlm call site in nf-solve.cjs and solve-remediate.md is wrapped in try/catch returning the existing heuristic fallback result, never throwing to callers *(Phase 54)*
- [x] **CADP-03**: coderlm query count, cache hit rate, and total query latency are tracked per solve session and reported in stderr diagnostic output *(Phase 54)*

### Remediation Enrichment

- [x] **CREM-01**: R→F dispatch passes `getImplementation()` + `getCallers()` results as `--seed-files` to `/nf:close-formal-gaps` so generated formal specs match actual code structure
- [x] **CREM-02**: F→T stub generation uses `findTests()` + `peek()` to pre-populate test stub recipes with observed test patterns from the codebase (assert patterns, setup code)
- [x] **CREM-03**: Git heatmap hot-zone ranking uses `getCallers()` frequency (callee count) alongside git churn score — files with more callers are prioritized for formal modeling *(Phase 56)*
- [x] **CREM-04**: Reverse discovery (C→R, T→R) candidates are enriched with `getCallers()` call counts as evidence for quorum — modules with 0 callers are flagged as likely dead code *(Phase 56)*

### Diagnostic & Infrastructure

- [x] **CDIAG-01**: `queryEdgesSync()` in nf-solve.cjs uses `getImplementation()` for symbol-level edge discovery instead of file-name string matching — edges reflect actual function calls, not module imports *(Phase 54)*
- [x] **CDIAG-02**: `formal-scope-scan.cjs` includes a Layer 2.5 call-graph discovery step that walks `getCallers()` backward from changed files to find affected formal models
- [x] **CDIAG-03**: `solve-incremental-filter.cjs` uses `getCallers()` transitive dependency data to prevent incorrect layer skips — if a changed file is called by a layer script, that layer is not skipped
- [x] **CDIAG-04**: coderlm server is re-indexed between solve iterations (after remediation creates/modifies files) so the call graph reflects the current state of the codebase *(Phase 54)*

## Out of Scope

| Feature | Reason |
|---------|--------|
| New coderlm server endpoints | Work with existing 4 query methods only |
| Persistent disk cache | In-memory LRU is sufficient; disk caching adds complexity |
| Custom symbol parser for @requirement annotations | If getImplementation doesn't work with comment tokens, fall back to model-registry.json mapping |
| Windows support for coderlm binary | macOS + Linux first; Windows gets detect-and-guide fallback |
| Replacing heuristics entirely | coderlm augments, never replaces — every layer must work without it |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CADP-01 | Phase 54 | **Shipped** |
| CADP-02 | Phase 54 | **Shipped** |
| CADP-03 | Phase 54 | **Shipped** |
| CREM-01 | Phase 55 | Pending |
| CREM-02 | Phase 55 | **Shipped** |
| CREM-03 | Phase 56 | **Shipped** |
| CREM-04 | Phase 56 | **Shipped** |
| CDIAG-01 | Phase 54 | **Shipped** |
| CDIAG-02 | Phase 57 | Pending |
| CDIAG-03 | Phase 57 | Pending |
| CDIAG-04 | Phase 54 | **Shipped** |

**Coverage:**
- v0.42 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-10 after Phase 056-02 completion*
