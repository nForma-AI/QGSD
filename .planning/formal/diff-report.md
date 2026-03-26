# Formal Verification Diff Report

**Generated:** 2026-03-26T15:20:09.727Z
**Current Run:** 15 pass, 0 fail, 21 warn/inconclusive
**Previous Run:** 0 transitions, 8 new, 0 removed
**Overall Status:** inconclusive

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| tla:mcagentloop | error | error: state-space guard blocked MCAgentLoop (HIGH risk, ~nu |
| tla:mcbugmodellookup | error | error: state-space guard blocked MCBugModelLookup (HIGH risk |
| tla:mcconvergencetest | error | error: state-space guard blocked MCConvergenceTest (HIGH ris |
| alloy:account-pool | pass | pass: alloy:account-pool in 1451ms |
| alloy:ci-pipeline-gates | pass | pass: alloy:ci-pipeline-gates in 1517ms |
| tla:mcdeliberationrevision | error | error: state-space guard blocked MCDeliberationRevision (HIG |
| tla:mcgatepromotion | error | error: state-space guard blocked MCGatePromotion (HIGH risk, |
| tla:mcp-environment | error | error: state-space guard blocked MCMCPEnv (HIGH risk, ~null  |

## Unchanged Checks

28 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"inconclusive","tla:mcrecruiting-safety":"pass","tla:mcsolve-report-only":"pass","alloy:changelog-release":"pass","tla:mcsolvep2f":"error","petri:account-manager-petri-net":"pass","petri:quorum-petri-net":"pass","tla:mcspec-gen":"error","ci:trace-redaction":"pass","tla:mctokenopt":"error","tla:quorum-safety":"pass","tla:mcverification":"error","tla:mcsensitivity":"error","alloy:ci-matrix":"pass","tla:mcwizard":"error","tla:mcsolve-convergence":"error","tla:mcsolve-orchestrator":"error","ci:conformance-traces":"pass","tla:mcagentloop":"error","tla:mcbugmodellookup":"error","tla:mcconvergencetest":"error","alloy:account-pool":"pass","alloy:ci-pipeline-gates":"pass","tla:mcdeliberationrevision":"error","tla:mcgatepromotion":"error","tla:mcp-environment":"error"}
```