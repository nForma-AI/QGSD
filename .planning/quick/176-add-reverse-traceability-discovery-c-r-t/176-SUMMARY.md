# Quick Task 176: Add Reverse Traceability Discovery

## What Changed

### bin/qgsd-solve.cjs
- Added 3 reverse sweep functions: `sweepCtoR()`, `sweepTtoR()`, `sweepDtoR()`
- Added `assembleReverseCandidates()` with dedup, filtering, and acknowledged-not-required.json support
- Integrated into `computeResidual()` — reverse layers tracked separately, do NOT inflate automatable total
- New `reverse_discovery_total` field in residual vector
- Updated `formatReport()` with "Reverse Traceability Discovery" section and per-layer detail
- Updated `formatJSON()` with health indicators for reverse layers, solver_version bumped to 1.2
- Exported all 4 new functions for testing
- Max candidate cap at 200 (R3.6 improvement from copilot-1)
- Dedup logging in verbose mode (R3.6 improvement from opencode-1)

### commands/qgsd/solve.md
- Added Step 3h: Reverse Traceability Discovery (C→R + T→R + D→R)
- Defined two-step pattern: autonomous discovery → human approval
- Defined user input routing: accept numbers/all, reject via "none" → acknowledged-not-required.json, skip
- Added Constraint 7: reverse flows never auto-remediate (human gate prevents unbounded expansion)
- Updated cascade awareness note for reverse→forward flow

### bin/sweep-reverse.test.cjs (new)
- 26 tests across 6 suites, all passing
- Tests for each scanner (shape, residual consistency, filtering)
- Tests for dedup logic (test+source merge, .planning/ filtering, generated-stubs filtering)
- Integration tests verifying reverse residuals excluded from total
- Format tests verifying JSON health indicators and solver version

## Design Decisions
- **Scan scope**: Only bin/ and hooks/ for C→R (public API surface, not internal files)
- **Action verb detection**: D→R extracts capability claims using 15 action verbs (supports, enables, provides, etc.)
- **Keyword overlap threshold**: 3+ keywords (same as existing sweepRtoD for consistency)
- **Human gate**: Prevents unbounded requirement expansion feedback loop
- **Acknowledged-not-required.json**: Previously rejected candidates not resurfaced
