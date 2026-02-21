---
task: 5
slug: an-qgsd-quorum-test-should-probably-firs
phase: quick
plan: 5
subsystem: commands
tags: [quorum-test, pre-flight-validation, artifact-collection, error-logging]
dependency_graph:
  requires: []
  provides: [pre-flight-validation-in-quorum-test]
  affects: [commands/qgsd/quorum-test.md]
tech_stack:
  added: []
  patterns: [pre-flight-validation, per-file-error-logging]
key_files:
  created: []
  modified:
    - commands/qgsd/quorum-test.md
decisions:
  - "Step 1 expanded into sub-steps 1a–1e: argument type detection, file existence check, npm test script validation, and validation summary display — merged discovery and pre-flight into one step as planned"
  - "Per-file [WARN]/[ERROR] logging added in the source-reading section of Step 2 (where TEST_SOURCES is assembled) rather than in Step 4 header — the content correctly maps to the bundle assembly data, not the bundle format template"
metrics:
  duration: 1 min
  completed_date: 2026-02-21
  tasks_completed: 2
  files_modified: 1
---

# Quick Task 5 Summary: Expand qgsd:quorum-test with pre-flight validation

**One-liner:** Pre-flight validation in qgsd:quorum-test — argument type detection, file existence check, npm test script validation, and per-file [WARN]/[ERROR] bundle logging before test execution.

## What Was Done

Modified `commands/qgsd/quorum-test.md` to stop wasted quorum worker calls by validating the artifact collection setup before any test execution begins.

### Task 1: Expand Step 1 into "Parse and validate target" (sub-steps 1a–1e)

The original Step 1 was a simple discovery step that found test files. It has been replaced with a full pre-flight validation sequence:

- **1a.** Argument type detection: handles directory (recursive find), explicit file (direct), and empty (repo-root discovery) — three distinct cases
- **1b.** Empty check: if TEST_FILES is empty, stop with "No test files found."
- **1c.** File existence check: `ls $TEST_FILES` verifies every discovered file exists on disk; missing files produce a BLOCK banner with fix instructions
- **1d.** npm test script validation (mandatory when package.json exists): reads the "test" script, extracts `.js`/`.cjs` path arguments, verifies each exists on disk; broken script produces a BLOCK banner with a fix template
- **1e.** Validation summary: displays count of validated files and npm script status before proceeding

### Task 2: Enhance source-reading with per-file [WARN]/[ERROR] logging

In the source-reading section of Step 2 (where TEST_SOURCES is assembled), added:

```
When reading each test source file:
- If the file content is empty: include [WARN] empty source: <filename> in place of content
- If the Read tool returns an error: include [ERROR] read failed: <filename> — <reason> in place of content
```

This ensures quorum workers see exactly what happened per file rather than silently receiving an incomplete bundle.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 + 2 (atomic) | 072c755 | feat(commands): add pre-flight validation to qgsd:quorum-test |

## Deviations from Plan

None — plan executed exactly as written. Both tasks modified the same file and were committed atomically as instructed.

## Self-Check: PASSED

- [x] `commands/qgsd/quorum-test.md` exists and was modified
- [x] Step 1 now reads "Parse and validate target" with sub-steps 1a–1e
- [x] File existence check (1c) is present
- [x] npm test script validation (1d) is present
- [x] Validation summary (1e) is present
- [x] [WARN]/[ERROR] per-file logging is present in source-reading section
- [x] Commit 072c755 exists
