---
plan: "054-02"
phase: "054-adapter-foundation"
status: complete
completed: 2026-04-08
---

# Plan 054-02: Symbol-Level Edge Discovery + Post-Remediation Reindex

## Summary

Added `getImplementationSync()` to `coderlm-adapter.cjs`, built `LAYER_SYMBOL_MAP` from verified module exports, refactored `queryEdgesSync()` to use symbol-level precision with `path.resolve()` reverse lookup (CDIAG-01). Added `reindex()` to `coderlm-lifecycle.cjs` and wired post-`autoClose()` reindex call in `nf-solve.cjs` guarded by `actions_taken.length > 0` (CDIAG-04). Full test suite: 1392 tests, 0 failures.

## Tasks Completed

| Task | Status | Commit |
|------|--------|--------|
| Task 1: Add getImplementationSync + LAYER_SYMBOL_MAP + refactor queryEdgesSync | ✓ | feat(054-02): add getImplementationSync, LAYER_SYMBOL_MAP, refactor queryEdgesSync |
| Task 2: Add reindex() to lifecycle + wire post-autoClose reindex | ✓ | feat(054-02): add reindex() to coderlm-lifecycle and wire post-autoClose reindex |

## Key Changes

- `bin/coderlm-adapter.cjs` — `getImplementationSync(symbol)` added; spawnSync pattern matching `getCallersSync`
- `bin/nf-solve.cjs` — `LAYER_SYMBOL_MAP` with verified symbols; `queryEdgesSync` uses `getImplementationSync` + `getCallersSync` with `path.resolve()` comparison; `reindex` imported and called after `autoClose()` when `actions_taken.length > 0`
- `bin/coderlm-lifecycle.cjs` — `reindex(opts)` exported; uses POST to `/reindex` via spawnSync child node

## Pre-flight Finding

The `/implementation` endpoint returns `{ file, line }` only (no callers array). Implementation confirmed by reading existing `getImplementation()`. `queryEdgesSync` falls back to `getCallersSync(symbol, implementationFile)` for caller discovery — documented in code comment.

## Self-Check: PASSED

- [x] `getImplementationSync` exists on adapter, returns `{ error: 'disabled' }` when disabled
- [x] `LAYER_SYMBOL_MAP` entries derived from actual `module.exports` (not guessed)
- [x] `path.resolve()` comparison used for reverse lookup
- [x] `reindex()` exported from `coderlm-lifecycle.cjs` (`typeof === 'function'`)
- [x] `reindex()` called after `autoClose()` only when `actions_taken.length > 0`
- [x] Full test suite: 0 regressions

## Issues Encountered

None.
