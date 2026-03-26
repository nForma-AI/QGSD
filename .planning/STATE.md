# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Planning decisions are multi-model verified by structural enforcement
**Current focus:** Milestone v0.41 COMPLETE

## Current Position

Phase: 53 of 53 (Skill Deprecation) — COMPLETED
Plan: 53-01 of 1 — COMPLETED
Status: All phases complete — /nf:model-driven-fix deprecated, all consumers rewired to /nf:debug
Last activity: 2026-03-26 - Completed quick task 359: Close gap in formal model bootstrapping

Progress: [██████████] 100% (Phase 50 done; Phase 51 done; Phase 52 done; Phase 53 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: ~7.3 minutes
- Total execution time: ~73 minutes

*Updated after each plan completion*

| Plan | Duration | Tasks | Files | Tests | Pass Rate |
|------|----------|-------|-------|-------|-----------|
| v0.39-01-01 | ~10 min | 2 | 8 | 23 | 100% |
| v0.39-01-02 | ~6 min | 2 | 4 | 24 | 100% |
| v0.39-02-02 | ~5 min | 2 | 5 | 11 | 100% |
| v0.39-02-01 | ~6 min | 2 | 4 | 26 | 100% |
| v0.39-02-03 | ~10 min | 2 | 7 | 120 | 100% |
| v0.39-03-02 | ~8 min | 2 | 2 | 17 | 100% |
| v0.39-03-03 | ~3 min | 2 | 4 | 10 | 100% |
| v0.40-01-01 | ~15 min | 2 | 3 | 39 | 100% |
| v0.40-03-01 | ~7 min | 2 | 6 | 12 | 100% |
| 50-01 | 5 min | 2 | 1 | 0 | N/A |
| 50-02 | 1 min | 2 | 1 | 0 | N/A |
| 51-01 | 5 min | 2 | 1 | 0 | N/A |
| 51-02 | 3 min | 2 | 1 | 0 | N/A |
| 53-01 | 3 min | 3 | 3 | 0 | N/A |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v0.41 roadmap: 4 phases from 16 requirements (DBUG -> ROUTE -> GATE -> DEPR dependency chain)
- v0.41 roadmap: Debug integration is foundation phase — must exist before routing or gating can target it
- v0.41 roadmap: GATE is fail-open by default (GATE-04) — matches existing nForma fail-open philosophy
- v0.41 roadmap: Deprecation last — all consumers must be rewired before model-driven-fix can be deprecated
- Plan 50-01: Make `/nf:debug` the single entry point by absorbing model-driven-fix Phases 1-4 (Discovery, Reproduction, Refinement, Constraint Extraction)
- Plan 50-01: Use autoresearch-refine as module-only API (require() not CLI) for fine-grained iteration control with in-memory rollback
- Plan 51-01: Classification happens at Step 2.7 (after approach, before planner) with Haiku subagent
- Plan 51-02: Bug_fix routing threshold: confidence >= 0.7 (clear signals only; ambiguous cases skip debug, fail-open)
- [Phase quick-356]: All 7 new diagnostic sweeps are informational (not automatable) with no-op LAYER_HANDLERS

### Pending Todos

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|---|---|---|---|---|
| 351 | Enforce FALLBACK-01 in all workflow fail-open rules and add preflight slot/fallback preview display | 2026-03-25 | e107b7f1 | Verified | [351-enforce-fallback-01-in-all-workflow-fail](./quick/351-enforce-fallback-01-in-all-workflow-fail/) |
| 352 | Add TLC process timeout and model size guards to formal verification spawning | 2026-03-25 | 62a12a4a | Verified | [352-add-tlc-process-timeout-and-model-size-g](./quick/352-add-tlc-process-timeout-and-model-size-g/) |
| 353 | Add state-space preflight guard to run-tlc.cjs | 2026-03-25 | 1d52a48e | Verified | [353-add-state-space-preflight-guard-to-run-t](./quick/353-add-state-space-preflight-guard-to-run-t/) |
| 354 | Add 5 missing layers to solve-report table renderer | 2026-03-25 | a931c0cc | Verified | [354-add-5-missing-layers-p-to-f-b-to-f-per-m](./quick/354-add-5-missing-layers-p-to-f-b-to-f-per-m/) |
| 355 | Auto-invoke nf:resolve after solve finishes iterating | 2026-03-25 | 72a9a6d8 | Verified | [355-auto-invoke-nf-resolve-after-solve-finis](./quick/355-auto-invoke-nf-resolve-after-solve-finis/) |
| 356 | Wire 15 diagnostic scripts into nf-solve.cjs as sweeps | 2026-03-25 | 3b476722 | Verified | [356-wire-15-remaining-diagnostic-scripts-int](./quick/356-wire-15-remaining-diagnostic-scripts-int/) |
| 357 | Add require-path tracing to sweepTtoR and @req annotations to 8 domain-named test files to eliminate T→R false positives | 2026-03-25 | 9d5f82d2 | Verified | [357-add-require-path-tracing-to-sweepttor-an](./quick/357-add-require-path-tracing-to-sweepttor-an/) |
| 358 | Add graph-first discovery to formal-scope-scan.cjs and extract unified semantic+graph search module shared by both formal-scope-scan.cjs and candidate-discovery.cjs | 2026-03-26 | 871e21f2 | Needs Review | [358-add-graph-first-discovery-to-formal-scop](./quick/358-add-graph-first-discovery-to-formal-scop/) |
| 359 | Close gap: allow formal_artifacts create when scope-scan empty | 2026-03-26 | afdea71c | Pending | [359-close-the-gap-when-formal-scope-scan-fin](./quick/359-close-the-gap-when-formal-scope-scan-fin/) |

### Blockers/Concerns

None currently.

## Session Continuity

Last session: 2026-03-26
Stopped at: Completed quick task 358: Add graph-first discovery and unified search module
Resume file: None
