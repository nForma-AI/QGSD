---
task: 340
title: Conditional Haiku classification
status: complete
date: 2026-03-24
---

## Summary

Added 4 skip conditions to Phase 1c (Classify) in solve.md so the ~80s Haiku classification Agent is only dispatched when it adds value.

## Skip Conditions

1. `verboseMode` is false (fast-path, already existed from task 337)
2. `--fast` flag passed (user explicitly wants speed)
3. Forward residual <= 3 (small enough to fix without triage)
4. Cache hit ratio >= 80% (most items already classified from prior sessions)

## Changes

**commands/nf/solve.md:**
- Flag Extraction: added `--fast` → `fastMode` boolean
- Phase 1c: renamed from "verbose mode only" to "conditional", added 4 skip conditions
- Added inline cache ratio check (reads solve-classifications.json directly, no Agent)
- Skip reason logged so user knows why classification was omitted

## Impact

In the observed session: 10 cached / 36 total = 28% cache hit, 1/36 genuine = 2.8%. With residual of 6, condition 3 (<=3) would NOT trigger but after task 337's fast-path, condition 1 (!verbose) always skips. When users DO use --verbose, condition 4 (cache ratio) would skip if 80%+ cached.
