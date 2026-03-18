# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Planning decisions are multi-model verified by structural enforcement
**Current focus:** v0.38 — Model-Driven Debugging

## Current Position

Phase: 3 of 5 (Model Refinement Workflow)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-03-18 — Completed v0.38-02 (Debug Command Integration)

Progress: [########..........] 40% (Phases 1-2 of 5)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 5min
- Total execution time: 0.38 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v0.38-01 | 3 | 16min | 5min |
| v0.38-02 | 2 | 7min | 3.5min |

**Recent Trend:**
- Last 5 plans: 4min, 8min, 4min, 4min, 3min
- Trend: stable/improving

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v0.38 roadmap: 5 phases derived from 20 requirements across 6 categories (BML, CEX, DBG, MRF, BTF, REG)
- Phase 1 combines BML + CEX (infrastructure foundation for all downstream phases)
- Phase 4 (BTF) depends only on Phase 1, enabling potential parallel execution with Phase 3 (MRF)
- v0.38-01-01: Model path name tokenization with camelCase splitting for matching (most registry descriptions empty)
- v0.38-01-01: Deterministic bug_id via SHA-256 hash (8-char hex) for reproducibility
- v0.38-01-01: Module exports added to formal-scope-scan.cjs for unit test access
- v0.38-01-02: Rule-based English rendering instead of LLM translation (deterministic, zero-latency)
- v0.38-01-02: Position-based TLA+ definition extraction instead of single-regex for clean boundary handling
- v0.38-01-03: MC config discovery via .cfg content scanning for spec module name references
- v0.38-01-03: Subprocess spawning of run-tlc.cjs/run-alloy.cjs rather than inline Java invocation
- v0.38-02-01: Lazy-load dependency injection (_setDeps) for debug-formal-context.cjs testability
- v0.38-02-01: 30s checker timeout (vs 60s default) for faster debug loop turnaround
- v0.38-02-01: Max 3 constraints per consultation to avoid cognitive overload
- v0.38-02-02: FORMAL row always renders in result table (signals "checked" vs "didn't check")
- v0.38-02-02: Gap persistence uses inline node heredoc (consistent with existing debug.md patterns)
- v0.38-02-02: Divergence note uses concrete substring detection for formal/consensus disagreement

### Pending Todos

None yet.

### Blockers/Concerns

- Research flagged: B-to-F layer noise from test flakiness needs stability filter in Phase 4

## Session Continuity

Last session: 2026-03-18
Stopped at: Phase v0.38-02 complete, ready to plan Phase v0.38-03
Resume file: None
