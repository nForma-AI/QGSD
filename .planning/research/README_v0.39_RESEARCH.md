# v0.39 Dual-Cycle Formal Reasoning Research

**Research Completed:** 2026-03-18
**Milestone:** v0.39 — Dual-Cycle Formal Reasoning
**Status:** Research phase complete; ready for roadmap phase

## Research Files

This directory contains two primary research documents for v0.39:

### 1. SUMMARY_v0.39_DUAL_CYCLE.md (Start Here)

Executive summary synthesizing all research findings. Includes:
- High-level feature landscape (table stakes vs. differentiators vs. anti-features)
- Roadmap phase structure with ordering rationale (v0.39-01 through v0.39-04)
- Research flags indicating which phases need deeper investigation before commitment
- Confidence levels for each area
- Critical gaps to address before implementation

**Key takeaway:** Dual-cycle is a novel synthesis of CEGAR + constraint mutation + invariant preservation. Solid academic foundations, but needs Phase 02/03 research to validate constraint DSL design and mutation semantics before full commitment.

### 2. FEATURES_v0.39_DUAL_CYCLE.md (Reference)

Comprehensive feature breakdown:
- Table stakes: 7 features that must exist for dual-cycle to work
- Differentiators: 6 features that set nForma apart
- Anti-features: 5 things explicitly NOT building (with reasoning)
- Feature dependencies graph showing Cycle 1 and Cycle 2 interconnections
- MVP definition (what launches with v0.39 vs. deferred to v0.39.x/v2+)
- Feature prioritization matrix (P1/P2/P3)
- Domain patterns from academic literature (CEGAR, constraint mutation, iterative refinement)
- Risk factors by complexity (high/medium/low)
- Implementation sequencing

**Key takeaway:** MVP is ambitious (7 P1 features in Phase 1-3), but phased approach allows validation; natural language intent and Alloy support can defer to v0.39.x without blocking core value.

## What This Research Answers

### (a) Model Diagnostic Diffing
**Q: When model fails to reproduce bug, what's the diagnostic output?**

**A:** "Model assumes X but bug shows Y" — structured diff extracted from comparing model-projected trace against actual bug trace. Requires:
- Canonical TLA+ trace format for normalization
- TLA+ constraint parsing to extract assumptions
- Trace alignment heuristics to handle abstraction level mismatches
- LLM-assisted explanation synthesis

**Complexity:** MEDIUM. Foundations are CEGAR's counterexample analysis; application is novel.

### (b) Fix Intent → Model Mutation
**Q: How do users express fix intent, and how does it translate to model mutations?**

**A:** Three input forms normalized to unified constraint representation:
1. Natural language: "Add 5-second timeout" → extract constraint → normalize
2. Constraint syntax: TLA+ FIX blocks or Alloy constraint patches → parse → apply
3. Code sketches: pseudocode outline → abstract intent → normalize

All normalize to constraint DSL (decidable subset of TLA+; avoid Turing-complete). Semantic validation prevents unsatisfiable specs.

**Complexity:** HIGH. DSL design is critical blocker for Phase 03.

### (c) Consequence Modeling
**Q: How do consequence models work, and how do we ensure they're efficient?**

**A:** Consequence model = original model + constraint mutations. Applied mutations must:
- Preserve original model structure (only mutate targeted constraints)
- Remain logically sound (validated via constraint semantics checker)
- Stay within decidable logic (TLC state space bounded, no explosion)

TLC execution on consequence model is the oracle; trace playback validates fix prevents bug.

**Complexity:** VERY HIGH. State space tuning, mutation semantics validation, trace alignment all risky.

### (d) Convergence Detection
**Q: When do we declare "fix simulation converged"?**

**A:** Three-condition AND gate (all must pass):
1. **Invariants preserved:** All original model invariants still hold on consequence model (inverted verification semantics: violation = evidence of correctness)
2. **Bug eliminated:** Original bug no longer triggers against consequence model (primary goal)
3. **Neighbor regressions absent:** 2-hop proximity neighbors (from v0.38) verified clean against consequence model (prevents silent cross-component failures)

