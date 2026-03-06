# Formal Verification Suspects

**Generated:** 2026-03-06T10:11:46.117Z
**Total Suspects:** 2

## Critical Failures (result=fail)

### ci:conformance-traces
- **Property:** Conformance event replay through XState machine
- **Summary:** fail: 6369 divergence(s) in 35627 traces (356ms)
- **Runtime:** 356ms
- **Tags:** trace-divergence

## Inconclusive with Tags (result=inconclusive)

### ci:liveness-fairness-lint
- **Property:** Liveness fairness declarations — all TLA+ liveness properties documented with WF/SF rationale
- **Summary:** inconclusive: fairness declarations missing — MCconvergence: ResolvedAtWriteOnce, HaikuUnavailableNoCorruption; MCdeliberation: DeliberationMonotone, ImprovementMonotone
- **Runtime:** 10ms
- **Tags:** needs-fairness
