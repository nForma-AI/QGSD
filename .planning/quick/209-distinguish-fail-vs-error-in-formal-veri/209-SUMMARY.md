# Quick Task 209: Distinguish FAIL vs ERROR in formal verification results

## What changed

Added `result:'error'` classification for infrastructure/tooling failures in formal verification, separate from `result:'fail'` which now exclusively indicates real requirement violations.

## Changes

### Core schema
- `bin/write-check-result.cjs`: Added `'error'` to `VALID_RESULTS` array

### Runner scripts (91 infrastructure failures reclassified)
- 20+ runner scripts updated: `run-alloy.cjs`, `run-prism.cjs`, `run-oauth-rotation-prism.cjs`, `run-tlc.cjs`, `run-protocol-tlc.cjs`, `run-oscillation-tlc.cjs`, `run-account-manager-tlc.cjs`, `run-breaker-tlc.cjs`, `run-stop-hook-tlc.cjs`, `run-transcript-alloy.cjs`, `run-quorum-composition-alloy.cjs`, `run-installer-alloy.cjs`, `run-audit-alloy.cjs`, `run-account-pool-alloy.cjs`, `run-uppaal.cjs`, `check-trace-schema-drift.cjs`

### Classification rules
| Result | Meaning | Examples |
|--------|---------|----------|
| `error` | Infrastructure/tooling issue | Binary not found, JAR missing, Java < 17, spawn failed, config not found, invalid spec |
| `fail` | Real requirement violation | Counterexample found, conformance divergence, property violation, non-zero exit after successful run |
| `inconclusive` | Incomplete verification | Missing fairness declarations, tool not installed |
| `pass` | Verification succeeded | No counterexample, all properties hold |

### Solver (nf-solve.cjs)
- `sweepFtoC()`: Counts errors separately from failures. Only `failedCount` drives F->C residual.
- Display: Errors shown with `⚙` icon under "Errors (infrastructure/tooling)", failures with `✗` under "Failures (requirement violations)"

### Supporting files
- `generate-triage-bundle.cjs`: Includes `'error'` results in suspects list
- `nForma.cjs`: Magenta color for error results in TUI
- `failure-taxonomy.cjs`: Counts both `'fail'` and `'error'` in taxonomy

## Test results
- write-check-result.test.cjs: 23/23 pass (2 new tests for 'error')
- failure-taxonomy.test.cjs: 11/11 pass
- verify-formal-results.test.cjs: 7/7 pass
- run-prism.test.cjs: 19/19 pass
- run-breaker-tlc.test.cjs: 7/7 pass

## Impact on F->C residual
Previously, infrastructure issues (e.g., "PRISM binary not found") inflated the F->C residual alongside real verification failures. Now only genuine requirement violations count toward the residual, giving an accurate picture of formal verification health.
