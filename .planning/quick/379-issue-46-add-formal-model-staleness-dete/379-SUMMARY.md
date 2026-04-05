---
phase: quick-379
plan: 01
type: execute
date_completed: 2026-04-05T19:57:00Z
tasks_completed: 3
tasks_total: 3
status: complete
requirements: [INTENT-01]
formal_artifacts: none
---

# Quick Task 379: Add Formal Model Staleness Detection via Content Hashing

**Objective:** Add SHA-256 content hashing to detect when formal models have drifted from their declared source code dependencies, enabling early warning of verification results based on stale specs.

**Completion:** All 3 tasks executed successfully. Full formal model staleness detection system is operational.

## Task Summary

### Task 1: Create bin/check-model-staleness.cjs with tests
**Status:** Complete

Created a standalone staleness detection script that:
- Reads `.planning/formal/model-registry.json` and computes SHA-256 hashes for each model file
- Parses `-- Source:` and `* Source:` header comments to extract source file dependencies
- Compares computed hashes against stored `content_hashes` in registry entries
- Detects three staleness conditions:
  - `first_hash`: Entry lacks stored hashes (baseline establishment, not flagged as stale)
  - `model_changed`: Model file hash differs from stored hash
  - `source_changed`: One or more source file hashes differ (lists changed files)
- Default mode is **read-only** (no flags or `--dry-run`); only explicit `--update-hashes` writes
- Graceful degradation: missing registry returns `skipped: true`; missing files are silently skipped
- Exports `checkStaleness(root, { updateHashes })` function for programmatic use

**Test Coverage:** 8 comprehensive tests (all passing)
- Missing registry handling
- Hash computation with source file parsing
- First-run baseline detection
- Model content change detection
- Source content change detection
- Graceful degradation on missing files
- Read-only verification (default mode doesn't write)
- `--update-hashes` mode writes hashes atomically

**Commit:** 6ab08951

### Task 2: Wire sweepModelStaleness into nf-solve.cjs diagnostic sweep
**Status:** Complete

Integrated model staleness detection into the nf-solve diagnostic framework:
- Added `sweepModelStaleness()` function (lines 3846-3878) following exact pattern of `sweepFormalLint()`
- Invokes `bin/check-model-staleness.cjs --json --dry-run` (read-only, no side effects)
- Returns informational residual with details: `total_checked`, `total_stale`, `first_hash_count`, stale entry list
- Added timing telemetry in `computeResidual()` (line 4227-4228)
- Added to `informational` bucket sum (line 4265) — NOT in automatable or manual totals
- Added to return object (line 4305)
- Added `MS (Model Stale)` row to `diagRows` array in `formatReport()` for CLI rendering (line 4945)
- Exported `sweepModelStaleness` in module.exports (line 6114)

**Behavior:**
- Skips in fast mode (returns residual: -1)
- Returns skipped detail if `model-registry.json` missing
- Limits stale entries displayed to 20 (slice(0, 20))
- Fully isolated from automatable/manual workflows

**Commit:** 95646b93

### Task 3: Surface MODEL_STALE in solve-report.md
**Status:** Complete

Updated the solve-report documentation to surface model staleness as an informational signal:
- Added `Model Stale (drift)` row to informational signals table (line 88, after H->M)
- Added expansion guidance for non-zero model_stale residuals (line 103)
- Provided example expansion showing stale model paths with reasons and baseline establishment message (lines 119-123)
- Signal references key `model_stale` for report rendering loop

**Example expansion format:**
```
Model Stale Detail:
  ! .planning/formal/alloy/autoclose-signals.als — source_changed (bin/nf-solve.cjs)
  i 12 models hashed for first time (baseline)
```

**Commit:** bb660b30

## Success Criteria Verification

- [x] SHA-256 content hashes are computed for model files and their Source-declared dependencies
- [x] Staleness is detected when hashes diverge from stored values in model-registry.json
- [x] Entries without content_hashes degrade gracefully (first-run reports first_hash_count, no false stale)
- [x] Default execution mode is read-only; writing hashes requires explicit `--update-hashes` flag
- [x] Diagnostic sweep in nf-solve invokes with `--dry-run` (read-only, no side effects)
- [x] MODEL_STALE is an informational signal in nf-solve (not automatable, not manual)
- [x] `model_stale` appears in formatReport() diagRows for CLI rendering
- [x] Solve-report renders the staleness row with detail expansion for non-zero counts
- [x] All tests pass (8/8), no regressions

## Verification Commands Run

```bash
node --test bin/check-model-staleness.test.cjs
# Result: 8 tests pass, 0 fail

node bin/check-model-staleness.cjs --json --dry-run
# Result: Valid JSON output with total_checked=229, total_stale=0, first_hash_count=229

grep 'sweepModelStaleness' bin/nf-solve.cjs
# Result: 3 matches (function def, invocation, export)

grep 'model_stale' bin/nf-solve.cjs
# Result: 6 matches (timing, invocation, informational sum, return, diagRows, export)

grep "MS (Model Stale)" bin/nf-solve.cjs
# Result: 1 match in diagRows array

grep '\-\-dry-run' bin/nf-solve.cjs | grep check-model-staleness
# Result: Confirms read-only sweep invocation

grep -c 'Model.Stale\|model_stale' commands/nf/solve-report.md
# Result: 4 matches (table row, expansion desc, example title, example content)

# Read-only verification
BEFORE=$(sha256sum .planning/formal/model-registry.json | cut -d' ' -f1)
node bin/check-model-staleness.cjs --json 2>/dev/null >/dev/null
AFTER=$(sha256sum .planning/formal/model-registry.json | cut -d' ' -f1)
# Result: BEFORE == AFTER (registry unchanged in read-only mode)
```

## Files Created/Modified

**Created:**
- `bin/check-model-staleness.cjs` — 251 lines, staleness detection script
- `bin/check-model-staleness.test.cjs` — 285 lines, comprehensive test suite

**Modified:**
- `bin/nf-solve.cjs` — +43 lines, added sweepModelStaleness, wiring, diagRows entry
- `commands/nf/solve-report.md` — +9 lines, informational signal row, expansion, example

## Deviations

None — plan executed exactly as written.

## Architecture Notes

- **Read-only by design:** Default mode never modifies model-registry.json. The diagnostic sweep always uses `--dry-run`. Hash baseline population (`--update-hashes`) is a separate explicit action, decoupled from automatic diagnostics.
- **Graceful degradation:** Missing registry, missing model files, missing source files all fail-open without errors. Only true parsing/hashing errors are caught.
- **Informational-only:** Staleness signals do not affect automatable or manual gap counts. They provide visibility into model currency for human review.
- **First-run friendly:** Entries without stored hashes return `first_hash_count` rather than false stale reports, enabling clean baseline establishment on first run.
- **Timing telemetry:** Per-layer timing is captured for diagnostics performance tracking (QUICK-370 pattern).

## Integration Points

1. **nf-solve diagnostic sweep:** `sweepModelStaleness()` runs in the same cycle as config_health, security, asset_stale, etc.
2. **solve-report rendering:** `model_stale` key is available in residual JSON for report templates
3. **CLI visualization:** MS (Model Stale) row displays alongside other diagnostic health metrics
4. **Registry schema:** `content_hashes` field added to model-registry.json entries (schema-extensible)

## Next Steps (Beyond This Task)

- Users can optionally run `node bin/check-model-staleness.cjs --update-hashes` to populate baseline hashes
- Model staleness will appear in solve-report for awareness and remediation decisions
- Future enhancements could auto-remediate by triggering model re-verification on staleness detection
