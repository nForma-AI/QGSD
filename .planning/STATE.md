# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01 after Milestone v0.21 roadmap created)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.
**Current focus:** v0.21 — FV Closed Loop (Phase v0.21-02: Conformance Crisis Fix)

## Current Position

Phase: v0.21-02 of 6 (Conformance Crisis Fix)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-03-01 — v0.21-01 Central Model Registry complete: 4 plans, 18/18 tests GREEN, ARCH-01/02/03 satisfied

Progress: [████░░░░░░░░░░░░░░░░░░░] v0.21: 1/6 phases (17%)

## Performance Metrics

**Velocity:**
- Total plans completed: 46+ (across v0.2–v0.9)
- Average duration: 3.5 min
- Total execution time: ~2.7 hours

**By Phase (recent):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v0.20-09 P01 | 1 | - | - |
| v0.20-08 P03 | 1 | - | - |
| v0.20-08 P01 | 1 | 600s | 600s |

**Recent Trend:**
- Last 5 plans: stable
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.21-01 shipped]: ARCH-01/02/03 complete — `formal/model-registry.json` (22 entries), `initialize-model-registry.cjs`, `promote-model.cjs`, `accept-debug-invariant.cjs`. Generate/debug/plan-promote flows all write to `formal/` atomically. 18/18 tests GREEN.
- [v0.21 roadmap]: ARCH-01/02/03 are Phase v0.21-01 (foundation) — all other phases write to `formal/` directly, never per-phase scratch only; must come first.
- [v0.21 roadmap]: DIAG-01/02/03 are Phase v0.21-02 — urgent (69% conformance crisis); depends on ARCH to have `formal/diff-report.md` destination; second in sequence.
- [v0.21 roadmap]: LOOP and SPEC phases (v0.21-03, v0.21-04) are parallelizable after ARCH — both depend only on v0.21-01; LOOP-04 debug invariants require ARCH-03 write path.
- [v0.21 roadmap]: PLAN-01/02/03 (v0.21-05) depends on ARCH + DIAG being stable before trusting FV results as planning gates.
- [v0.21 roadmap]: SIG-01/02/03/04 (v0.21-06) are last — consumes FV output from LOOP and SPEC phases; SIG-04 PRISM gate depends on calibrated rates from v0.21-03.
- [v0.20 completion]: v0.20 shipped 2026-03-01 — 9 phases, 20/20 requirements, FV as active planning gate delivered.

### Pending Todos

- `2026-02-20-add-gsd-quorum-command-for-consensus-answers.md` — Add qgsd:quorum command for consensus answers (area: planning)
- Phase 22 post-validation: 5-category taxonomy may need refinement based on empirical categorization results

### Blockers/Concerns

- [Phase 12 carry-forward]: npm publish qgsd@0.2.0 deferred; run `npm publish --access public` when user decides
- [v0.18-06/07 open]: v0.18-06 (FAN-04 Stop hook ceiling fix) and v0.18-07 (ENV-03 envelope path wiring) are not yet started — gap closure phases for v0.18
- [v0.21-02 urgency]: 69% conformance divergence is the most pressing technical debt from v0.12 — v0.21-02 must reduce this to <5%

## Session Continuity

Last session: 2026-03-01
Stopped at: Phase v0.21-01 complete — 4 plans, 18/18 tests GREEN, ARCH-01/02/03 satisfied. Central model registry shipped. Ready to plan Phase v0.21-02 (Conformance Crisis Fix).
Resume file: None
