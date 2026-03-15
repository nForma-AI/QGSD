# Formal Verification Diff Report

**Generated:** 2026-03-15T21:44:14.061Z
**Current Run:** 13 pass, 0 fail
**Previous Run:** 0 transitions, 12 new, 7 removed
**Overall Status:** pass

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| alloy:baseline-requirements-filter | pass | pass: alloy:baseline-requirements-filter in 1179ms |
| petri:account-manager-petri-net | pass | pass: account-manager-petri-net Petri net validation in 0ms  |
| petri:quorum-petri-net | pass | pass: quorum-petri-net Petri net validation in 0ms (places=1 |
| ci:trace-redaction | pass | pass: ci:trace-redaction in 1ms |
| tla:mcmemorypersist | pass | pass: MCmemorypersist in 629ms |
| tla:mcbreaker-state | pass | pass: MCbreaker-state in 688ms |
| ci:trace-schema-drift | pass | pass: ci:trace-schema-drift in 42ms |
| alloy:baseline-requirements-filter | pass | pass: alloy:baseline-requirements-filter in 1186ms |
| ci:liveness-fairness-lint | pass | pass: all liveness properties have fairness declarations (50 |
| tla:mcorchestration | pass | pass: MCorchestration in 589ms |
| tla:breaker | pass | pass: MCbreaker in 561ms |
| alloy:bin-path-resolution | pass | pass: alloy:bin-path-resolution in 1005ms |

## Removed Checks

- tla:mcsensitivity: no longer run
- prism:quorum: no longer run
- tla:mcsolve-convergence: no longer run
- tla:mcactivity: no longer run
- tla:mcsolve-orchestrator: no longer run
- tla:mcagent-prov: no longer run
- tla:mcsolve-report-only: no longer run

## Unchanged Checks

1 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"alloy:baseline-requirements-filter":"pass","petri:account-manager-petri-net":"pass","petri:quorum-petri-net":"pass","ci:trace-redaction":"pass","tla:mcmemorypersist":"pass","tla:mcbreaker-state":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"pass","tla:mcorchestration":"pass","tla:breaker":"pass","alloy:bin-path-resolution":"pass","ci:conformance-traces":"pass"}
```