# Research Complete: v0.39 Dual-Cycle Formal Reasoning

**Date:** 2026-03-18
**Milestone:** v0.39 — Dual-Cycle Formal Reasoning
**Mode:** Ecosystem (features + architecture + pitfalls)
**Confidence:** MEDIUM

## Summary of Findings

Dual-cycle formal reasoning is a novel synthesis of formal verification patterns (CEGAR, constraint mutation, invariant refinement) that extends v0.38's model-driven debugging with:

1. **Cycle 1 (Diagnostic):** When model fails to reproduce bug, generate "model assumes X but trace shows Y" diff instead of blind retry
2. **Cycle 2 (Solution Simulation):** Accept fix intent (language/constraint/sketch), mutate model, simulate consequence, verify three convergence gates, then commit code

### Key Findings

**Strengths:**
- Academically sound foundations (CEGAR, constraint mutation, invariant preservation all established patterns)
- Reuses v0.38 infrastructure heavily (bug-model lookup, TLC execution, proximity-neighbor verification, inverted semantics)
- Provides auditable evidence for fixes ("here's the consequence model proving this fix works")
- Neighbor-aware convergence prevents silent cross-component regressions
- Structural enforcement via Stop hook prevents workflow bypass

**Risks (Needing Phase-Specific Research):**
- **Phase 02 (Cycle 1 diagnostic):** LLM-assisted constraint-to-English explanation may not be reliable; needs prototype validation
- **Phase 03 (Cycle 2 simulation):** Constraint DSL design is critical; mutation semantics validation is complex; state space explosion risk
- **Trace normalization:** Mapping coarse-grained bug traces to precise formal traces is heuristic-heavy; many edge cases

