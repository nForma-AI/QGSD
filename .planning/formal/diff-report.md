# Formal Verification Diff Report

**Generated:** 2026-03-18T22:28:57.480Z
**Current Run:** 8 pass, 0 fail
**Previous Run:** 0 transitions, 3 new, 16 removed
**Overall Status:** pass

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| alloy:solve-legacy-merge | pass | pass: alloy:solve-legacy-merge in 5858ms |
| alloy:gate-naming-migration | pass | pass: alloy:gate-naming-migration in 5796ms |
| alloy:schema-extensions | pass | pass: alloy:schema-extensions in 5477ms |

## Removed Checks

- alloy:quorum-policy: no longer run
- alloy:availability: no longer run
- alloy:parallel-execution: no longer run
- tla:mcactivity: no longer run
- tla:deliberation: no longer run
- tla:mcagent-prov: no longer run
- alloy:fingerprinting-dedup: no longer run
- alloy:health-validation: no longer run
- alloy:config-audit: no longer run
- alloy:changelog-release: no longer run
- tla:mcbreaker-state: no longer run
- tla:mcdispatch: no longer run
- alloy:config-two-layer: no longer run
- alloy:governance-dx: no longer run
- alloy:integration-layers: no longer run
- alloy:diagnostics-verification: no longer run

## Unchanged Checks

5 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"alloy:solve-legacy-merge":"pass","petri:account-manager-petri-net":"pass","petri:quorum-petri-net":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"pass","alloy:gate-naming-migration":"pass","alloy:schema-extensions":"pass","ci:conformance-traces":"pass"}
```