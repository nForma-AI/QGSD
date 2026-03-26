---
phase: quick-358
plan: 01
type: execute
completed_date: 2026-03-26
author: Claude Code
---

# Quick Task 358 Summary: Add Graph-First Discovery to Formal Scope Scan

## Overview

Extracted unified graph search module from informal-scope-scan.cjs and candidate-discovery.cjs into `bin/formal-graph-search.cjs`. Integrated graph-first module discovery into formal-scope-scan.cjs Layer 2 pipeline via `graphDiscoverModules()` function, which walks proximity graph from description-derived concept nodes to find related formal modules.

**One-liner**: Eliminated duplicated BFS/proximity/keyword code between formal-scope-scan.cjs and candidate-discovery.cjs by extracting to shared module; enhanced formal-scope-scan.cjs recall via graph-first discovery from description tokens.

## Tasks Completed

### Task 1: Extract Unified Graph Search Module

**Status**: ✅ COMPLETE

**Artifacts Created**:
- `bin/formal-graph-search.cjs` (172 lines)
- `bin/formal-graph-search.test.cjs` (235 lines)

**Exports** (4 functions):
1. `reachFiltered(index, startKey, maxDepth, typeFilter)` — BFS from node, respects depth/type filters
2. `proximityScore(index, fromKey, toKey)` — Weighted BFS proximity score with edge weights and decay
3. `keywordOverlap(modelPath, reqText)` — Keyword pre-screen: detects zero-overlap term matching, fail-open
4. `graphDiscoverModules(index, tokens, description)` — NEW: Graph-first discovery from description tokens via concept nodes

**Graph-First Discovery Algorithm**:
- For each token in description, check exact match against `concept::{token}` nodes
- Also check partial matches (token "break" matches concept "circuit-breaker")
- BFS from matched concepts (maxDepth=2) to find formal_module nodes
- Deduplicate by module name, keep shortest discovery path
- Sort deterministically by depth (ascending) then module name (alphabetically)
- Return `Array<{module, discoveredVia, depth}>`
- Fail-open: null/missing index returns `[]`

**Test Coverage**: 20 tests, 100% pass
- `reachFiltered`: 4 tests (depth limits, type filtering, nonexistent nodes)
- `proximityScore`: 4 tests (same node, reachable, unreachable, null handling)
- `keywordOverlap`: 5 tests (overlap detection, zero-overlap rejection, fail-open behavior)
- `graphDiscoverModules`: 7 tests (exact match, partial match, deduplication, deterministic ordering)

### Task 2: Wire Shared Module into Consumers

**Status**: ✅ COMPLETE

**Changes to `bin/formal-scope-scan.cjs`**:
- Added: `const { reachFiltered, proximityScore, graphDiscoverModules } = require('./formal-graph-search.cjs');`
- Removed: Local `reachFiltered()` and `proximityScore()` function definitions (79 lines eliminated)
- Added graph-first discovery block in `enrichWithProximityIndex()` BEFORE --files walk
- Updated sort weights: `{ source_file: 4, concept: 3, module_name: 2, graph_discovery: 1, proximity_graph: 0 }`
- New matched_by value: `'graph_discovery'` for modules discovered via concept nodes

**Graph-First Discovery Integration**:
```javascript
if (tokens.length > 0) {
  const discovered = graphDiscoverModules(index, tokens, '');
  for (const d of discovered) {
    if (!matchedModules.has(d.module)) {
      matchedModules.add(d.module);
      const invariantsPath = '.planning/formal/spec/' + d.module + '/invariants.md';
      matches.push({
        module: d.module,
        path: invariantsPath,
        matched_by: 'graph_discovery',
        discovered_via: d.discoveredVia
      });
    }
  }
}
```

**Changes to `bin/candidate-discovery.cjs`**:
- Added: `const { keywordOverlap } = require('./formal-graph-search.cjs');`
- Removed: Local `keywordOverlap()` function definition (37 lines eliminated)
- No behavioral changes; keywordOverlap pre-filter still applied in ensemble discovery at line 269

