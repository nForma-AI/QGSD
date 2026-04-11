---
plan: 057-01
phase: 057-accuracy-safety
status: complete
completed: 2026-04-10
commit: 30ff7c75
requirements:
  - CDIAG-02
---

# 057-01 Summary: Layer 2.5 Call-Graph Backward Walk for formal-scope-scan

## What Was Built

Added Layer 2.5 to `bin/formal-scope-scan.cjs`, inserted between Layer 2 (proximity index enrichment) and Layer 3 (semantic fallback). The new `discoverViaCallGraph()` function queries coderlm's `getCallersSync()` to walk backward from changed `--files` and discover formal modules whose `source_files` globs match the callers — catching transitive relationships that file-name matching alone misses.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Add Layer 2.5 `discoverViaCallGraph()` to `bin/formal-scope-scan.cjs` | Complete |
| 2 | Add Layer 2.5 tests to `bin/formal-scope-scan.test.cjs` | Complete |

## Key Files Modified

- `bin/formal-scope-scan.cjs` — Layer 2.5 function + insertion in `main()` + `createAdapter` require + exports
- `bin/formal-scope-scan.test.cjs` — 8 new test cases for `discoverViaCallGraph`

## Verification Results

- `node bin/formal-scope-scan.cjs --description "test" --files "bin/git-heatmap.cjs" --format json` — exits 0, valid JSON
- `node bin/formal-scope-scan.cjs --description "quorum" --format json` — works without `--files` (Layer 2.5 skips)
- Markers present: `Layer 2.5`, `call_graph`, `discoverViaCallGraph` in source
- `discoverViaCallGraph` exported as `function`
- Test results: **23 passing, 0 failing**
- Full `npm run test:ci`: **1417 passing, 0 failing**

## Behavior

- When coderlm is **unavailable** (unhealthy, null adapter, error): Layer 2.5 returns `[]`, output identical to pre-integration
- When coderlm is **available**: callers of changed files are matched against formal module `source_files` globs; discovered modules added with `matched_by: 'call_graph'` and `discovered_via` trace
- **Monotone safe**: Layer 2.5 can only ADD matches, never remove — EventualConvergence invariant preserved

## Self-Check: PASSED
