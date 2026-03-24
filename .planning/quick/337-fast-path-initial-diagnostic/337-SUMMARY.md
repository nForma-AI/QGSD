---
task: 337
title: Fast-path initial diagnostic
status: complete
date: 2026-03-24
---

## Summary

Replaced the Phase 1 diagnostic Agent dispatch in `commands/nf/solve.md` with a direct Bash call to `nf-solve.cjs --json --report-only` as the default fast path. The full Agent path (solve-diagnose.md with all 10+ sub-steps) is preserved behind the `--verbose` flag.

## Changes

**File:** `commands/nf/solve.md`

1. **Flag Extraction:** Added `--verbose` → `verboseMode` boolean parsing
2. **Phase 1 (fast-path):** New default path that:
   - Loads open debt via solve-debt-bridge.cjs (needed for convergence checks)
   - Runs nf-solve.cjs directly via Bash (~60s)
   - Handles non-JSON stdout prefix from nf-solve.cjs (finds first `{`)
   - Sets sensible defaults for fields only the verbose path produces
   - Skips Phase 1b/1c (Classify) entirely
3. **Phase 1 (verbose path):** Existing Agent dispatch to solve-diagnose.md, unchanged
4. **Phase 1c:** Renamed from 1b, gated behind `verboseMode == true`
5. **Phases 2-5:** Completely unchanged

## Impact

- **Default /nf:solve:** ~60s diagnostic (was ~27min via Agent)
- **--verbose /nf:solve:** Full diagnostic with all sub-steps (unchanged behavior)
- **Convergence loop (Phase 3b):** Unaffected (already used direct Bash)

## What Fast-Path Skips

Legacy migration, config audit, observe refresh, hypothesis measurement, root cause quorum vote, git heatmap analysis, issue classification, FSM detection. These are informational steps that rarely produce actionable output during typical solve sessions.
