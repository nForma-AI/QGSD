---
phase: 056-diagnostic-enrichment
plan: 01
subsystem: formal-modeling
tags: [coderlm, callee-count, git-heatmap, priority-ranking, fail-open]

requires:
  - phase: 055-remediation-enrichment
    provides: coderlm adapter integration foundation, getCallersSync query method
provides:
  - Git heatmap hot-zone ranking now incorporates callee_count alongside git churn score
  - computePriority() function extended to accept calleeCount with Math.log1p weighting
  - sweepGitHeatmap() enriches callee counts from coderlm queries with fail-open pattern
affects:
  - Phase 057 (Accuracy & Safety) — better hot-zone prioritization improves formal coverage targeting

tech-stack:
  added: []
  patterns:
    - "CREM-03: Fail-open enrichment pattern — adapter health check before per-entry queries"
    - "Module-level _activeAdapter for sweep function access (matching formalTestSyncCache pattern)"

key-files:
  created: []
  modified:
    - bin/git-heatmap.cjs
    - bin/nf-solve.cjs

key-decisions:
  - "Use Math.log1p(calleeCount) for sublinear weighting to avoid explosion on high-caller files (10 callers → 1.4x boost, 100 callers → 1.6x boost)"
  - "Module-level _activeAdapter variable for sweepGitHeatmap() access (matches existing formalTestSyncCache pattern)"
  - "Enrichment happens before hot-zone slice(0,20) in output, ensuring re-sorted priority applies to top results"

requirements-completed: [CREM-03]

duration: 18min
completed: 2026-04-10
---

# Phase 56: Diagnostic Enrichment Summary

**Git heatmap hot-zone ranking now incorporates callee count from coderlm, surfacing widely-used files for formal coverage even when their git churn is moderate**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-10T15:06:00Z
- **Completed:** 2026-04-10T15:24:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended `computePriority()` in git-heatmap.cjs to accept `calleeCount` parameter with Math.log1p weighting
- Added `callee_count: 0` field to every uncovered_hot_zones entry (placeholder for enrichment)
- Implemented CREM-03 enrichment block in sweepGitHeatmap() that queries getCallersSync per file and re-sorts by updated priority
- Achieved fail-open design: when coderlm is unavailable or unhealthy, heatmap falls back to git churn ranking with zero errors
- All 1417 tests passing with 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Add callee_count field to git-heatmap computePriority and hot-zone entries** - `346055c3` (feat)
2. **Task 2: Enrich sweepGitHeatmap() with getCallers callee counts (fail-open)** - `8bd42a57` (feat)

**Plan metadata:** Will be committed after SUMMARY.md completion

## Files Created/Modified

- `bin/git-heatmap.cjs` — Updated computePriority() signature and buildUncoveredHotZones() output
- `bin/nf-solve.cjs` — Added _activeAdapter module variable, updated sweepGitHeatmap() with enrichment logic, wired adapter in main()

## Decisions Made

- **Math.log1p weighting:** Sublinear boost avoids explosion for very-high-caller files while still rewarding callee count meaningfully (files with 0 callers get 1.0x multiplier, 10 callers get ~1.4x, 100 callers get ~1.6x)
- **Module-level adapter variable:** Followed existing formalTestSyncCache pattern for scope access rather than function parameter chain
- **Enrichment ordering:** Callee count enrichment happens before output slicing, ensuring re-sorted priority applies to all results including top-20 slice
- **Per-entry fail-open:** Each getCallersSync call wrapped in try-catch; failure on one file doesn't block others

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — plan was clear and comprehensive, all tasks executed without problems.

## Next Phase Readiness

- Heatmap hot-zones now carry callee_count field and updated priority scores
- Phase 057 can leverage improved ranking to select files with higher blast radius for formal modeling
- Fail-open pattern ensures pre-integration behavior remains when coderlm is unavailable

---

*Phase: 056-diagnostic-enrichment*
*Completed: 2026-04-10*
