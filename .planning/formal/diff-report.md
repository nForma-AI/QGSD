# Formal Verification Diff Report

**Generated:** 2026-04-04T07:21:15.970Z
**Current Run:** 35 pass, 3 fail, 18 warn/inconclusive
**Previous Run:** 1 transitions, 28 new, 0 removed
**Overall Status:** fail

## Transitioned Checks

| Check | Previous | Current | Summary |
|-------|----------|---------|---------|
| ci:conformance-traces | pass | fail | fail: 1 divergence(s) in 1 traces (48ms) |

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| alloy:diagnostics-verification | pass | pass: alloy:diagnostics-verification in 2245ms |
| tla:breaker | pass | pass: MCbreaker in 1703ms |
| tla:mcsessiontracking | error | error: state-space guard blocked MCSessionTracking (HIGH ris |
| alloy:debt-lifecycle | pass | pass: alloy:debt-lifecycle in 2839ms |
| tla:mcsolveconvergencev2 | error | error: state-space guard blocked MCSolveConvergenceV2 (HIGH  |
| tla:mcagentloop | error | error: state-space guard blocked MCAgentLoop (HIGH risk, ~nu |
| alloy:changelog-release | pass | pass: alloy:changelog-release in 3149ms |
| tla:mcnfquorum | pass | pass: MCNFQuorum in 2053ms |
| tla:mcbugmodellookup | error | error: state-space guard blocked MCBugModelLookup (HIGH risk |
| tla:mcsolvefastpath | error | error: state-space guard blocked MCSolveFastPath (HIGH risk, |
| alloy:bin-path-resolution | pass | pass: alloy:bin-path-resolution in 3292ms |
| tla:mcconvergencetest | error | error: state-space guard blocked MCConvergenceTest (HIGH ris |
| tla:mcdeliberationrevision | error | error: state-space guard blocked MCDeliberationRevision (HIG |
| alloy:diagnostics | pass | pass: alloy:diagnostics in 2370ms |
| tla:mccheckpointgate | pass | pass: MCcheckpointgate in 2148ms |
| tla:mcgatepromotion | error | error: state-space guard blocked MCGatePromotion (HIGH risk, |
| tla:mcci-checks | error | error: state-space guard blocked MCci-checks (HIGH risk, ~nu |
| tla:mcnfscopeguard | pass | pass: MCNFScopeGuard in 1640ms |
| tla:mcp-environment | error | error: state-space guard blocked MCMCPEnv (HIGH risk, ~null  |
| tla:stop-hook | pass | pass: MCStopHook in 1729ms |
| tla:oscillation | fail | fail: MCoscillation in 9297ms |
| alloy:decomp-cross-model | pass | pass: alloy:decomp-cross-model in 2797ms |
| alloy:ci-matrix | pass | pass: alloy:ci-matrix in 2358ms |
| tla:quorum-safety | pass | pass: MCsafety in 2059ms |
| tla:mcpolicy | error | error: state-space guard blocked MCpolicy (HIGH risk, ~null  |
| alloy:btf-layer-integration | pass | pass: alloy:btf-layer-integration in 2825ms |
| tla:mcconfigloader | pass | pass: MCconfigloader in 1824ms |
| alloy:dispatch-formal-context | pass | pass: alloy:dispatch-formal-context in 2970ms |

## Unchanged Checks

27 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"prism:quorum":"pass","tla:account-manager":"fail","tla:mcnfsimulationloop":"inconclusive","tla:mcactivity":"error","tla:mcagent-prov":"error","alloy:deprecation-routing":"pass","petri:account-manager-petri-net":"pass","petri:quorum-petri-net":"pass","alloy:debate-trace-persistence":"pass","alloy:ccr-binary-resolution":"pass","ci:trace-redaction":"pass","tla:mcbreaker-state":"error","ci:trace-schema-drift":"pass","alloy:baseline-requirements-filter":"pass","ci:liveness-fairness-lint":"inconclusive","tla:mcqgsdquorum":"pass","tla:mcnfoutputintegrity":"pass","tla:mcsessionpersistence":"error","tla:mcsessionstateinjection":"error","ci:conformance-traces":"pass","alloy:diagnostics-verification":"pass","tla:breaker":"pass","tla:mcsessiontracking":"error","alloy:debt-lifecycle":"pass","tla:mcsolveconvergencev2":"error","tla:mcagentloop":"error","alloy:changelog-release":"pass","tla:mcnfquorum":"pass","tla:mcbugmodellookup":"error","tla:mcsolvefastpath":"error","alloy:bin-path-resolution":"pass","tla:mcconvergencetest":"error","tla:mcdeliberationrevision":"error","alloy:diagnostics":"pass","tla:mccheckpointgate":"pass","tla:mcgatepromotion":"error","tla:mcci-checks":"error","tla:mcnfscopeguard":"pass","tla:mcp-environment":"error","tla:stop-hook":"pass","tla:oscillation":"fail","alloy:decomp-cross-model":"pass","alloy:ci-matrix":"pass","tla:quorum-safety":"pass","tla:mcpolicy":"error","alloy:btf-layer-integration":"pass","tla:mcconfigloader":"pass","alloy:dispatch-formal-context":"pass"}
```