**Differentiators:**
- Trace-based diagnosis (observes actual behavior, not just abstract refinement)
- Multi-form fix intent (constraint + natural language + code sketch)
- Inverted verification (bug validates model, fix validates in model space before code)
- Structural enforcement (can't bypass gates)
- Integrated neighbor checking (prevents false positives)

### Feature Landscape

**Table Stakes (7 features):**
1. Model diagnostic diffing
2. Bug as ground truth reframe
3. Fix intent normalization
4. Consequence model generation
5. Simulation loop with trace playback
6. Convergence gate (3-condition AND)
7. Iteration limit & escape

**Differentiators (6 features):**
1. Inverted verification semantics
2. Targeted diagnostic instead of blind retry
3. Fix intent → model mutation pipeline
4. Consequence modeling as auditable artifact
5. Neighbor-aware convergence
6. No code commit without convergence

**Anti-Features (5 explicitly NOT building):**
1. Auto-generate all fixes from counterexample (combinatorial explosion)
2. Parallel iterations (race conditions, hard to explain)
3. Accept code as fix intent (defeats dual-cycle purpose)
4. Skip neighbor check (v0.38 found real regressions)
5. User-editable model mutations (breaks coherence)

### Roadmap Structure

**Phase v0.39-01 (Discovery & Foundation)**
- Infrastructure: trace comparison, canonical representation, normalization heuristics
- Semantics: bug as ground truth reframe (prompt language, gate interpretation)
- Framework: fix intent DSL (minimal syntax), iteration limit
- Complexity: LOW-MEDIUM

**Phase v0.39-02 (Cycle 1 Diagnostic)**
- Feature: counterexample diff extraction + diagnostic output synthesis
- Integration: quorum prompt injection of diagnostic
- Complexity: HIGH (RESEARCH NEEDED: LLM-assisted explanation)

**Phase v0.39-03 (Cycle 2 Simulation)**
- Feature: model mutation engine, consequence generation, TLC loop, convergence gate
- Complexity: VERY HIGH (RESEARCH NEEDED: constraint DSL, mutation semantics, state space handling)

**Phase v0.39-04 (Integration & Hardening)**
- Enforcement: Stop hook integration, neighbor regression verification
- Testing: E2E integration tests, error handling
- Complexity: MEDIUM

**Phase Ordering Rationale:**
- 01 blocks 02 & 03 (foundation required)
- 02 informs 03 (Cycle 1 diagnostic guides Cycle 2 intent)
- 03 blocks 04 (simulation must work before integration)
- Sequential is lower-risk than parallel; partial overlap possible but not recommended

### Research Flags

**Phase v0.39-02: NEEDS DEEPER RESEARCH (2-3 days)**
- How do we extract minimal diagnostic diff from TLA+ constraint set?
- Can we reliably generate English explanation from constraint diff via LLM?
- How do we rank candidate diffs by relevance/impact?
- Precision vs. accuracy: detailed diagnostics unreadable; vague ones useless. How to balance?

**Phase v0.39-03: NEEDS DEEPER RESEARCH (3-5 days)**
- Constraint DSL design: what subset of TLA+ can users safely mutate?
- Mutation semantics validation: how to prevent unsatisfiable/contradictory specs?
- State space explosion: when does consequence model become intractable? How to bound?
- Trace alignment: how to handle incomplete/coarse-grained bug traces? Canonical format?

**Phase v0.39-01 & v0.39-04: Standard, unlikely to need deeper research**
- Infrastructure is straightforward plumbing
- Integration reuses existing v0.38 framework

### Confidence Assessment

| Area | Level | Rationale |
|------|-------|-----------|
| Overall approach | MEDIUM | Novel synthesis; academically sound but unproven integration |
| Cycle 1 (diagnostic) | MEDIUM | CEGAR foundations solid; trace-based application is novel; needs validation |
| Cycle 2 (simulation) | MEDIUM | Constraint mutation established; integration into pipeline is novel; needs validation |
| Convergence gate | MEDIUM-HIGH | 3-condition AND straightforward; reuses v0.38; low-risk |
| v0.38 reuse | HIGH | All dependencies available; proven in v0.38; low-risk reuse |
| Stack & tools | HIGH | TLA+/TLC production-grade; minimal new infrastructure |
| Differentiators | MEDIUM | Achievable but require careful implementation; not established patterns |

### Gaps to Address Before Implementation

1. **Constraint DSL (Phase 03 blocker):** Exact user syntax? Validation approach? Safe mutations?
2. **Trace Normalization (Phase 01/02 blocker):** Canonical format? Alignment heuristics? Concurrency handling?
3. **Neighbor Regression Scaling (Phase 04 blocker):** Parallelization feasibility? Skip conditions?
4. **LLM Explanation (Phase 02 blocker):** Reliability on real TLA+ models? Prompt engineering?

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| SUMMARY_v0.39_DUAL_CYCLE.md | Executive summary with roadmap implications | 199 |
| FEATURES_v0.39_DUAL_CYCLE.md | Feature landscape (table stakes, differentiators, anti-features) | 137 |
| README_v0.39_RESEARCH.md | Research guide and next steps | ~150 |
| RESEARCH_COMPLETE_v0.39.md | This file (structured result for orchestrator) | — |

**Note:** Additional research files exist from prior researchers (ARCHITECTURE, STACK, PITFALLS, INDEX variants). These documents focus on features for downstream roadmap creation.

## Next Steps for Roadmap Phase

1. **Read SUMMARY_v0.39_DUAL_CYCLE.md** — understand phase structure and research flags
2. **Read FEATURES_v0.39_DUAL_CYCLE.md** — reference feature breakdown
3. **Conduct Phase 02 deep research** (schedule 2-3 day investigation block):
   - Prototype constraint-to-English explanation on real v0.38 TLA+ models
   - Validate LLM reliability; test prompt engineering approaches
   - Document canonical diagnostic output format
4. **Conduct Phase 03 deep research** (schedule 3-5 day investigation block):
   - Design constraint DSL (decidable subset of TLA+)
   - Prototype mutation semantics validator
   - Test consequence model generation on medium-size models
   - Identify state space explosion boundary conditions
5. **Update roadmap phases** with research findings; adjust scope if needed
6. **Proceed to phase execution** once roadmap finalized

## Recommendation

**Build v0.39 as planned (4 phases), but condition Phases 02 & 03 on successful research:**

- If Phase 02 research shows diagnostic explanation is unreliable, consider shipping v0.39 as "diagnostic infrastructure only" (Phase 01 + partial Phase 02) and deferring Cycle 1 completeness to v0.39.x
- If Phase 03 research reveals mutation semantics is riskier than expected, defer Cycle 2 to v0.40 and focus v0.39 on Cycle 1 diagnostic as standalone feature
- Either way, Phase 01 (infrastructure) should ship; it's low-risk and foundational

**Do not skip research phases.** The complexity flags are real; validating DSL design and mutation semantics before committing to implementation will save significant rework.

---

**Research completed:** 2026-03-18
**Mode:** Ecosystem
**Next phase:** Roadmap creation (pending phase-specific research)
**Confidence:** MEDIUM (solid foundations, novel integration, requires validation)
