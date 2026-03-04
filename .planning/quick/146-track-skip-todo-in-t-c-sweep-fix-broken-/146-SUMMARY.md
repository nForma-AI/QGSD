---
phase: quick-146
plan: 01
type: summary
executed: 2026-03-04
duration_seconds: 352
status: completed
---

# Quick Task 146: TAP Regex Fix for Node v25 and Skip/Todo Tracking in SweepTtoC

**One-liner:** Fixed TAP output regex in sweepTtoC() to support both Node v24 (#) and v25+ (ℹ) prefixes while adding skip/todo count tracking to improve test residual calculation.

## Objective

Fix broken TAP regex in sweepTtoC() that only matches `#` prefix (Node <= v24) but not `i` prefix (Node v25+), and add skip/todo tracking to the T->C residual detail. Node v25 changed TAP summary output from `# tests N` to `ℹ tests N`. The current regex silently fell back to ok/not-ok counting, missing skip/todo entirely. This makes the solver blind to skipped tests that inflate residual noise.

## Execution Summary

### Task 1: Fix TAP Regex and Add Skip/Todo Parsing in sweepTtoC

**Status:** COMPLETED

- Updated sweepTtoC() function (lines 548-608) with dual-format character class regex `[ℹ#]` matching both Node formats
- Added parsing for `skipMatch` and `todoMatch` in addition to existing testsMatch and failMatch
- Updated residual calculation: `residual = failCount + skipCount` (skips are unresolved gaps)
- Enhanced detail object to include all four counters: `total_tests`, `passed`, `failed`, `skipped`, `todo`
- Preserved fallback block for edge cases where no summary line is found
- Updated formatReport() T->C section (lines 1222-1230) to display fail/skip/todo with Unicode symbols:
  - `✗` (U+2717) for failed
  - `⊘` (U+2298) for skipped
  - `⬗` (U+25F7) for todo
- Exported sweepTtoC function in module.exports for testing
- **Commit:** ad822689

### Task 2: Add Unit Tests for Dual-Format TAP Parsing and Skip/Todo

**Status:** COMPLETED

- Added sweepTtoC to destructured imports (line 33)
- Updated TC-FORMAT-2 test mock to include `skipped: 0, todo: 0` in detail object (line 95)
- Added four new test cases covering:
  - TC-TAP-PARSE-1: Verify ℹ prefix regex matches Node v25 output (42 tests, 1 fail, 1 skip)
  - TC-TAP-PARSE-2: Verify # prefix still works for Node <= v24 (10 tests, 2 fail, 0 skip)
  - TC-TAP-PARSE-3: Verify skip and todo count extraction from TAP output
  - TC-RESIDUAL-SKIP-1: Integration test verifying `residual = failed + skipped` invariant via sweepTtoC() call
- All 33 tests pass (0 failures)
- **Commit:** 266fc80a

### Task 3: Update solve.md Remediation Dispatch for Skips

**Status:** COMPLETED

- Updated Step 3c "T->C Gaps" section with detailed explanation of skip/todo semantics:
  - `detail.failed`: tests that ran and failed
  - `detail.skipped`: tests marked skip (count as unresolved gaps)
  - `detail.todo`: tests marked todo (informational only, do not inflate residual)
- Enhanced dispatch guidance to treat skipped tests as fix targets: "This will discover and autonomously fix failing AND skipped tests"
- Updated log format to show both metrics: `"Dispatching T->C remediation: fix-tests for {failed} failing + {skipped} skipped tests"`
- Updated Step 6 "Before/After Summary" T->C expansion format:
  - Changed from: "Failed tests: N / M"
  - Changed to: "Tests: N failed, N skipped, N todo (of M total)"
- Added example T->C expansion showing test count breakdown
- **Commit:** 54d7f780

## Verification Results

✓ **All Tests Pass:** `node --test bin/qgsd-solve.test.cjs` — 33/33 tests passing, 0 failures

✓ **Dual-Format Regex:** `grep -c 'ℹ#' bin/qgsd-solve.cjs` — Returns 4 (all four TAP fields: tests, fail, skipped, todo)

✓ **Function Export:** `node -e "const s = require('./bin/qgsd-solve.cjs'); console.log(typeof s.sweepTtoC)"` — Prints "function"

✓ **Detail Fields:** `node -e "const s = require('./bin/qgsd-solve.cjs'); const d = s.sweepTtoC().detail; console.log('skipped' in d, 'todo' in d)"` — Prints "true true"

✓ **Skip-Aware Docs:** `grep 'skipped' commands/qgsd/solve.md` — Shows skip-aware remediation text in 3+ locations

## Success Criteria

- [x] sweepTtoC matches both # and ℹ TAP prefixes without regression
- [x] detail object contains failed, skipped, and todo counts
- [x] residual = failed + skipped (todo is informational only)
- [x] formatReport T->C section shows expanded fail/skip/todo breakdown with Unicode symbols
- [x] solve.md dispatches fix-tests for skip > 0 (not just fail > 0)
- [x] All existing + 4 new tests pass (33 total)

## Deviations from Plan

None — plan executed exactly as written.

## Key Files Modified

| File | Changes |
|------|---------|
| `bin/qgsd-solve.cjs` | Dual-format TAP regex, skip/todo parsing, formatReport enhancement, sweepTtoC export |
| `bin/qgsd-solve.test.cjs` | sweepTtoC import, TC-FORMAT-2 mock update, 4 new test cases |
| `commands/qgsd/solve.md` | Step 3c skip/todo semantics, Step 6 T->C expansion format, example output |

## Technical Notes

- The dual-format regex `[ℹ#]` handles both Unicode info symbol (Node v25+) and # (Node <= v24) in character class
- Residual calculation now properly counts skipped tests as unresolved gaps alongside failures
- The detail object maintains backward compatibility while adding new skip/todo fields
- formatReport output uses Unicode symbols for visual clarity: ✗ (fail), ⊘ (skip), ⬗ (todo)

## Metrics

- **Duration:** 352 seconds (5.9 minutes)
- **Tasks Completed:** 3/3
- **Commits:** 3
- **Tests:** 33/33 passing
- **Files Modified:** 3
