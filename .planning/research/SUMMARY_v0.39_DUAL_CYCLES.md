# Research Summary: Dual-Cycle Formal Reasoning (v0.39)

**Domain:** Formal model-driven software debugging
**Researched:** 2026-03-18
**Overall confidence:** HIGH

## Executive Summary

nForma v0.39 adds dual-cycle formal reasoning to the existing model-driven-fix architecture (v0.38). Instead of models being one-way descriptive tools (validating code), they become two-way sandbox tools: bugs validate/improve models (Cycle 1), and models validate fix ideas before code is touched (Cycle 2).

The architecture is **purely additive** — no changes to existing v0.38 modules, only new modules added for diagnostic generation and solution simulation. Both cycles run within the existing 6-phase orchestrator as enhanced intelligence:

- **Cycle 1 (Diagnostic):** Phase 2 enhancement — when a model fails to reproduce a bug, generate "model assumes X but bug shows Y" guidance instead of blind retry
- **Cycle 2 (Solution Simulation):** Phase 4.5 (new) — test fix ideas in model space (3 convergence gates: invariant preservation, bug resolution, neighbor regression) before code is committed

The design leverages existing infrastructure (run-formal-verify.cjs, resolve-proximity-neighbors.cjs, refinement-loop.cjs) and adds 7 new modules (4 core modules + 3 supporting). Build order is 3 waves: diagnostic foundation (1 module, 3 days), full solution simulation (4 modules, 5-7 days), UX polish (2 modules, 2-3 days).

## Key Findings

**Stack:**
- No new runtime dependencies. All new modules are Node.js/shell orchestrators calling existing TLA+/Alloy/PRISM checkers.

**Architecture:**
- Cycle 1 integrates into Phase 2 (Reproduction) as optional diagnostic output
- Cycle 2 inserts as Phase 4.5, gated by `--cycle2` flag or user prompt
- 4 core new modules: cycle1-diagnostic-diff.cjs, normalize-fix-idea.cjs, generate-consequence-model.cjs, convergence-gate.cjs
- 3 supporting: Phase 4.5 orchestrator changes to model-driven-fix.md, persistence layer, CLI flags

**Critical pitfall:**
- Consequence model state space explosion if mutations are large. Mitigated by: iteration limit (default 3), pre-flight estimation heuristic, caching of consequence models by hash.

## Implications for Roadmap

The suggested phase structure for v0.39 is 3 waves aligned with delivery value:

### Phase 1: Diagnostic Foundation (Cycle 1) — 2-3 days
- **Deliverable:** When Phase 2 reproduction fails, user sees targeted diagnostic ("model assumes timeout=5s, bug shows 10s")
- **Modules:** cycle1-diagnostic-diff.cjs + model-driven-fix.md enhancement
- **Tests:** 10 integration tests
- **User value:** Early feedback to improve model specs without blind retry loop
- **Risk:** LOW — read-only diagnostic; no orchestrator logic changes
- **Addresses:** Cycle 1 requirement ("model assumes X but bug shows Y diffs")

### Phase 2: Solution Simulation (Cycle 2) — 5-7 days
- **Deliverable:** Phase 4.5 fully functional with 3 convergence gates; users can test fix ideas in model space
- **Modules:** normalize-fix-idea.cjs, generate-consequence-model.cjs, convergence-gate.cjs, Phase 4.5 orchestration
- **Tests:** 45 integration tests (12 normalize + 10 generate + 15 convergence + 8 E2E)
- **User value:** Formal validation of fixes before code changes; reduced code-level iteration
- **Risk:** MEDIUM — consequence model generation and gate condition detection need careful formalism-specific implementation
- **Addresses:** Cycle 2 requirement ("accept fix ideas, normalize, test, iterate")

### Phase 3: User Experience & Optimization — 2-3 days
- **Deliverable:** CLI flags (--auto-cycle2, --max-iterations), optional /nf:apply-fix convenience command
- **Modules:** CLI enhancement, optional command wrapper
- **Tests:** 7 flag/command tests
- **User value:** Easier access to dual cycles; integration with existing /nf:debug workflows
- **Risk:** LOW — polish layer; no core logic changes
- **Addresses:** Accessibility and integration requirements

**Phase ordering rationale:**
- Cycle 1 first: Provides immediate value with minimal risk; diagnostic feedback improves Phase 3 refinement quality
- Cycle 2 second: Depends on diagnostic insights; solution testing builds on improved models from Phase 1
- UX polish last: Polish on top of working core; doesn't block delivery of Phases 1-2

