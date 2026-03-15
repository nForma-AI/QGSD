---
phase: quick-298
plan: 01
type: execute
subsystem: test-harness
tags: [v8-coverage, performance, compression, test-diagnostics]
date: 2026-03-15
status: completed
commits:
  - 804a96e0: "feat(quick-298): digest V8 coverage at collection time in sweepTtoC"
key_files:
  created: []
  modified:
    - bin/nf-solve.cjs
    - bin/nf-solve.test.cjs
decisions: []
---

# Quick Task 298: Digest V8 Coverage at Collection Time Summary

Implemented lightweight V8 coverage digestion in sweepTtoC, reducing raw ~96MB JSON blobs to ~50KB per-file format (~99.5% compression).

## Objective

Eliminate massive raw V8 JSON coverage data from solve output by digesting it at collection time into a minimal format containing only covered/uncovered line sets per file.

## What Was Built

### 1. digestV8Coverage Function (bin/nf-solve.cjs)
- **Purpose:** Convert raw V8 coverage array (array of {result[], functions[], ranges[]}) to lightweight digest format
- **Input:** Array of V8 coverage entries from NODE_V8_COVERAGE temp dir
- **Output:** `{ files: { [absolutePath]: { covered: number[], uncovered: number[] } } }`
- **Key features:**
  - Extracts and resolves file paths from file:// URLs
  - Skips internal node: URLs
  - Builds line offset array from source text when available
  - Maps function ranges to line numbers using offset calculation
  - Falls back to file-level granularity (boolean marker) if source text unavailable
  - Deduplicates and sorts line arrays
  - Fail-open: skips any entry that throws, continues processing

### 2. sweepTtoC Integration (lines 976-980)
- Added digest call immediately after coverage collection, before coverage storage in detail.v8_coverage
- Raw V8 data becomes GC-eligible after digestion
- Backward compatible: checks for null/empty before digestion

### 3. crossReferenceFormalCoverage Enhancement (lines 1142-1153)
- Added format detection: checks for `.files` property (digest) vs `Array.isArray` (legacy)
- **Digest format path:** Direct file key lookup from digest.files object
- **Legacy path:** Original parsing logic for pre-digest raw arrays
- Both formats produce identical `coveredFiles` Set for downstream recipe matching
- Rest of function (recipe matching, false-green detection) unchanged

### 4. Module Export
- Added `digestV8Coverage` to module.exports for direct testing

### 5. Test Suite (bin/nf-solve.test.cjs)
Five new tests validating the digest function:

| Test | Purpose | Result |
|------|---------|--------|
| DIGEST-1 | Null-safe input handling | PASS |
| DIGEST-2 | File path extraction from V8 format | PASS |
| DIGEST-3 | Size reduction verification (99.5% compression) | PASS |
| DIGEST-4 | crossReferenceFormalCoverage digest format compatibility | PASS |
| DIGEST-5 | sweepTtoC output format verification | PASS |

## Technical Details

### Line Offset Calculation
The digest builds a line offset array from source text by finding all newline positions:
```javascript
const lineOffsets = [0];  // First line at offset 0
for (let i = 0; i < source.length; i++) {
  if (source[i] === '\n') {
    lineOffsets.push(i + 1);  // Next line starts after newline
  }
}
```

### Range-to-Line Mapping
For each function range (startOffset, endOffset, count):
1. Find startLine: first lineOffset > startOffset
2. Find endLine: first lineOffset >= endOffset
3. Lines with count > 0 go to `covered`; others to `uncovered`
4. Deduplicate and sort

### Size Reduction
Test with 100 file entries, 10KB source each:
- **Raw:** ~1,012 KB JSON
- **Digest:** ~5.2 KB JSON
- **Compression:** 99.5% reduction

### Fail-Open Behavior
Three fallback paths ensure no crashes:
1. If coverageData is null/empty → return null (no digest created)
2. If entry throws → skip that entry, continue processing others
3. If source unavailable → use file-level boolean marker instead of line granularity

## Verification Results

```
✔ DIGEST-1: digestV8Coverage returns null-safe on null/undefined input
✔ DIGEST-2: digestV8Coverage extracts file paths from V8 format
✔ DIGEST-3: digestV8Coverage output is dramatically smaller than input
✔ DIGEST-4: crossReferenceFormalCoverage works with digest format
✔ DIGEST-5: sweepTtoC v8_coverage is digest format (not raw array)
```

All tests pass. Existing TC-COV tests continue to pass with legacy format support.

## Deviations from Plan

None — plan executed exactly as written. All must-haves achieved:

✅ sweepTtoC stores lightweight digest (~50KB) instead of raw V8 blobs (~96MB)
✅ crossReferenceFormalCoverage produces identical results from digest format
✅ Raw V8 coverage data is GC-eligible immediately after digestion
✅ All existing tests pass without modification
✅ 5 new DIGEST tests validate the implementation

## Impact

- **Memory:** Raw V8 coverage data (96MB per solve) freed immediately after digestion
- **Serialization:** Output size reduced by ~99.5% for coverage portion
- **Performance:** Faster JSON stringify/parse of solve output
- **Compatibility:** Legacy raw array format still supported during transition
- **Testing:** 5 new tests document digest behavior and size compression

## Files Changed

- `bin/nf-solve.cjs` — digestV8Coverage function, sweepTtoC wiring, crossReferenceFormalCoverage dual-format support, export
- `bin/nf-solve.test.cjs` — import digestV8Coverage, add 5 DIGEST tests

**Commit:** 804a96e0
