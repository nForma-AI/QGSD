---
phase: quick-260
plan: 01
subsystem: observe-pipeline
tags: [clustering, error-patterns, observe, solve-pipeline]
dependency_graph:
  requires: [bin/levenshtein.cjs, bin/memory-store.cjs]
  provides: [bin/error-clusterer.cjs]
  affects: [bin/observe-handler-internal.cjs]
tech_stack:
  added: []
  patterns: [two-phase-clustering, levenshtein-similarity, greedy-single-linkage]
key_files:
  created: [bin/error-clusterer.cjs, test/error-clusterer.test.cjs]
  modified: [bin/observe-handler-internal.cjs]
decisions:
  - "Default Levenshtein threshold 0.7 for sub-clustering within type groups"
  - "Added ExitCode, RuntimeError, ToolError (exceeds) patterns beyond plan spec to reduce Unknown entries"
  - "Shell escaping regex /\\!/ matches literal backslash+bang in symptom strings from errors.jsonl"
metrics:
  duration: "8 min"
  completed: "2026-03-10"
---

# Quick 260 Plan 01: Smart Error Clustering for Category 16 Summary

Two-phase error clustering using regex type extraction + Levenshtein sub-clustering, wired into observe pipeline Category 16 to replace per-entry emission.

## What Was Done

### Task 1: Create bin/error-clusterer.cjs
- Created pure function module exporting `clusterErrors(entries, options)`
- Phase 1: regex-based error type extraction (ShellEscaping, SyntaxError, TypeError, ReferenceError, ENOENT, CannotFindModule, ToolError, ExitCode, RuntimeError)
- Phase 2: Levenshtein sub-clustering within each type group using greedy single-linkage (threshold 0.7)
- Cluster objects include: clusterId, label, errorType, count, entries, representative, stale, avgConfidence
- Staleness detection: clusters with all entries >7 days old marked stale
- Confidence aggregation: highest confidence level in cluster wins
- Commit: `16074cf9`

### Task 2: Update Category 16 in observe-handler-internal.cjs
- Replaced per-entry `for` loop with `clusterErrors()` call
- Filtered actionable entries (root_cause || fix) before clustering
- Emit one issue per cluster with ID format `internal-error-cluster-{clusterId}`
- Stale clusters get severity `info`, active clusters get `warning`
- Added `_cluster_count` field for downstream consumers
- Commit: `a7f47caa`

### Task 3: Test coverage for error-clusterer.cjs
- 12 test cases covering: empty input, single entry, shell escaping grouping, ENOENT grouping, mixed types, Levenshtein sub-clustering, staleness detection, missing fields, no-ts entries, confidence aggregation, cluster shape, representative selection
- All tests pass with `node --test test/error-clusterer.test.cjs`
- Commit: `65a61df9`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed shell escaping regex for literal backslash matching**
- **Found during:** Task 1 verification against real data
- **Issue:** JS regex literal `/\\!/` matches just `!` (not backslash+bang) because `\!` is not a recognized regex escape. The actual errors.jsonl data contains literal `\!` (char 92 + char 33).
- **Fix:** Used `/\\!/` with proper escaping (two backslashes in source = one literal backslash in regex pattern). Fixed test strings to use `\\\\!` in JS string literals to produce actual `\!` characters.
- **Files modified:** bin/error-clusterer.cjs, test/error-clusterer.test.cjs
- **Commit:** `b5c4ce71`

**2. [Rule 2 - Missing functionality] Added additional error type patterns**
- **Found during:** Task 1 verification against real data
- **Issue:** Many real errors.jsonl entries fell into "Unknown" category (5 of 22) because patterns only covered standard JS error types.
- **Fix:** Added ExitCode, RuntimeError (Deadlock, throw), and ToolError (exceeds maximum) patterns. Reduced Unknown entries from 5 to 1.
- **Files modified:** bin/error-clusterer.cjs
- **Commit:** `b5c4ce71`

## Verification Results

- Real data: 22 errors.jsonl entries -> 17 clusters (9 ShellEscaping entries collapsed to 5 sub-clusters, 3 CannotFindModule to 2, etc.)
- The plan's "3-5 clusters" target was aspirational; actual data has 8+ distinct error types with many singleton entries that cannot be merged. The key reduction is in the major groups (ShellEscaping 9->5, CannotFindModule 3->2).
- All 12 tests pass
- Handler loads without syntax errors
- No modifications to debt-dedup.cjs, fingerprint-issue.cjs, or solve-debt-bridge.cjs

## Self-Check: PASSED

All files exist, all commits verified, all tests pass.
