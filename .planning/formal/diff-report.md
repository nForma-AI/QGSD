# Formal Verification Diff Report

**Generated:** 2026-03-16T16:25:28.097Z
**Current Run:** 8 pass, 0 fail
**Previous Run:** 1 transitions, 3 new, 7 removed
**Overall Status:** pass

## Transitioned Checks

| Check | Previous | Current | Summary |
|-------|----------|---------|---------|
| ci:liveness-fairness-lint | inconclusive | pass | pass: all liveness properties have fairness declarations (2  |

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| alloy:solve-automation-features | pass | pass: alloy:solve-automation-features in 1962ms |
| alloy:solve-legacy-merge | pass | pass: alloy:solve-legacy-merge in 1729ms |
| alloy:trace-coverage-matrix | pass | pass: alloy:trace-coverage-matrix in 1708ms |

## Removed Checks

- tla:mctokenopt: no longer run
- tla:mcverification: no longer run
- alloy:git-history-evidence: no longer run
- ci:trace-redaction: no longer run
- alloy:codebase-arch-constraints: no longer run
- tla:mcwizard: no longer run
- alloy:governance-dx: no longer run

## Unchanged Checks

4 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"alloy:solve-automation-features":"pass","petri:account-manager-petri-net":"pass","petri:quorum-petri-net":"pass","ci:trace-schema-drift":"pass","alloy:solve-legacy-merge":"pass","ci:liveness-fairness-lint":"pass","alloy:trace-coverage-matrix":"pass","ci:conformance-traces":"pass"}
```