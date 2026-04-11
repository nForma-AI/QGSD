---
plan: 057-02
phase: 057-accuracy-safety
status: complete
completed: 2026-04-10
commit: 081183ea
requirements:
  - CDIAG-03
---

# 057-02 Summary: expandWithCallGraph() for solve-incremental-filter

## What Was Built

Added `expandWithCallGraph()` post-processing step to `computeAffectedLayers()` in `bin/solve-incremental-filter.cjs`. After the static DOMAIN_MAP loop runs, the function queries coderlm `getCallersSync()` for each changed file and runs the callers through DOMAIN_MAP to find additional affected layers. This prevents incorrect layer skips when a changed utility file's callers map to layers that the utility itself doesn't match.

Also updated the CLI entrypoint to accept `--adapter-host=URL` flag and `NF_CODERLM_HOST` env var so the adapter is optionally created at runtime.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Add `expandWithCallGraph()` to `bin/solve-incremental-filter.cjs` + CLI adapter | Complete |
| 2 | Add call-graph expansion tests to `bin/solve-incremental-filter.test.cjs` | Complete |

## Key Files Modified

- `bin/solve-incremental-filter.cjs` — `expandWithCallGraph()` function + wired into `computeAffectedLayers()` + CLI adapter creation + updated exports
- `bin/solve-incremental-filter.test.cjs` — 8 new test cases for `expandWithCallGraph` and backward compat

## Verification Results

- `echo '["bin/utils.cjs"]' | node bin/solve-incremental-filter.cjs` — exits 0, valid JSON, no crash
- `echo '[]' | NF_CODERLM_HOST='' node bin/solve-incremental-filter.cjs` — exits 0, empty host skipped
- Markers present: `expandWithCallGraph`, `CDIAG-03`, `adapter-host` in source
- `expandWithCallGraph` exported as `function`
- Backward compat: `computeAffectedLayers(['bin/nf-solve.cjs'])` (1-arg) works unchanged
- Test results: **19 passing, 0 failing**
- Full `npm run test:ci`: **1417 passing, 0 failing**

## Behavior

- When adapter is **null or unhealthy**: `expandWithCallGraph` returns immediately, `affectedSet` unchanged — identical pre-integration behavior
- When coderlm is **available**: callers of changed files are matched through DOMAIN_MAP; any additional layers are added to `affectedSet`
- **Monotone safe**: `expandWithCallGraph` only ADDs to `affectedSet`, never removes — skip_layers can only shrink, never grow — EventualConvergence invariant preserved

## Self-Check: PASSED
