---
phase: 055-remediation-enrichment
plan: 01
subsystem: formal-modeling
tags: [coderlm, seed-files, formal-specs, requirement-discovery]

# Dependency graph
requires:
  - phase: 054-adapter-foundation
    provides: coderlm adapter synchronous API (getImplementationSync, getCallersSync, healthSync)
provides:
  - --seed-files flag support in close-formal-gaps workflow and command
  - Per-requirement coderlm-enriched R->F remediation dispatch in solve-remediate
  - Fail-open coderlm integration (batch fallback when unavailable)
affects:
  - Phase 056 (Diagnostic Enrichment) — formalisms will have seeded context
  - Subsequent R->F iterations — seed discovery optimizes spec generation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Fail-open integration pattern (coderlm unavailable = graceful batch fallback)
    - Per-requirement dispatch with cross-contamination prevention
    - Symbol hint extraction (function-name derivation from requirement ID)

key-files:
  created: []
  modified:
    - core/workflows/close-formal-gaps.md
    - commands/nf/close-formal-gaps.md
    - commands/nf/solve-remediate.md

key-decisions:
  - "Symbol hint derived from requirement ID (not raw ID) to enable function lookup"
  - "Individual dispatch for seeded requirements prevents cross-contamination of caller context"
  - "BATCH_IDS accumulation preserves pre-integration behavior when coderlm unavailable"

patterns-established:
  - "Coderlm queries: getImplementationSync(symbolHint) followed by getCallersSync(symbolHint, file)"
  - "Health check gates integration: failure → empty seed_files → batch fallback"
  - "Per-requirement loop with fail-open accumulation to batch queue"

requirements-completed:
  - CREM-01

# Metrics
duration: 12min
completed: 2026-04-08
---

# Phase 055 Plan 01: Remediation Enrichment — Seed-Files Integration

**Coderlm seed-file discovery wired into R->F remediation: formal specs generated with actual function signatures, state variables, and caller relationships from the codebase**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-08T13:18:00Z
- **Completed:** 2026-04-08T13:30:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **Task 1:** Added `--seed-files` flag support to close-formal-gaps workflow (Step 1 parsing, Step 5 injection for all formalisms)
- **Task 2:** Integrated coderlm seed-file discovery into R->F remediation dispatch (per-requirement loop with health check fallback)
- **Fail-open verified:** When coderlm is unavailable, requirements accumulate for batch dispatch, preserving pre-integration behavior exactly

## Task Commits

Each task was committed atomically:

1. **Task 1: Add --seed-files flag to close-formal-gaps workflow and command** - `2dfbcd6e` (feat)
   - Added flag parsing in Step 1 with fail-open empty set handling
   - Added Seed Files Injection block in Step 5 (all formalisms)
   - Updated commands/nf/close-formal-gaps.md argument-hint and process

2. **Task 2: Wire coderlm seed-file discovery into R->F remediation dispatch** - `61c8eac2` (feat)
   - Implemented per-requirement loop with coderlm getImplementationSync + getCallersSync
   - Symbol hint extraction from requirement ID (fallback strategy)
   - BATCH_IDS accumulation for seed-less requirements
   - Health check with fail-open → batch dispatch fallback

## Files Created/Modified

- `core/workflows/close-formal-gaps.md` - Added seed-files flag parsing (Step 1) and injection block (Step 5)
- `commands/nf/close-formal-gaps.md` - Added `--seed-files` to argument-hint and process documentation
- `commands/nf/solve-remediate.md` - Added coderlm seed-file discovery and per-requirement dispatch in section 3a

## Decisions Made

- **Symbol hint derivation:** Requirement ID → stripped dashes → lowercase (e.g., CREM-01 → crem01). Enables fallback when requirement text not available in symbol lookup context.
- **Individual vs. batch dispatch:** Seeds discovered → dispatch per-requirement (prevent spec cross-contamination via shared caller context). No seeds → accumulate to BATCH_IDS for single batch dispatch.
- **Coderlm unavailability:** Health check gates integration. Failure → empty seed_files array → accumulate to batch. Preserves pre-integration behavior with zero errors.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Seed-file infrastructure ready for Phase 056 (Diagnostic Enrichment)
- R->F remediation now produces formalisms with seeded implementation context
- Coderlm integration is fail-open and backwards-compatible with existing batch flow

---

*Phase: 055-remediation-enrichment*
*Completed: 2026-04-08*
