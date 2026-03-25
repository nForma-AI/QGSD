# Formal Verification Diff Report

**Generated:** 2026-03-25T11:07:45.326Z
**Current Run:** 9 pass, 0 fail
**Previous Run:** 0 transitions, 7 new, 17 removed
**Overall Status:** pass

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| alloy:hypothesis-measurement | pass | pass: alloy:hypothesis-measurement in 4473ms |
| alloy:traceability-obligations | pass | pass: alloy:traceability-obligations in 4114ms |
| petri:account-manager-petri-net | pass | pass: account-manager-petri-net Petri net validation in 1ms  |
| petri:quorum-petri-net | pass | pass: quorum-petri-net Petri net validation in 0ms (places=1 |
| ci:trace-schema-drift | pass | pass: ci:trace-schema-drift in 51ms |
| ci:liveness-fairness-lint | pass | pass: all liveness properties have fairness declarations (2  |
| alloy:quorum-votes | pass | pass: alloy:quorum-votes in 4241ms |

## Removed Checks

- tla:mctokenopt: no longer run
- alloy:quality-hardening: no longer run
- tla:mcportability: no longer run
- tla:mcverification: no longer run
- tla:mckey-mgmt: no longer run
- tla:mclearning: no longer run
- tla:mcwizard: no longer run
- alloy:fingerprinting-dedup: no longer run
- alloy:agent-fsm-detection: no longer run
- tla:prefilter: no longer run
- tla:mcprompt-hook: no longer run
- alloy:semantics-layer: no longer run
- tla:mcreasoning: no longer run
- tla:quorum-liveness: no longer run
- alloy:autoclose-signals: no longer run
- tla:mcmemorypersist: no longer run
- alloy:gate-promotion-lifecycle: no longer run

## Unchanged Checks

2 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"alloy:hypothesis-measurement":"pass","alloy:traceability-obligations":"pass","petri:account-manager-petri-net":"pass","petri:quorum-petri-net":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"pass","alloy:quorum-votes":"pass","ci:conformance-traces":"pass","alloy:result-classification":"pass"}
```