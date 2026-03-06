---
phase: quick-193
plan: 01
subsystem: tooling
tags: [git-mining, evidence, heatmap, formal-verification]

requires:
  - phase: none
    provides: standalone tooling
provides:
  - bin/git-heatmap.cjs script for mining git history signals
  - .planning/formal/evidence/git-heatmap.json evidence artifact
affects: [nf-solve, formal-verification, evidence-pipeline]

tech-stack:
  added: []
  patterns: [two-pass git mining to avoid OOM, hunk-adjacent diff constraint, multiplicative priority scoring]

key-files:
  created:
    - bin/git-heatmap.cjs
    - bin/git-heatmap.test.cjs
    - .planning/formal/evidence/git-heatmap.json
  modified: []

key-decisions:
  - "Two-pass approach for numerical adjustments: numstat first to identify candidates, then targeted -p per file (avoids OOM on large repos)"
  - "Heuristic coverage map: read model file content for source file path references rather than requirements.json reverse lookup (simpler, sufficient)"
  - "Added 'bugfix' as compound word to BUGFIX_PATTERN alternation (word boundary doesn't split compound words)"

patterns-established:
  - "Two-pass git mining: numstat for candidate identification, targeted -p for detail extraction"
  - "execFileSync with argument arrays for all git commands (prevents command injection)"
  - "Multiplicative priority: max(churn,1) * (1+fixes) * (1+adjustments)"

requirements-completed: [QUICK-193]

duration: 5min
completed: 2026-03-06
---

# Quick 193: Git Heatmap Summary

**Git history mining script producing three-signal evidence (numerical adjustments, bugfix hotspots, churn ranking) with multiplicative priority scoring and formal coverage cross-reference**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T15:01:14Z
- **Completed:** 2026-03-06T15:06:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- bin/git-heatmap.cjs mines git history for three signal types with two-pass OOM-safe approach
- Cross-references against model-registry.json to flag files without formal coverage
- Priority scoring uses multiplicative formula with churn floor to prevent zero-priority config files
- 27 unit tests covering regex, drift detection, scoring, hunk constraints, sanitization, and e2e schema

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement bin/git-heatmap.cjs** - `4e587e48` (feat)
2. **Task 2: Write bin/git-heatmap.test.cjs** - `e59d88e7` (test)

## Files Created/Modified
- `bin/git-heatmap.cjs` - Git history mining script with three signal extractors and cross-reference logic
- `bin/git-heatmap.test.cjs` - 27 unit tests for all extraction and scoring logic
- `.planning/formal/evidence/git-heatmap.json` - Generated evidence file (40 adjustments, 699 bugfix files, 4750 churn files, 4691 uncovered hot zones)

## Decisions Made
- Two-pass approach for numerical adjustments avoids OOM on large git histories (numstat first, targeted -p per top-50 candidates)
- Coverage map uses heuristic content scanning of model files rather than requirements.json reverse lookup (simpler, sufficient for coverage detection)
- Added "bugfix" as compound word to BUGFIX_PATTERN — word boundary `\b` doesn't match inside compound words

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed BUGFIX_PATTERN to match "bugfix" compound word**
- **Found during:** Task 2 (test execution)
- **Issue:** Regex `\b(fix|bug|patch|hotfix|resolve[ds]?)\b` doesn't match "bugfix" because `\b` requires word boundary — "bugfix" is a single word
- **Fix:** Added "bugfix" to alternation: `\b(fix|bug|bugfix|patch|hotfix|resolve[ds]?)\b`
- **Files modified:** bin/git-heatmap.cjs
- **Verification:** Test "isBugfixCommit: matches fix commits" now passes
- **Committed in:** e59d88e7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix necessary for correct bugfix commit detection. No scope creep.

## Issues Encountered
None beyond the auto-fixed bug above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- git-heatmap.json evidence file ready for nf:solve consumption
- Script can be re-run with --since flag to scope to recent history
- Coverage map approach established for future evidence tools

---
*Quick: 193*
*Completed: 2026-03-06*
