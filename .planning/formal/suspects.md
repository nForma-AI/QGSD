# Formal Verification Suspects

**Generated:** 2026-03-05T12:00:53.080Z
**Total Suspects:** 3

## Critical Failures (result=fail)

### alloy:scoreboard
- **Property:** Scoreboard idempotency — no vote loss, no double counting
- **Summary:** fail: alloy:scoreboard in 736ms
- **Runtime:** 736ms
- **Tags:** none

### ci:conformance-traces
- **Property:** Conformance event replay through XState machine
- **Summary:** fail: 10758 divergence(s) in 27217 traces (165ms)
- **Runtime:** 165ms
- **Tags:** trace-divergence

## Inconclusive with Tags (result=inconclusive)

### ci:liveness-fairness-lint
- **Property:** Liveness fairness declarations — all TLA+ liveness properties documented with WF/SF rationale
- **Summary:** inconclusive: fairness declarations missing — MCconvergence: ResolvedAtWriteOnce, HaikuUnavailableNoCorruption; MCdeliberation: DeliberationMonotone, ImprovementMonotone
- **Runtime:** 1ms
- **Tags:** needs-fairness