**Research flags for phases:**
- Phase 1 (Cycle 1): Standard pattern; unlikely to need deeper research. Diagnostic diff generation is well-defined per formalism (TLA+/Alloy/PRISM).
- Phase 2 (Cycle 2): NEEDS deeper research on:
  - Bug condition capture: How to detect "bug still triggered" varies by formalism. Need formalism-specific gate implementations.
  - Consequence model complexity: State space explosion risk; need pre-flight heuristic to estimate mutation impact.
  - Normalization confidence: NLP fallback may be ambiguous; need user feedback integration.
- Phase 3 (UX): Standard CLI work; minimal research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| **Stack** | HIGH | No new dependencies; reuses existing infrastructure (TLA+, Alloy, PRISM runners) |
| **Architecture** | HIGH | Phase integration points clear; module boundaries well-defined; no changes to existing v0.38 code |
| **Build order** | HIGH | Dependencies respected (Cycle 1 → Cycle 2 → UX); deliverables align with value (diagnostic first) |
| **Cycle 1 logic** | HIGH | Diagnostic diff generation is straightforward analysis; no formal verification needed for Phase 1 |
| **Cycle 2 logic** | MEDIUM | Convergence gates are sound (invariant + bug + regression), but formalism-specific implementation needs validation. Consequence model generation is straightforward for simple mutations; complex mutations (multiple variables, new transitions) may need refinement. |
| **User experience** | MEDIUM | Interaction pattern (propose fix → normalize → test → iterate) is well-reasoned, but prompt design and error messaging need UX validation with actual users |

## Gaps to Address

1. **Convergence gate detection per formalism**
   - Specification: How does "bug condition still triggered" look in TLA+ vs Alloy vs PRISM? Need formalism-specific gate condition extractors.
   - Research needed in Phase 2: Detailed gate condition capture for each formalism.

2. **Consequence model state space estimation**
   - Specification: What pre-flight heuristics estimate mutation impact (e.g., variable bound change → 2x state space)?
   - Research needed in Phase 2: Build heuristic table per mutation type.

3. **Normalization confidence thresholds**
   - Specification: When to ask user for clarification vs. auto-accept normalization?
   - Recommendation: <70% → ask; 70-85% → accept with note; >85% → accept silently.
   - Validation: Early user testing in Phase 3.

4. **Iteration guidance quality**
   - Specification: When Cycle 2 returns ITERATE verdict, what guidance is "suggested refinement"?
   - Recommendation: Define templates per gate type (e.g., "Bug gate failed: condition {X} still triggers. Try adding constraint {Y}").
   - Validation: Collect user feedback on suggestion usefulness.

5. **Neighbor model scope for regression gate**
   - Current assumption: Use 2-hop BFS (same as Phase 5b).
   - Alternative: Tighter scope (direct neighbors only) for faster gates.
   - Recommendation: Use 2-hop for consistency; make configurable via `--regression-scope=direct|2-hop`.

## Related Architecture

**Feeds from:**
- v0.38 model-driven-fix.md (6-phase orchestrator) — Cycle 1/2 enhance Phases 2 & 4
- refinement-loop.cjs (bug context + inverted verification) — Cycle 1 diagnostic leverages same patterns
- model-constrained-fix.cjs (constraint extraction) — Cycle 2 accepts constraints as input
- run-formal-verify.cjs (master verification runner) — Cycle 2 gates use same runner with scope filtering

**Feeds to:**
- /nf:debug workflow (can pre-populate constraints from Cycle 2 convergence failures)
- /nf:solve remediation (B→F layer can flag bugs that models don't cover, triggering model refinement)
- Future: fix validation cache (cache consequence model results by normalized form hash for reuse)

## Next Steps

1. **Confirm Phase 1 scope:** cycle1-diagnostic-diff.cjs implementation details (formalism parsing per TLA+/Alloy/PRISM)
2. **Design Phase 2 gates:** Detailed specification of convergence gate condition capture per formalism
3. **Estimate Phase 2 complexity:** State space heuristics for consequence models (bounds increase → space increase factor)
4. **Plan UX validation:** User testing script for Phase 3 (prompt clarity, error message usefulness)
5. **Setup CI gates:** Test suite structure (62 tests across 3 waves; all tests must pass before phase completion)

## Sources

- `.planning/PROJECT.md` (v0.39 vision and requirements)
- `.planning/STATE.md` (milestone scope decisions)
- `commands/nf/model-driven-fix.md` (v0.38 6-phase orchestrator)
- `commands/nf/close-formal-gaps.md` (Phase 3: spec generation + refinement loop)
- `bin/refinement-loop.cjs` (bug context normalization + inverted verification)
- `bin/model-constrained-fix.cjs` (constraint extraction)
- `bin/run-formal-verify.cjs` (scoped verification runner)
- `bin/resolve-proximity-neighbors.cjs` (2-hop BFS neighbor resolution)
- `.planning/formal/model-registry.json` (model metadata for scoping)
