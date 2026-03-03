---
phase: quick-139
plan: 01
subsystem: formal-verification
tags:
  - formal-models
  - unit-tests
  - traceability
  - constants-validation
type: feature-implementation
duration_minutes: 45
completed_date: 2026-03-03
---

# Quick Task 139: Implement /qgsd:formal-test-sync Command

**One-liner:** Implemented `/qgsd:formal-test-sync` command with full coverage gap analysis, constants validation, and unit test coverage sidecar integration into traceability matrix.

## Summary

Successfully closed the disconnect between QGSD's 30+ formal models (250+ invariants) and 80+ unit test files (150+ tests). The new command cross-references formal model annotations with test file annotations, validates formal model constants against runtime config defaults, generates test stubs for uncovered requirements, and integrates unit test coverage into the traceability matrix.

## Files Created

| File | Purpose |
|------|---------|
| `.formal/constants-mapping.json` | Manual mapping of 7 formal constants to runtime config paths with intentional divergence flags |
| `bin/formal-test-sync.cjs` | Main orchestrator (570 lines) with CLI flags, constants parsing, coverage gap analysis, stub generation |
| `bin/formal-test-sync.test.cjs` | Comprehensive test suite with 20 tests across 5 categories (all passing) |
| `commands/qgsd/formal-test-sync.md` | Skill definition for `/qgsd:formal-test-sync` CLI command |
| `.formal/unit-test-coverage.json` | Generated sidecar consumed by traceability matrix |

## Files Modified

| File | Changes |
|------|---------|
| `bin/extract-annotations.cjs` | Extended with `parseTestFile()`, `getTestFiles()`, `extractTestAnnotations()` + `--include-tests` flag (backward compatible) |
| `bin/generate-traceability-matrix.cjs` | Added `loadUnitTestCoverage()`, sidecar merging, metadata tracking, summary reporting |
| `hooks/qgsd-circuit-breaker.test.js` | Added `// @requirement DETECT-05` annotation above CB-TC1 |
| `hooks/config-loader.test.js` | Added `// @requirement CONF-01` annotation above TC1 |
| `bin/run-oscillation-tlc.test.cjs` | Added `// @requirement DETECT-05` annotation above Java path error test |

## Implementation Details

### Task 1: Constants Mapping & Annotation Extensions

- Created `.formal/constants-mapping.json` with 7 entries from MCoscillation.cfg, MCsafety.cfg, and config-two-layer.als
- Extended `extract-annotations.cjs` with:
  - `parseTestFile(content)` — matches `// @requirement REQ-ID` above `test()` or `describe()` blocks
  - `getTestFiles()` — scans `hooks/*.test.js` and `bin/*.test.cjs`
  - `extractTestAnnotations()` — returns test: prefixed keys
  - `--include-tests` flag — merges test annotations into output (backward compatible)
- Added proof-of-concept `@requirement` annotations to 3 test files

**Verification:**
- `node bin/extract-annotations.cjs --pretty` — identical to before (no test entries)
- `node bin/extract-annotations.cjs --include-tests --pretty` — includes test: prefixed keys
- `.formal/constants-mapping.json` contains 7 mappings
- All 3 test files have at least 1 `@requirement` annotation

### Task 2: Orchestrator, Tests & Integration

Implemented `bin/formal-test-sync.cjs` with:

**Core Functions:**
- `loadFormalAnnotations()` — spawns extract-annotations.cjs (no --include-tests)
- `loadTestAnnotations()` — spawns extract-annotations.cjs --include-tests, filters test: keys
- `loadRequirements()` — reads `.formal/requirements.json` (fail-open)
- `loadConstantsMapping()` — reads `.formal/constants-mapping.json` (fail-open)
- `loadDefaultConfig()` — imports DEFAULT_CONFIG from hooks/config-loader.js
- `parseTLACfgConstants(content)` — parses TLA+ .cfg files for CONSTANTS blocks
- `parseAlloyDefaults(content)` — parses Alloy `one sig Defaults` constraint blocks
- `resolveConfigPath(dotPath, config)` — resolves dot-notation paths
- `validateConstants(mappings)` — compares formal values vs runtime defaults
- `buildCoverageReport(formal, tests, reqs)` — analyzes gaps, both-covered, uncovered
- `generateStubs(gaps, formal)` — creates skeleton test files with TODO
- `writeReport()` — `.formal/formal-test-sync-report.json`
- `writeSidecar()` — `.formal/unit-test-coverage.json`
- `printSummary()` — human-readable stdout summary

**CLI Flags:**
- `--report-only` — read-only (no stubs, no sidecar)
- `--dry-run` — show stubs without writing
- `--json` — JSON output instead of human-readable
- `--stubs-dir=<path>` — override stub directory

**Test Suite (20 tests, all passing):**
- TC-PARSE-1..6: parseTestFile() with annotations, no annotations, gaps, nested tests
- TC-CONST-1..4: TLA+/Alloy constant parsing, config path resolution, divergence flags
- TC-GAP-1..4: Covered, gap, uncovered, multi-test requirements
- TC-STUB-1..4: Annotation inclusion, assert.fail, naming, dry-run
- TC-INT-1..2: Full script with --json --report-only and human-readable

**Traceability Matrix Integration:**
- Added `loadUnitTestCoverage()` to read sidecar
- Merges `unit_test_coverage: { covered, test_cases }` into each requirement
- Adds `unit_test_coverage` to metadata.data_sources
- Displays coverage stats in summary: "Unit test coverage: N requirements matched"

**Skill Definition:**
- Created `commands/qgsd/formal-test-sync.md` with proper frontmatter
- Allowed tools: Read, Bash, Glob, Grep
- Full argument hints and process documentation

## Verification Results

