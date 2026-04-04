# Formal Verification Suspects

**Generated:** 2026-04-04T07:21:16.001Z
**Total Suspects:** 23

## Critical Failures (result=fail)

### tla:account-manager
- **Property:** Account manager quorum state machine — MCAM correctness
- **Summary:** fail: MCaccount-manager in 1975ms
- **Runtime:** 1975ms
- **Tags:** none

### ci:conformance-traces
- **Property:** Conformance event replay through XState machine
- **Summary:** fail: 1 divergence(s) in 1 traces (48ms)
- **Runtime:** 48ms
- **Tags:** trace-divergence

### tla:oscillation
- **Property:** Run-collapse oscillation detection algorithm correctness
- **Summary:** fail: MCoscillation in 9297ms
- **Runtime:** 9297ms
- **Tags:** none

## Inconclusive with Tags (result=inconclusive)

### tla:mcnfsimulationloop
- **Property:** MCNFSimulationLoop
- **Summary:** inconclusive: fairness missing in 2190ms
- **Runtime:** 2190ms
- **Tags:** needs-fairness

### ci:liveness-fairness-lint
- **Property:** Liveness fairness declarations — all TLA+ liveness properties documented with WF/SF rationale
- **Summary:** inconclusive: fairness declarations missing — MCBugModelLookup: EventuallyDone; MCNFHazardModelMerge: Liveness; MCNFSimulationLoop: LivenessEventualTermination; MCSessionStateInjection: EventuallyProcessed; MCSolveFastPath: EventuallyCompletes; MCTaskClassification: EventuallyRouted
- **Runtime:** 7ms
- **Tags:** needs-fairness

## Other Suspects

### tla:mcactivity
- **Property:** MCactivity
- **Summary:** error: state-space guard blocked MCactivity (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcagent-prov
- **Property:** MCagent-prov
- **Summary:** error: state-space guard blocked MCagent-prov (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcbreaker-state
- **Property:** MCbreaker-state
- **Summary:** error: state-space guard blocked MCbreaker-state (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcsessionpersistence
- **Property:** MCSessionPersistence
- **Summary:** error: state-space guard blocked MCSessionPersistence (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcsessionstateinjection
- **Property:** MCSessionStateInjection
- **Summary:** error: state-space guard blocked MCSessionStateInjection (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcsessiontracking
- **Property:** MCSessionTracking
- **Summary:** error: state-space guard blocked MCSessionTracking (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcsolveconvergencev2
- **Property:** MCSolveConvergenceV2
- **Summary:** error: state-space guard blocked MCSolveConvergenceV2 (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcagentloop
- **Property:** MCAgentLoop
- **Summary:** error: state-space guard blocked MCAgentLoop (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcbugmodellookup
- **Property:** MCBugModelLookup
- **Summary:** error: state-space guard blocked MCBugModelLookup (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcsolvefastpath
- **Property:** MCSolveFastPath
- **Summary:** error: state-space guard blocked MCSolveFastPath (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcconvergencetest
- **Property:** MCConvergenceTest
- **Summary:** error: state-space guard blocked MCConvergenceTest (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcdeliberationrevision
- **Property:** MCDeliberationRevision
- **Summary:** error: state-space guard blocked MCDeliberationRevision (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcgatepromotion
- **Property:** MCGatePromotion
- **Summary:** error: state-space guard blocked MCGatePromotion (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcci-checks
- **Property:** MCci-checks
- **Summary:** error: state-space guard blocked MCci-checks (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcp-environment
- **Property:** MCP environment — MCPEnvSafety, MCPEnvLiveness
- **Summary:** error: state-space guard blocked MCMCPEnv (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### tla:mcpolicy
- **Property:** MCpolicy
- **Summary:** error: state-space guard blocked MCpolicy (HIGH risk, ~null states)
- **Runtime:** 0ms
- **Tags:** state-space-blocked

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** pass: quorum in 2723ms
- **Runtime:** 2723ms
- **Tags:** low-confidence

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** pass: quorum in 2048ms
- **Runtime:** 2048ms
- **Tags:** low-confidence