**Changes to `test/formal-scope-scan-semantic.test.cjs`**:
- Added graph_discovery test suite (1 test) verifying graph-first discovery produces matched_by="graph_discovery" results
- Updated regression test's VALID_L1_L2 array to include 'graph_discovery'
- All 10 tests pass (9 pre-existing + 1 new)

**No Re-inlining Verification**:
- `grep -c 'function reachFiltered' bin/formal-scope-scan.cjs` → 0
- `grep -c 'function proximityScore' bin/formal-scope-scan.cjs` → 0
- `grep -c 'function keywordOverlap' bin/candidate-discovery.cjs` → 0
- Both consumers correctly import from formal-graph-search.cjs

**CLI Backward Compatibility**:
- `node bin/formal-scope-scan.cjs --description "circuit breaker" --format json` → ✅ Works (returns matches)
- `node bin/candidate-discovery.cjs --json --top 3` → ✅ Works (ensemble discovery, 6 candidates found, filtered by keywords/domains)
- Output JSON structure unchanged; new graph_discovery matches seamlessly integrate with existing pipeline

## File Inventory

### Created
- `bin/formal-graph-search.cjs` — Unified graph search module (172 lines)
- `bin/formal-graph-search.test.cjs` — Comprehensive unit tests (235 lines)

### Modified
- `bin/formal-scope-scan.cjs` — Added imports, removed 2 local functions, integrated graph-first discovery (79 lines removed, ~22 lines added)
- `bin/candidate-discovery.cjs` — Added import, removed 1 local function (37 lines removed)
- `test/formal-scope-scan-semantic.test.cjs` — Added graph_discovery test, updated regression test (13 lines added)

## Test Results

**Unit Tests**: `node bin/formal-graph-search.test.cjs` → 20 pass, 0 fail
**Integration Tests**: `npx jest test/formal-scope-scan-semantic.test.cjs --no-cache` → 10 pass, 0 fail
**Smoke Tests**:
- formal-scope-scan CLI: ✅
- candidate-discovery CLI: ✅
- No breaking changes to existing behavior

## Deviations from Plan

None — plan executed exactly as written. All must-haves achieved:
- ✅ Unified graph search module extracted with 4 exported functions
- ✅ Both consumers import from formal-graph-search.cjs (no duplication)
- ✅ formal-scope-scan.cjs Layer 1-4 behavior preserved; graph discovery adds to results
- ✅ candidate-discovery.cjs behavior unchanged (ensemble, filters, orphan detection preserved)
- ✅ graphDiscoverModules implements algorithm exactly as specified (token matching, deduplication, deterministic sorting)
- ✅ All key_links verified (requires statements, function calls)
- ✅ All must-have artifacts created with min line counts met

## Key Decisions

1. **Graph-first placement**: Inserted BEFORE --files walk in enrichWithProximityIndex so token-derived matches are discovered before file-derived matches, preserving existing priority order
2. **Sort weight assignments**: Placed graph_discovery (weight 1) between module_name (2) and proximity_graph (0) to prioritize exact token matches over graph walks but keep graph walks over proximity scoring
3. **Deduplication strategy**: Added modules discovered via graph-first to matchedModules set to prevent re-discovery via --files walk, ensuring single entry per module
4. **Deterministic ordering**: Implemented sort by depth (ascending) then module name (alphabetically) for equal-depth modules to ensure reproducible output for test assertions

## Metrics

- **Duration**: ~15 minutes (development + testing)
- **New files**: 2 (formal-graph-search.cjs, formal-graph-search.test.cjs)
- **Modified files**: 3 (formal-scope-scan.cjs, candidate-discovery.cjs, test file)
- **Lines of code**: +407 (172 + 235 new), −116 removed (79 + 37), net +291
- **Tests written**: 20 unit + 1 integration = 21 new assertions
- **Pass rate**: 100% (21/21 tests passing)

## References

- Plan: `.planning/quick/358-add-graph-first-discovery-to-formal-scop/358-PLAN.md`
- Shared module: `bin/formal-graph-search.cjs`
- Test suite: `bin/formal-graph-search.test.cjs` + `test/formal-scope-scan-semantic.test.cjs`
- Consumers: `bin/formal-scope-scan.cjs`, `bin/candidate-discovery.cjs`
