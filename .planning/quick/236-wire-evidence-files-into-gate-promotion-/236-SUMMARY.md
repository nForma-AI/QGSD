---
phase: quick-236
plan: 01
subsystem: formal-verification
tags: [gates, evidence, promotion, convergence, solve]

requires:
  - phase: quick-234
    provides: per-model gate maturity scoring and autoClose remediation
provides:
  - Evidence-aware gate promotion criteria (SOFT_GATE >= 1/5, HARD_GATE >= 3/5)
  - Per-model gates step in run-formal-verify pipeline
  - Git heatmap contribution to convergence grand total
  - Evidence refresh from traces before convergence loop
  - autoClose evidence readiness reporting
affects: [formal-verification, gate-promotion, solve-pipeline]

tech-stack:
  added: []
  patterns: [fail-open evidence scoring, evidence-gated promotion thresholds]

key-files:
  created:
    - bin/refresh-evidence.cjs
  modified:
    - bin/compute-per-model-gates.cjs
    - bin/promote-gate-maturity.cjs
    - bin/run-formal-verify.cjs
    - bin/nf-solve.cjs

key-decisions:
  - "Evidence readiness uses fail-open scoring: missing/malformed files contribute 0, never block"
  - "Heatmap included in grand total display only, NOT in convergence loop prevTotal comparison"
  - "--skip-evidence flag relaxes evidence checks without affecting core promotion logic"

patterns-established:
  - "Evidence-gated promotion: gate level transitions require minimum evidence readiness scores"
  - "Pre-convergence refresh: evidence generators run once before solve loop, not per-iteration"

requirements-completed: [GATE-01, GATE-02, GATE-03, GATE-04]

duration: 4min
completed: 2026-03-09
---

# Quick 236: Wire Evidence Files into Gate Promotion Pipeline Summary

**Evidence-aware gate promotion with 5-file readiness scoring, heatmap in convergence totals, pre-loop evidence refresh, and autoClose readiness reporting**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T07:54:53Z
- **Completed:** 2026-03-09T07:59:00Z
- **Tasks:** 2
- **Files modified:** 5 (1 created)

## Accomplishments
- Gate promotion now considers evidence readiness (SOFT_GATE needs >= 1/5, HARD_GATE needs >= 3/5 evidence files populated)
- Per-model gate maturity scoring runs as a nonCritical step inside run-formal-verify pipeline
- Git heatmap residual contributes to the convergence grand total display
- Evidence files refreshed from traces before convergence loop via new refresh-evidence.cjs
- autoClose reports evidence readiness status and warns when insufficient for promotion

## Task Commits

Each task was committed atomically:

1. **Task 1: Add evidence readiness to gate promotion and wire per-model gates into run-formal-verify** - `a4845510` (feat)
2. **Task 2: Wire heatmap into convergence, add evidence refresh, and autoClose readiness checks** - `a770ac15` (feat)

## Files Created/Modified
- `bin/compute-per-model-gates.cjs` - Added computeEvidenceReadiness(), --skip-evidence flag, evidence thresholds in promotion logic
- `bin/promote-gate-maturity.cjs` - Updated validateCriteria() to accept optional evidenceReadiness parameter
- `bin/run-formal-verify.cjs` - Added gates:per-model step to STATIC_STEPS
- `bin/nf-solve.cjs` - Heatmap in grandTotal, evidence refresh before convergence, autoClose evidence check
- `bin/refresh-evidence.cjs` - New script running 4 evidence generators with fail-open and JSON output

## Decisions Made
- Evidence readiness uses fail-open scoring: missing/malformed evidence files contribute 0 to the score, never blocking the pipeline
- Heatmap total is included in grand total display only, NOT in the convergence loop's prevTotal comparison (adding it would prevent convergence since heatmap changes independently)
- --skip-evidence flag only relaxes evidence checks and cannot promote a gate that wouldn't otherwise be promotable by source_layer + check-results criteria
- Evidence refresh runs once before the for-loop, not per-iteration, since it is relatively expensive

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Heatmap subtotal line already existed**
- **Found during:** Task 2
- **Issue:** Plan instructed to add `lines.push('  Heatmap subtotal:      ' + hmTotal)` but this line already existed at line 2885
- **Fix:** Only added the grandTotal inclusion (hmTotal2 variable) without duplicating the display line
- **Files modified:** bin/nf-solve.cjs
- **Verification:** grep confirmed single heatmap subtotal line, grandTotal includes heatmap
- **Committed in:** a770ac15 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug avoidance)
**Impact on plan:** Minor — avoided duplicate display line. No scope creep.

## Issues Encountered
None

## Next Phase Readiness
- Evidence pipeline fully wired: evidence files now inform gate promotion decisions
- Current evidence readiness is 2/5 (trace-corpus-stats and proposed-metrics populated)
- To increase readiness, populate instrumentation-map, state-candidates, and failure-taxonomy with richer content

---
*Phase: quick-236*
*Completed: 2026-03-09*
