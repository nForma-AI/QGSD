# Formal Verification Diff Report

**Generated:** 2026-04-02T15:51:31.583Z
**Current Run:** 5 pass, 0 fail, 1 warn/inconclusive
**Previous Run:** 1 transitions, 1 new, 0 removed
**Overall Status:** inconclusive

## Transitioned Checks

| Check | Previous | Current | Summary |
|-------|----------|---------|---------|
| ci:liveness-fairness-lint | pass | inconclusive | inconclusive: fairness declarations missing — MCBugModelLook |

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| ci:trace-redaction | pass | pass: ci:trace-redaction in 1ms |

## Unchanged Checks

4 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"petri:account-manager-petri-net":"pass","petri:quorum-petri-net":"pass","ci:trace-redaction":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"inconclusive","ci:conformance-traces":"pass"}
```