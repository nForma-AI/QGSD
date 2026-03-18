# Formal Verification Diff Report

**Generated:** 2026-03-18T17:38:09.943Z
**Current Run:** 6 pass, 0 fail, 1 warn/inconclusive
**Previous Run:** 0 transitions, 3 new, 8 removed
**Overall Status:** inconclusive

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| alloy:integration-layers | pass | pass: alloy:integration-layers in 885ms |
| alloy:gate-promotion-lifecycle | pass | pass: alloy:gate-promotion-lifecycle in 1115ms |
| alloy:fingerprinting | pass | pass: alloy:fingerprinting in 942ms |

## Removed Checks

- tla:mcactivity: no longer run
- petri:account-manager-petri-net: no longer run
- petri:quorum-petri-net: no longer run
- tla:mcagent-prov: no longer run
- tla:mcnfdispatch: no longer run
- tla:mcbreaker-state: no longer run
- tla:mcnfquorum: no longer run
- tla:breaker: no longer run

## Unchanged Checks

4 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"ci:trace-redaction":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"inconclusive","alloy:integration-layers":"pass","alloy:gate-promotion-lifecycle":"pass","alloy:fingerprinting":"pass","ci:conformance-traces":"pass"}
```