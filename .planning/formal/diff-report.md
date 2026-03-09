# Formal Verification Diff Report

**Generated:** 2026-03-09T21:39:10.799Z
**Current Run:** 9 pass, 9 fail, 1 warn/inconclusive
**Previous Run:** 2 transitions, 11 new, 10 removed
**Overall Status:** fail

## Transitioned Checks

| Check | Previous | Current | Summary |
|-------|----------|---------|---------|
| ci:conformance-traces | pass | fail | fail: 1 divergence(s) in 1 traces (8ms) |
| prism:quorum | error | pass | pass: quorum in 1015ms |

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| tla:stop-hook | fail | fail: MCStopHook in 523ms |
| ci:trace-redaction | pass | pass: ci:trace-redaction in 1ms |
| ci:trace-schema-drift | pass | pass: ci:trace-schema-drift in 57ms |
| ci:liveness-fairness-lint | inconclusive | inconclusive: fairness declarations missing — MCconvergence: |
| tla:mcp-environment | fail | fail: MCMCPEnv in 764ms |
| tla:mctuimodules | fail | fail: MCTUIModules in 772ms |
| tla:mcqgsdquorum | fail | fail: MCQGSDQuorum in 806ms |
| tla:mctuinavigation | fail | fail: MCTUINavigation in 741ms |
| tla:mcsessionpersistence | fail | fail: MCSessionPersistence in 582ms |
| tla:mctuisessions | fail | fail: MCTUISessions in 625ms |
| tla:stop-hook | fail | fail: MCStopHook in 703ms |

## Removed Checks

- prism:oauth-rotation: no longer run
- tla:oscillation: no longer run
- tla:bogus: no longer run
- tla:invalid: no longer run
- tla:deliberation: no longer run
- tla:mcagentloop: no longer run
- tla:mcdeliberationrevision: no longer run
- tla:quorum-safety: no longer run
- alloy:transcript: no longer run
- uppaal:quorum-races: no longer run

## Unchanged Checks

6 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"tla:stop-hook":"fail","ci:conformance-traces":"pass","ci:trace-redaction":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"inconclusive","tla:mcp-environment":"fail","tla:mctuimodules":"fail","tla:mcqgsdquorum":"fail","tla:mctuinavigation":"fail","tla:mcsessionpersistence":"fail","prism:quorum":"pass","tla:mctuisessions":"fail"}
```