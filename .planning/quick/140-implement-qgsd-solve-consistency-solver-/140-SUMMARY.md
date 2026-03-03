---
phase: quick-140
plan: 01
type: execute
subsystem: Verification Integration
tags: [consistency-solver, layer-transitions, residual-vector, formal-verification]
objectives_met: 3/3
status: complete
completed_date: 2026-03-03
duration_minutes: 15

key_files:
  created:
    - bin/qgsd-solve.cjs (759 lines)
    - bin/qgsd-solve.test.cjs (349 lines)
    - commands/qgsd/solve.md
  modified: []

decisions: []
deviations: none
---

# Quick Task 140: Implement /qgsd:solve Consistency Solver Command

## Summary

Implemented a comprehensive consistency solver (`/qgsd:solve`) that sweeps across 5 layer transitions (Requirements→Formal→Tests→Code) and computes a residual vector showing gaps at each boundary. The solver can operate in read-only mode (single sweep with reporting) or iterative mode (auto-closing gaps up to 3 iterations until convergence).

### One-liner

Full-stack consistency orchestrator that sweeps layer transitions R→F, F→T, C→F, T→C, F→C with auto-close iteration and converged reporting

## Tasks Completed

### Task 1: Build bin/qgsd-solve.cjs consistency solver orchestrator ✓

**Implemented features:**

1. **CLI flags:**
   - `--report-only`: Single sweep, no mutations
   - `--max-iterations=N`: Override default 3 (min 1, max 10)
   - `--json`: Machine-readable output
   - `--verbose`: Pipe child process stderr to parent stderr

2. **Core layer transition sweeps (5 total):**
   - **R→F (Requirements→Formal):** Spawns `generate-traceability-matrix.cjs --json --quiet`, extracts uncovered requirement count from coverage_summary
   - **F→T (Formal→Tests):** Spawns `formal-test-sync.cjs --json --report-only`, extracts gap_count from coverage_gaps
   - **C→F (Code→Formal):** Spawns `formal-test-sync.cjs --json --report-only` (cached result reused from F→T), filters constants_validation for mismatches
   - **T→C (Tests→Code):** Runs `node --test`, parses TAP output for test failure count
   - **F→C (Formal→Code):** Spawns `run-formal-verify.cjs` (300s timeout, expensive), parses `.formal/check-results.ndjson` for failure counts. In report-only mode, reads stale check-results.ndjson without re-running

3. **Convergence detection:**
   - Compares residual total between iterations: if unchanged, sets converged=true
   - Also exits on zero residual or after max iterations
   - Respects ConvergenceEventuallyResolves invariant: always terminates and writes output

4. **Auto-close mechanism:**
   - **F→T gaps:** Runs `formal-test-sync.cjs` without flags to generate test stubs and update sidecar
   - **Other gaps:** Logs messages; does NOT auto-fix (constants, tests, formal models too risky)

5. **Health indicators:**
   - -1 (unknown): "? UNKNOWN"
   - 0: "OK GREEN"
   - 1-3: "!! YELLOW"
   - 4+: "XX RED"

6. **Output formats:**
   - **Human-readable:** Residual vector table with health indicators + per-layer detail sections (uncovered reqs, gaps, mismatches, failed tests, failed checks)
   - **JSON:** solver_version, generated_at, iteration_count, max_iterations, converged, residual_vector, iterations, health

7. **Exports for testing:**
   - sweep, computeResidual, autoClose, formatReport, formatJSON, healthIndicator

**Lines:** 759 (exceeds 250 minimum)

### Task 2: Create test suite and skill definition ✓

**bin/qgsd-solve.test.cjs (349 lines):**
- **TC-HEALTH:** 4 tests for healthIndicator() function (UNKNOWN, GREEN, YELLOW, RED)
- **TC-FORMAT:** 3 tests for formatReport() (converged, non-converged, table structure)
- **TC-JSON:** 3 tests for formatJSON() (required keys, all-green residuals, iterations array)
- **TC-INT:** 4 integration tests spawning actual CLI (JSON output, human-readable output, max-iterations flag, verbose mode)
- **TC-CONV:** 2 tests for convergence logic (report-only = 1 iteration, max-iterations limits)
- **Total: 16 tests, all passing**

**commands/qgsd/solve.md:**
- Skill definition with frontmatter (name: qgsd:solve, description, argument hints)
- Objective, execution context, and process sections
- Documentation of layer transitions, health indicators, and interpretation guide

## Verification Results

✓ `node bin/qgsd-solve.cjs --report-only` — prints residual vector with health indicators for all 5 layers
✓ `node bin/qgsd-solve.cjs --json --report-only` — valid JSON with residual_vector, converged, iteration_count keys
✓ `node --test bin/qgsd-solve.test.cjs` — all 16 tests pass
✓ `cat commands/qgsd/solve.md` — skill definition exists with correct frontmatter
✓ `node -e "const s = require('./bin/qgsd-solve.cjs'); console.log(typeof s.healthIndicator)"` — prints `function`

## Current Residual State

Initial sweep on project shows:
- R→F: 41 uncovered requirements (RED)
- F→T: 164 formal-test gaps (RED)
- C→F: 2 constant mismatches (YELLOW)
- T→C: 0 test failures (GREEN)
- F→C: 1 formal check failure (YELLOW)
- **Total: 208 residual**

## Deviations

None — plan executed exactly as written.

## Implementation Notes

- **Optimization:** F→T and C→F both invoke `formal-test-sync.cjs --json --report-only`. Implemented caching: tool runs once, both sweeps extract from cached result.
- **Fail-open:** All spawned tools return `{ ok: false, residual: -1, detail: { error: ... } }` on failure; solver continues with partial results
- **Export-for-testing pattern:** Functions exported via `module.exports` while CLI only runs under `if (require.main === module)` gate, enabling testability without polluting the namespace
- **Shebang & strict:** Follows bin/ conventions with `#!/usr/bin/env node` and `'use strict'`

## Success Criteria Confirmation

- [x] `node bin/qgsd-solve.cjs --json --report-only` exits with valid JSON containing residual_vector
- [x] `node bin/qgsd-solve.cjs --report-only` exits with human-readable report containing health indicators
- [x] `node --test bin/qgsd-solve.test.cjs` exits 0 (all tests pass)
- [x] `commands/qgsd/solve.md` exists with `name: qgsd:solve` in frontmatter
- [x] Core functions (computeResidual, healthIndicator, formatReport, formatJSON) are exported for testability
