# Formal Verification Suspects

**Generated:** 2026-03-09T21:39:10.804Z
**Total Suspects:** 10

## Critical Failures (result=fail)

### tla:stop-hook
- **Property:** Stop hook safety (BLOCK => hasCommand) + liveness (hasQuorumEvidence => <>PASS)
- **Summary:** fail: MCStopHook in 523ms
- **Runtime:** 523ms
- **Tags:** none

### ci:conformance-traces
- **Property:** Conformance event replay through XState machine
- **Summary:** fail: 1 divergence(s) in 1 traces (8ms)
- **Runtime:** 8ms
- **Tags:** trace-divergence

### tla:mcp-environment
- **Property:** MCP environment — MCPEnvSafety, MCPEnvLiveness
- **Summary:** fail: MCMCPEnv in 764ms
- **Runtime:** 764ms
- **Tags:** none

### tla:mctuimodules
- **Property:** MCTUIModules
- **Summary:** fail: MCTUIModules in 772ms
- **Runtime:** 772ms
- **Tags:** none

### tla:mcqgsdquorum
- **Property:** MCQGSDQuorum
- **Summary:** fail: MCQGSDQuorum in 806ms
- **Runtime:** 806ms
- **Tags:** none

### tla:mctuinavigation
- **Property:** MCTUINavigation
- **Summary:** fail: MCTUINavigation in 741ms
- **Runtime:** 741ms
- **Tags:** none

### tla:mcsessionpersistence
- **Property:** MCSessionPersistence
- **Summary:** fail: MCSessionPersistence in 582ms
- **Runtime:** 582ms
- **Tags:** none

### tla:mctuisessions
- **Property:** MCTUISessions
- **Summary:** fail: MCTUISessions in 625ms
- **Runtime:** 625ms
- **Tags:** none

### tla:stop-hook
- **Property:** Stop hook safety (BLOCK => hasCommand) + liveness (hasQuorumEvidence => <>PASS)
- **Summary:** fail: MCStopHook in 703ms
- **Runtime:** 703ms
- **Tags:** none

## Inconclusive with Tags (result=inconclusive)

### ci:liveness-fairness-lint
- **Property:** Liveness fairness declarations — all TLA+ liveness properties documented with WF/SF rationale
- **Summary:** inconclusive: fairness declarations missing — MCconvergence: ResolvedAtWriteOnce, HaikuUnavailableNoCorruption; MCdeliberation: DeliberationMonotone, ImprovementMonotone
- **Runtime:** 3ms
- **Tags:** needs-fairness
