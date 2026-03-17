# Formal Verification Diff Report

**Generated:** 2026-03-17T12:50:55.793Z
**Current Run:** 49 pass, 2 fail, 1 warn/inconclusive
**Previous Run:** 0 transitions, 42 new, 28 removed
**Overall Status:** fail

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| alloy:event-vocabulary | pass | pass: alloy:event-vocabulary in 4027ms |
| alloy:meta-resolve | pass | pass: alloy:meta-resolve in 4240ms |
| alloy:health-diagnostic-routing | pass | pass: alloy:health-diagnostic-routing in 4529ms |
| tla:mckey-mgmt | pass | pass: MCkey-mgmt in 2598ms |
| alloy:project-identity | pass | pass: alloy:project-identity in 3884ms |
| tla:mcagent-prov | pass | pass: MCagent-prov in 3273ms |
| tla:mcbreaker-state | pass | pass: MCbreaker-state in 2297ms |
| alloy:provider-failure | pass | pass: alloy:provider-failure in 4453ms |
| tla:mcdebtledger | pass | pass: MCdebtledger in 2502ms |
| alloy:dispatch-formal-context | pass | pass: alloy:dispatch-formal-context in 4341ms |
| prism:observability-delivery | pass | pass: observability-delivery in 3859ms |
| alloy:observability-handlers | pass | pass: alloy:observability-handlers in 4645ms |
| alloy:diagnostics | pass | pass: alloy:diagnostics in 3804ms |
| alloy:doc-claims-backing | pass | pass: alloy:doc-claims-backing in 3645ms |
| tla:mclearning | pass | pass: MClearning in 2821ms |
| alloy:evidence-layer | pass | pass: alloy:evidence-layer in 3678ms |
| alloy:misc-behavioral | pass | pass: alloy:misc-behavioral in 3846ms |
| tla:breaker | pass | pass: MCbreaker in 2456ms |
| tla:mcbreaker-state | pass | pass: MCbreaker-state in 2569ms |
| alloy:provider-wizard | pass | pass: alloy:provider-wizard in 2514ms |
| tla:deliberation | fail | fail: MCdeliberation in 2361ms |
| alloy:provider-configuration | pass | pass: alloy:provider-configuration in 3910ms |
| alloy:health-validation | pass | pass: alloy:health-validation in 4667ms |
| alloy:doc-claims-backing | pass | pass: alloy:doc-claims-backing in 2930ms |
| tla:quorum-liveness | pass | pass: MCliveness in 2656ms |
| alloy:parallel-exec | pass | pass: alloy:parallel-exec in 3291ms |
| alloy:config-zero-providers | pass | pass: alloy:config-zero-providers in 3405ms |
| tla:mccheckpointgate | pass | pass: MCcheckpointgate in 2176ms |
| alloy:doc-presentation | pass | pass: alloy:doc-presentation in 3723ms |
| alloy:dispatch-formal-context | pass | pass: alloy:dispatch-formal-context in 3746ms |
| tla:breaker | fail | fail: MCbreaker in 2360ms |
| tla:mcdispatch | pass | pass: MCdispatch in 2374ms |
| alloy:proximity-index | pass | pass: alloy:proximity-index in 3766ms |
| alloy:evidence-scope-scan | pass | pass: alloy:evidence-scope-scan in 4527ms |
| alloy:observability-handler-arch | pass | pass: alloy:observability-handler-arch in 4652ms |
| tla:mcci-checks | pass | pass: MCci-checks in 1611ms |
| tla:mcmemorypersist | pass | pass: MCmemorypersist in 2068ms |
| alloy:model-registry-parity | pass | pass: alloy:model-registry-parity in 4749ms |
| tla:mcenforcement | pass | pass: MCenforcement in 1725ms |
| tla:mccheckpointgate | pass | pass: MCcheckpointgate in 1889ms |
| alloy:doc-presentation | pass | pass: alloy:doc-presentation in 3886ms |
| alloy:provider-failure | pass | pass: alloy:provider-failure in 4485ms |

## Removed Checks

- alloy:transcript: no longer run
- alloy:config-audit: no longer run
- alloy:nn-pairing-lifecycle: no longer run
- tla:mcnfquorum: no longer run
- alloy:bin-path-resolution: no longer run
- alloy:classification-schema: no longer run
- alloy:installer-sync: no longer run
- alloy:ci-test-fallback: no longer run
- alloy:formal-test-trace: no longer run
- alloy:cli-exit-conventions: no longer run
- alloy:multi-slot: no longer run
- tla:stop-hook: no longer run
- alloy:mcp-detection: no longer run
- tla:mcqgsdquorum: no longer run
- alloy:v8-coverage-digest: no longer run
- alloy:unified-check-results: no longer run
- alloy:build-test-quality: no longer run
- tla:mctuimodules: no longer run
- alloy:hook-portability-guard: no longer run
- alloy:integration-layers: no longer run
- tla:mcsessionpersistence: no longer run
- tla:mcsessiontracking: no longer run
- alloy:formalism-selection: no longer run
- alloy:code-quality-guardrails: no longer run
- tla:mctuinavigation: no longer run
- alloy:verification-execution: no longer run
- alloy:mcp-repair-lifecycle: no longer run
- alloy:user-guide: no longer run

## Unchanged Checks

10 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"alloy:event-vocabulary":"pass","alloy:meta-resolve":"pass","alloy:health-diagnostic-routing":"pass","tla:mckey-mgmt":"pass","alloy:project-identity":"pass","petri:account-manager-petri-net":"pass","petri:quorum-petri-net":"pass","tla:mcagent-prov":"pass","tla:mcbreaker-state":"pass","alloy:provider-failure":"pass","tla:mcdebtledger":"pass","ci:trace-redaction":"pass","alloy:dispatch-formal-context":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"inconclusive","prism:observability-delivery":"pass","alloy:config-two-layer":"pass","alloy:observability-handlers":"pass","alloy:diagnostics":"pass","alloy:doc-claims-backing":"pass","tla:mclearning":"pass","alloy:observability-analysis":"pass","alloy:evidence-layer":"pass","alloy:misc-behavioral":"pass","tla:breaker":"fail","alloy:provider-wizard":"pass","tla:deliberation":"fail","alloy:provider-configuration":"pass","alloy:health-validation":"pass","prism:quorum":"pass","tla:quorum-liveness":"pass","alloy:parallel-exec":"pass","alloy:config-zero-providers":"pass","tla:mccheckpointgate":"pass","alloy:doc-presentation":"pass","tla:mcdispatch":"pass","alloy:proximity-index":"pass","alloy:evidence-scope-scan":"pass","alloy:observability-handler-arch":"pass","tla:mcci-checks":"pass","alloy:hook-module-existence":"pass","tla:mcmemorypersist":"pass","alloy:model-registry-parity":"pass","tla:mcenforcement":"pass","ci:conformance-traces":"pass"}
```