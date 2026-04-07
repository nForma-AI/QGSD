---
phase: quick-381
plan: 01
subsystem: solver
tags: [coderlm, graph-driven-waves, dependency-discovery, formal-verification]

requires: []
provides:
  - queryEdgesSync() helper function for inter-layer dependency edge discovery via coderlm /callers endpoint
  - getCallersSync() synchronous wrapper method on coderlm adapter
  - graph-driven wave ordering integrated into nf-solve coderlm integration block
  - LAYER_SCRIPT_MAP constant mapping layer keys to their script files for caller queries

affects: [nf-solve convergence, wave ordering, dependency graph construction]

tech-stack:
  added: []
  patterns: [spawnSync pattern for synchronous HTTP in CommonJS, fail-open coderlm integration, reverse map for file->layer lookups]

key-files:
  created: []
  modified:
    - bin/coderlm-adapter.cjs
    - bin/nf-solve.cjs

key-decisions: []

requirements-completed:
  - INTENT-01

patterns-established:
  - "getCallersSync mirrors healthSync implementation exactly (same spawnSync script pattern, same error handling structure)"
  - "queryEdgesSync implements fail-open behavior: returns empty edges on coderlm failure, preserving fallback heuristic path"
  - "LAYER_SCRIPT_MAP enables mapping between formal layer keys and their implementation files for caller discovery"

duration: 8min
completed: 2026-04-07
---

# Quick Task 381: Wire coderlm adapter queries into nf-solve

**Coderlm adapter queryEdgesSync() method and inter-layer edge discovery wired into graph-driven wave ordering for dependency-driven layer dispatch**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-07T03:00:00Z
- **Completed:** 2026-04-07T03:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `getCallersSync(symbol, file)` method to coderlm adapter following exact spawnSync pattern used by `healthSync()`
- Defined `LAYER_SCRIPT_MAP` constant mapping all 19 layer keys to their script files (formal-test-sync, git-heatmap, hazard-model, etc.)
- Implemented `queryEdgesSync(adapter, activeLayerKeys)` function that queries coderlm /callers endpoint for each active layer's script and builds inter-layer edges
- Replaced placeholder `edges: []` with live edge discovery in the coderlm integration block at line 5895-5897
- Added logging output showing discovered edge count to stderr

## Task Commits

1. **Task 1: Add getCallersSync to coderlm adapter** - getCallersSync method added, returns `{ callers: [...] }` or `{ error: string }`
2. **Task 2: Wire queryEdgesSync into nf-solve graph builder** - LAYER_SCRIPT_MAP, queryEdgesSync function, and graph edge replacement all integrated

**Execution commit:** (pending)

## Files Created/Modified

- `bin/coderlm-adapter.cjs` - Added getCallersSync(symbol, file) method (~70 lines) that spawns node process with HTTP GET to /callers endpoint, parses JSON response, returns callers array or error
- `bin/nf-solve.cjs` - Added LAYER_SCRIPT_MAP constant (19 layer->script mappings) and queryEdgesSync function (24 lines, builds reverse map and queries callers for each active layer's script)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `getCallersSync` method exists on adapter
- [x] `getCallersSync({enabled: false})` returns `{ error: 'disabled' }`
- [x] `queryEdgesSync` function defined near line 157 of nf-solve.cjs
- [x] `LAYER_SCRIPT_MAP` defined with all 19 layer keys mapped to scripts
- [x] Placeholder `edges: []` completely removed from graph construction
- [x] `discoveredEdges = queryEdgesSync(adapter, activeLayerKeys)` call present at line 5895
- [x] Log statement logs discovered edge count to stderr
- [x] Pre-existing test failures confirmed (validate-traces.test.cjs failures unrelated to this task)

---

*Quick Task: 381*
*Completed: 2026-04-07*