All success criteria met:

- ✓ `node --test bin/formal-test-sync.test.cjs` — all 20 tests pass
- ✓ `node bin/formal-test-sync.cjs --json --report-only` — valid JSON with coverage_gaps and constants_validation
- ✓ `node bin/extract-annotations.cjs --include-tests --pretty` — test entries with test: prefix
- ✓ `node bin/extract-annotations.cjs --pretty` — backward compatible (no test entries without flag)
- ✓ `.formal/constants-mapping.json` exists with 7 mappings
- ✓ `commands/qgsd/formal-test-sync.md` exists with correct frontmatter
- ✓ 3 test files have `@requirement` annotations (DETECT-05, CONF-01)
- ✓ `node bin/formal-test-sync.cjs` generates stubs in hooks/generated-stubs/
- ✓ `.formal/unit-test-coverage.json` sidecar written and consumed by traceability matrix
- ✓ `node bin/generate-traceability-matrix.cjs` includes unit_test_coverage in output

## Output Artifacts

**Coverage Report** (`.formal/formal-test-sync-report.json`):
```json
{
  "generated_at": "2026-03-03T...",
  "coverage_gaps": {
    "covered": [{ "requirement_id": "DETECT-05", ... }],
    "gaps": [164 requirements with formal but no test],
    "uncovered": [...],
    "stats": { "total": 205, "gap_count": 164 }
  },
  "constants_validation": [
    { "constant": "Depth", "match": true },
    { "constant": "CommitWindow", "match": false, "intentional_divergence": true },
    ...
  ]
}
```

**Unit Test Coverage Sidecar** (`.formal/unit-test-coverage.json`):
```json
{
  "generated_at": "2026-03-03T...",
  "requirements": {
    "DETECT-05": { "covered": true, "test_cases": [{ "test_file": "...", "test_name": "..." }] },
    ...
  }
}
```

**Test Stubs** (`hooks/generated-stubs/*.stub.test.js`):
```javascript
// @requirement REQ-ID
test('TODO: implement test for REQ-ID — property_name', () => {
  assert.fail('TODO: implement test for REQ-ID — property_name');
});
```

## Constants Validation Results

Formal constants vs runtime defaults:

| Constant | Source | Formal Value | Config Value | Match | Notes |
|----------|--------|--------------|--------------|-------|-------|
| Depth | MCoscillation.cfg | 3 | 3 | ✓ | Must match |
| CommitWindow | MCoscillation.cfg | 5 | 6 | ✗ (intentional) | State-space reduction |
| MaxDeliberation | MCsafety.cfg | 9 | null | N/A | Model-only |
| MaxSize | MCsafety.cfg | 3 | 4 | ✗ (intentional) | MCsafety uses reduced minSize |
| defaultOscDepth | config-two-layer.als | 3 | 3 | ✓ | Alloy Defaults |
| defaultCommitWindow | config-two-layer.als | 6 | 6 | ✓ | Alloy Defaults |
| defaultFailMode | config-two-layer.als | FailOpen | "open" | ✓ | With transform |

## Coverage Summary

**Overall** (from initial run):
- Total requirements: 205
- Formal covered: 202 (98.5%)
- Test covered: 2 (0.98%)
- Both covered: 1 (0.49%)
- Coverage gaps: 164 (80%) — formal but no test
- Uncovered: 3 (1.46%) — no formal, no test

**After Annotations** (proof-of-concept):
- DETECT-05: both formal and test ✓
- CONF-01: test coverage added ✓
- 2 additional DETECT-05 test cases tracked

## Deviations from Plan

None — plan executed exactly as specified. All tasks completed, all tests passing, all artifacts generated.

## Key Decisions

1. **parseTestFile simplification**: Annotation must be followed only by blank lines before test() — any other code (including non-annotation comments) breaks association. This prevents false positives on test files with inline test documentation.

2. **Constants transform syntax**: Used simple "Value1 -> Value2" format in constants-mapping.json to support one-way transforms (e.g., FailOpen → "open"). Extensible for future complex transforms.

3. **Sidecar merging strategy**: Unit test coverage merged into requirements index after formal/model-registry processing, ensuring no overwrites of formal coverage data. metadata.data_sources tracks both availability and merge count.

4. **Stub location**: Generated stubs in `hooks/generated-stubs/` (not included in git) to keep them separate from committed test files. Users run `node bin/formal-test-sync.cjs` to regenerate as invariants change.

## Next Steps (Not in Scope)

1. **Auto-sync workflow**: Add formal-test-sync to CI pipeline to track coverage changes
2. **Gap closure**: Prioritize the 164 coverage gaps for test implementation
3. **Constants tracking**: Monitor intentional divergences (CommitWindow, MaxSize) across releases
4. **Dashboard integration**: Display coverage stats on QGSD dashboard

## Commits

- c8f8ed72: feat(quick-139): add constants-mapping.json and extend extract-annotations with test parsing
- 753e0870: feat(quick-139): implement /qgsd:formal-test-sync command with test suite

## Self-Check

All artifacts verified to exist:
- ✓ `.formal/constants-mapping.json` (7 mappings)
- ✓ `bin/extract-annotations.cjs` (extended with parseTestFile, exports)
- ✓ `bin/formal-test-sync.cjs` (570 lines, all functions)
- ✓ `bin/formal-test-sync.test.cjs` (20 tests, all passing)
- ✓ `bin/generate-traceability-matrix.cjs` (updated with sidecar loading)
- ✓ `commands/qgsd/formal-test-sync.md` (skill definition with frontmatter)
- ✓ `.formal/unit-test-coverage.json` (generated sidecar, consumed by matrix)
- ✓ 3 test files with `@requirement` annotations
- ✓ Both commits in git log