Gate is automated (no human approval required); configurable `--max-iterations` escape hatch (default 3).

**Complexity:** MEDIUM. Gate logic straightforward; enforcement tricky (Stop hook integration). Neighbor check reuses v0.38 framework.

## Roadmap Structure (From Research)

Research recommends this phase sequence:

**v0.39-01: Discovery & Foundation**
- Trace comparison infrastructure
- Bug as ground truth semantic reframe
- Fix intent normalization (constraint form)
- Iteration limit framework
- **Likely complexity:** LOW-MEDIUM

**v0.39-02: Cycle 1 Diagnostic**
- Counterexample diff extraction
- Diagnostic output synthesis
- Quorum prompt injection
- **Likely complexity:** HIGH (needs Phase 02 research first)
- **RESEARCH FLAG:** Verify LLM-assisted constraint-to-English explanation is feasible

**v0.39-03: Cycle 2 Simulation**
- Model mutation engine
- Consequence model generation
- TLC simulation loop
- Convergence gate (3-condition AND)
- **Likely complexity:** VERY HIGH (needs Phase 03 research first)
- **RESEARCH FLAGS:**
  - Constraint DSL design (what's safe to mutate?)
  - Mutation semantics validation (prevent unsatisfiable specs?)
  - State space explosion handling (when does consequence model become intractable?)
  - Trace alignment (how to handle incomplete/coarse-grained bug traces?)

**v0.39-04: Integration & Hardening**
- Stop hook integration
- Neighbor regression verification (parallel 2-hop)
- Error handling & edge cases
- E2E integration tests
- **Likely complexity:** MEDIUM

## Critical Gaps Identified

1. **Constraint DSL Design (Phase 03 blocker):** Exact user-facing syntax for fix intent? How do we validate mutations without full SMT solver? What constraints are "safe" to mutate?

2. **Trace Normalization (Phase 01/02 blocker):** How do we map coarse-grained bug execution traces to precise formal traces? What's the canonical "bug trace" format?

3. **Neighbor Regression Scaling (Phase 04 blocker):** Can we parallelize 2-hop TLC verification without overwhelming resources? When do we skip the check?

4. **LLM-Assisted Explanation (Phase 02 blocker):** Can we reliably generate natural language from constraint diffs? What prompts work best with real TLA+ models?

## Key Differentiators vs. Industry

- **Trace-based diagnosis** (not just abstract refinement) — observes actual bug behavior
- **Multi-form fix intent** (language + constraint + sketch) — flexibility without losing model semantics
- **Inverted verification semantics** — bug validates model, fix validates against model before code commit
- **Structural enforcement** — Stop hook blocks code commit if convergence gate fails
- **Integrated neighbor checking** — reuses v0.38 proximity framework; prevents cross-component regressions

## Next Steps for Roadmap

1. **Read SUMMARY_v0.39_DUAL_CYCLE.md** for phase structure and research flags.
2. **Read FEATURES_v0.39_DUAL_CYCLE.md** for detailed feature breakdown and dependencies.
3. **Conduct Phase 02 research** (2-3 days): Validate constraint-to-English explanation feasibility; prototype diagnostic output on real TLA+ models.
4. **Conduct Phase 03 research** (3-5 days): Design constraint DSL; validate mutation semantics checker; prototype consequence model generation.
5. **Adjust roadmap** based on research findings; update phase scope if needed.

## Confidence Summary

| Area | Confidence | Notes |
|------|------------|-------|
| Overall Approach | MEDIUM | Novel synthesis; academically sound but unproven in practice |
| Cycle 1 Diagnostic | MEDIUM | Needs Phase 02 validation before commitment |
| Cycle 2 Simulation | MEDIUM | Needs Phase 03 validation before commitment |
| v0.38 Reuse | HIGH | All dependencies available; low-risk reuse |
| Stack & Tools | HIGH | TLA+/TLC are production-grade; minimal new infra |

---

Research conducted: 2026-03-18
Next phase: Roadmap creation with phase-specific research tasks
