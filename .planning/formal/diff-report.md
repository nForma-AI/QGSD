# Formal Verification Diff Report

**Generated:** 2026-03-17T15:54:55.113Z
**Current Run:** 5 pass, 0 fail, 1 warn/inconclusive
**Previous Run:** 0 transitions, 2 new, 5 removed
**Overall Status:** inconclusive

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| alloy:installer-path-validation | pass | pass: alloy:installer-path-validation in 1042ms |
| alloy:solve-legacy-merge | pass | pass: alloy:solve-legacy-merge in 1173ms |

## Removed Checks

- alloy:observability-analysis: no longer run
- petri:account-manager-petri-net: no longer run
- petri:quorum-petri-net: no longer run
- alloy:ci-test-fallback: no longer run
- alloy:observability-handler-arch: no longer run

## Unchanged Checks

4 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"ci:trace-redaction":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"inconclusive","alloy:installer-path-validation":"pass","alloy:solve-legacy-merge":"pass","ci:conformance-traces":"pass"}
```