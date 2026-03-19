# Formal Verification Diff Report

**Generated:** 2026-03-19T12:00:02.595Z
**Current Run:** 8 pass, 0 fail
**Previous Run:** 0 transitions, 3 new, 7 removed
**Overall Status:** pass

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| alloy:traceability-annotations | pass | pass: alloy:traceability-annotations in 3995ms |
| alloy:observability-analysis | pass | pass: alloy:observability-analysis in 3836ms |
| alloy:observability-handler-arch | pass | pass: alloy:observability-handler-arch in 3933ms |

## Removed Checks

- tla:mcconfigloader: no longer run
- tla:mctokenopt: no longer run
- tla:mcrecruiting-liveness: no longer run
- tla:convergence: no longer run
- tla:mcrecruiting-safety: no longer run
- tla:mcverification: no longer run
- alloy:governance-dx: no longer run

## Unchanged Checks

5 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"alloy:traceability-annotations":"pass","alloy:observability-analysis":"pass","petri:account-manager-petri-net":"pass","petri:quorum-petri-net":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"pass","alloy:observability-handler-arch":"pass","ci:conformance-traces":"pass"}
```