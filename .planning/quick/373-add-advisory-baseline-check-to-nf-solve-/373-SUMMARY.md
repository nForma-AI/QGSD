---
phase: quick-373
plan: 01
subsystem: nf-solve
tags: [baseline-advisory, diagnostics, requirements, DIAG-02]
status: completed
dependencies:
  requires: [DIAG-02]
  provides: [baseline-awareness, baseline-nudge, require-baselines-flag]
  affects: [nf-solve, nf-progress, solve.md]
tech_stack:
  added: [baseline_advisory field, checkBaselinePresence function, baseline_hint augmentation]
  patterns: [fail-open JSON parsing, advisory emissions, flag forwarding]
key_files:
  created:
    - bin/nf-solve-baseline-check.test.cjs
  modified:
    - bin/nf-solve.cjs
    - commands/nf/solve.md
    - core/workflows/progress.md
decisions:
  - baseline_advisory goes on jsonObj (--json output), not solveState (persistence)
  - Baseline hint added to DIAG-02 layers (R→D, C→R, D→R) when requirements.json missing
  - Progress nudge shows when baselines absent and formal coverage available
  - checkBaselinePresence() uses fail-open for JSON parse errors
metrics:
  duration: ~15 minutes
  tasks_completed: 2
  files_modified: 3
  test_cases: 6 (all passing)
completion_date: 2026-04-03
---

# Quick Task 373: Add Advisory Baseline Check to nf:solve

**One-liner:** Emit stderr advisory when requirements.json has no baseline-sourced requirements, add --require-baselines CLI flag for hard-fail in CI, inject nudge into nf:progress, improve DIAG-02 detail with baseline_hint, and implement 6-case test suite.

## Summary

Added comprehensive baseline requirement awareness to nf:solve to surface when sync-baseline-requirements.cjs should be run. Users were experiencing silent degradation in solve coverage when baselines were missing but had no signal to run the sync tool.

## Tasks Completed

### Task 1: Add baseline advisory check and --require-baselines flag to nf-solve.cjs

**Implemented:**
- `checkBaselinePresence()` helper function that:
  - Reads requirements.json envelope
  - Counts requirements with `provenance.source_file === 'nf-baseline'`
  - Distinguishes "file missing" vs "file exists but zero baselines"
  - Fails gracefully (fail-open) on JSON parse errors, returning error field
  - Returns `{ has_baselines: bool, baseline_count: number, total_count: number, file_missing: bool, error?: string }`

- `--require-baselines` CLI flag parsing (line 135)
  - Causes process.exit(1) when baselines missing
  - Works in both Phase 1 (fresh diagnostic) and Phase 0.5 (--execute/--resume paths)

- Advisory stderr messages:
  - File missing: `"[nf-solve] ADVISORY: requirements.json not found. Run 'node bin/sync-baseline-requirements.cjs'..."`
  - Zero baselines: `"[nf-solve] ADVISORY: requirements.json contains 0 of X requirements from baselines..."`

- **baseline_advisory field on jsonObj (--json output):**
  - NOT on solveState (which persists to solve-state.json)
  - Contains warning, suggestion, file_missing discriminator, baseline_count, total_count
  - Null when baselines present

- **baseline_hint augmentation in DIAG-02 layers:**
  - sweepRtoD, sweepCtoR, sweepDtoR now include `baseline_hint: 'run sync-baseline-requirements.cjs to populate'` in detail objects when residual=-1 due to missing requirements.json
  - Does not change residual value or skipped/reason fields, only augments detail

- **6-case test suite (all passing):**
  - Empty requirements array → has_baselines: false, file_missing: false
  - All baseline-sourced → has_baselines: true
  - Mixed baseline + milestone → has_baselines: true, correct count
  - Missing file → has_baselines: false, file_missing: true
  - Requirements without provenance → has_baselines: false
  - Malformed JSON → fail-open, error field set

### Task 2: Update solve.md flag docs and progress.md baseline nudge

**Implemented:**
- Updated `commands/nf/solve.md`:
  - Added `--require-baselines` to argument-hint frontmatter
  - Added flag extraction in Flag Extraction section
  - Added baseline check in Phase 0.5 (--execute/--resume bypass path)
  - Forwarded `--require-baselines` flag to nf-solve.cjs in Phase 1b
  - Ensured flag propagates through both fresh-run and resume paths

- Updated `core/workflows/progress.md`:
  - Added `BASELINE_CHECK` inline evaluation to extract baseline presence
  - Added "## Baseline Coverage" section (conditional on no baselines AND formal coverage available)
  - Nudge message: "No baseline requirements found. Run `node bin/sync-baseline-requirements.cjs` to populate baselines..."
  - Synced installed copy at ~/.claude/nf/workflows/progress.md

## Verification Results

✅ All 6 test cases pass (node --test bin/nf-solve-baseline-check.test.cjs)
✅ baseline_advisory field appears in JSON output when baselines missing
✅ baseline_advisory confirmed ABSENT from persisted solve-state.json (jsonObj-only, not solveState)
✅ --require-baselines flag documented in solve.md
✅ baseline nudge present in progress.md
✅ Installed workflow copy synced with repo source
✅ checkBaselinePresence() handles JSON.parse failures gracefully
✅ baseline_hint present in sweepRtoD, sweepCtoR, sweepDtoR detail objects
✅ Syntax check: nf-solve.cjs passes `node -c` validation

## Deviations from Plan

None — plan executed exactly as written.

## Test Summary

```
✔ Empty requirements array returns has_baselines: false, file_missing: false
✔ All requirements have provenance.source_file === nf-baseline returns has_baselines: true
✔ Mix of baseline and milestone requirements returns has_baselines: true with correct count
✔ Missing requirements.json file returns has_baselines: false, file_missing: true
✔ Requirements without provenance field returns has_baselines: false
✔ Malformed JSON file returns fail-open with error field set

6 tests, 0 failures, 100% pass rate
```

## Files Modified

- **bin/nf-solve.cjs** — added checkBaselinePresence(), --require-baselines parsing, baseline advisory emission, baseline_advisory field injection, baseline_hint augmentation in sweeps
- **commands/nf/solve.md** — documented --require-baselines flag, added Phase 0.5 check, forwarded flag in Phase 1b
- **core/workflows/progress.md** — added baseline check, added nudge section (synced to installed copy)

## Files Created

- **bin/nf-solve-baseline-check.test.cjs** — 6 comprehensive test cases using node:test runner

## Impact

- Users now see a clear advisory when running nf:solve without baseline requirements
- CI/CD can enforce baselines with --require-baselines flag
- nf:progress shows a nudge when baselines are absent
- DIAG-02 residual=-1 entries now include baseline_hint for better remediation guidance
- Fail-open behavior ensures robustness against malformed requirements.json

## Next Steps

This work addresses the DIAG-02 requirement for improving baseline coverage detection. The advisory system is now in place for both fresh runs and resumed sessions. Users can now:
1. See when baselines are missing
2. Run sync-baseline-requirements.cjs to populate them
3. Optionally enforce baseline presence in CI with --require-baselines
4. View baseline coverage progress in nf:progress reports
