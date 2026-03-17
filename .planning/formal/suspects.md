# Formal Verification Suspects

**Generated:** 2026-03-17T12:50:55.801Z
**Total Suspects:** 3

## Critical Failures (result=fail)

### tla:deliberation
- **Property:** R3 deliberation loop — max 10 rounds + 10 improvement iterations
- **Summary:** fail: MCdeliberation in 2361ms
- **Runtime:** 2361ms
- **Tags:** none

### tla:breaker
- **Property:** Circuit breaker state persistence and oscillation detection algorithm
- **Summary:** fail: MCbreaker in 2360ms
- **Runtime:** 2360ms
- **Tags:** none

## Inconclusive with Tags (result=inconclusive)

### ci:liveness-fairness-lint
- **Property:** Liveness fairness declarations — all TLA+ liveness properties documented with WF/SF rationale
- **Summary:** inconclusive: fairness declarations missing — MCConvergenceTest: EventualTermination
- **Runtime:** 3ms
- **Tags:** needs-fairness
