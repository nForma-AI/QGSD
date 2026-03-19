# Research Summary: Dual-Cycle Formal Reasoning (v0.39)

**Milestone:** v0.39 — Dual-Cycle Formal Reasoning
**Domain:** Model-driven debugging with diagnostic and solution validation cycles
**Researched:** 2026-03-18
**Overall Confidence:** MEDIUM

## Executive Summary

Dual-cycle formal reasoning extends v0.38's model-driven debugging by adding two feedback loops:

1. **Cycle 1 (Diagnostic Reframing):** When a model fails to reproduce a known bug, generate a targeted diagnostic diff ("model assumes X but trace shows Y") instead of blind parameter retry. Reframes from "model is broken" to "model is incomplete" — the bug becomes ground truth that validates the model.

2. **Cycle 2 (Solution Simulation):** Accept fix ideas in multiple forms (natural language, constraint syntax, code sketches), normalize to model mutations, generate a consequence model, simulate the fix in formal space, verify three convergence gates, then write code. All iteration happens before code is touched, providing evidence-based confidence that the fix solves the problem without introducing new ones.

The research identifies critical features (diagnostic diffing, consequence modeling, automated convergence gates) vs. differentiators (targeted diagnostics, inverted verification, neighbor-aware convergence) vs. anti-patterns (unbounded iteration, code-as-intent, auto-fix-generation).

Key finding: **There is no "dual-cycle" terminology in formal verification literature.** This is a novel synthesis of CEGAR (Counterexample-Guided Abstraction Refinement), constraint mutation testing, invariant refinement, and model-based testing. Academic foundations are solid but the specific integration is nForma's innovation.

## Key Findings

### Stack Recommendation

**Language:** Continue TLA+ (primary, from v0.38) + Alloy (secondary, can add in v0.39.x)
**Execution:** TLC model checker (existing), extend with consequence model generation and trace playback
**Constraint Engine:** Build minimal DSL (avoid Turing-complete; stay decidable)
**Trace Normalization:** Canonical TLA+ trace format; normalize bug traces before comparison
**Why:** TLA+ ecosystem is mature; TLC is production-grade; extending existing infrastructure minimizes new build effort

### Critical Features (Table Stakes)

**Cycle 1:**
- Model diagnostic diffing: "model assumes X, bug shows Y" — HIGH complexity but essential
- Bug as ground truth: semantic reframe of "model is incomplete/wrong" — LOW complexity, HIGH impact
- Trace comparison infrastructure: canonical format, normalization heuristics — MEDIUM complexity

**Cycle 2:**
- Fix intent normalization (constraint form MVP): parse structured constraint syntax — MEDIUM complexity
- Model mutation engine: transform constraint changes to TLA+ mutations — HIGH complexity
- Consequence model generation: apply mutations, validate semantics, preserve original behavior — HIGH complexity
- Simulation loop: TLC on consequence model, trace playback validation — MEDIUM complexity
- Convergence gate (3-condition AND): invariants hold + bug resolved + no neighbor regressions — MEDIUM complexity
- Iteration limit & escape: configurable `--max-iterations` (default 3) — LOW complexity

### Differentiators

1. **Inverted Verification:** Model MUST FAIL on bug trace to confirm bug capture. Flips "passing tests = success" to "failing on ground truth = success."
2. **Targeted Diagnostics:** Surgical "model assumes X but trace shows Y" instead of blind retry loop.
3. **Fix Intent → Model Mutation Pipeline:** Unified normalization from NL/constraint/sketch to model mutations; users can't accidentally bypass formal validation.
4. **Consequence Modeling as Artifact:** The mutated model becomes auditable evidence: "here's why this fix works."
5. **Neighbor-Aware Convergence:** Reuses v0.38's proximity framework to detect cross-component regressions before declaring convergence.
6. **Structural Enforcement:** Stop hook blocks code commit until convergence gate passes; users can't bypass simulation.

### Anti-Features (Explicitly NOT Building)

1. **Auto-generate all fixes from counterexample:** Combinatorial explosion; loses user intent; requires triage. Instead: user-guided intent → system validates via simulation.
2. **Parallel iterations:** Race conditions, shared state conflicts, hard to explain which converged. Instead: sequential iteration with learning (cap at 3).
3. **Accept code as fix intent:** Defeats dual-cycle purpose; loses simulation guarantee. Instead: require intent in language/constraint form first.
4. **Skip neighbor regression check:** Silent regressions are real (v0.38 found them). Instead: keep all 3 gates; neighbor check is cached cost is low.
5. **Expose model mutations to user edit:** Breaks model coherence; leads to "works in model but nonsense" solutions. Instead: constraint DSL + mutation engine ensures coherence.

## Implications for Roadmap

Based on dependencies and complexity, suggested phase structure:

### Phase v0.39-01 (Discovery & Foundation)
**Goal:** Build infrastructure and reframe mental model
**Addresses:**
- Bug as ground truth semantic reframe (affects prompts, quorum dispatch, output labels)
- Trace comparison infrastructure (canonical TLA+ representation; normalization heuristics)
- Fix intent normalization (minimal constraint DSL syntax + parser)
- Iteration limit framework (parameter + state tracking)

**Why this order:** Foundational layers that other phases depend on. Semantic reframe must be established before Cycle 1 diagnostic makes sense.

**Likely complexity:** LOW-MEDIUM. Mostly plumbing and language changes.

### Phase v0.39-02 (Cycle 1: Diagnostic Reframing)
**Goal:** Implement "model assumes X but trace shows Y" diagnostics
**Addresses:**
- Counterexample diff extraction (parse TLA+ constraints, match to trace observations)
- Diagnostic output synthesis (LLM-assisted explanation from minimal diff set)
- Quorum prompt injection (diagnostic becomes part of Cycle 2 fix intent suggestions)

**Why this order:** Depends on Phase 01 trace comparison and semantic reframe. Cycle 1 diagnostic is self-contained; Cycle 2 can follow.

**Likely complexity:** HIGH. Requires TLA+ constraint parsing + LLM-assisted diff explanation.

### Phase v0.39-03 (Cycle 2: Solution Simulation Loop)
**Goal:** Implement consequence modeling and convergence gate
**Addresses:**
- Model mutation engine (constraint DSL → TLA+ mutations, semantic validation)
- Consequence model generation (apply mutations, validate soundness)
- TLC simulation loop (execute consequence model on original bug trace)
- Trace playback validation (verify fix prevents bug without new invariant violations)
- Convergence gate (3-condition AND: invariants + bug + neighbor)

**Why this order:** Depends on Phase 01 infrastructure. Phase 02 diagnostic informs fix intent in Cycle 2. This is the core innovation.

**Likely complexity:** VERY HIGH. Model mutation semantics, state space tuning, neighbor regression parallelization.

### Phase v0.39-04 (Integration & Hardening)
**Goal:** Wire gates to execution, add error handling, validate E2E
**Addresses:**
- Stop hook integration (enforce convergence gate before code commit)
- Neighbor regression verification (parallel 2-hop TLC execution, reuse v0.38 proximity framework)
- Error handling & edge cases (counterexample alignment failures, unsatisfiable mutations, timeout recovery)
- Integration tests (E2E Cycle 1 diagnostic → Cycle 2 simulation → convergence → code commit)

**Why this order:** Depends on all prior phases. Hardens the pipeline; wires gates to existing quorum + execute infrastructure.

**Likely complexity:** MEDIUM. Mostly integration; leverage existing v0.38 framework.

## Phase Ordering Rationale

**v0.39-01 → v0.39-02 → v0.39-03 → v0.39-04** is the only viable order:

1. **01 must precede 02 & 03:** Trace comparison and semantic reframe are prerequisites for both diagnostic and simulation.
2. **02 must precede 03:** Cycle 1 diagnostic informs Cycle 2 fix intent suggestions.
3. **03 must precede 04:** Can't integrate gates until core simulation loop works.

Parallelization opportunity: Phase 02 and 03 could partially overlap if diagnostic output (from Phase 02) isn't strictly required for Phase 03 MVP. However, research suggests they're tightly coupled; sequential is safer.

## Research Flags for Phases

**Phase v0.39-01:** Standard pattern, unlikely to need deeper research. Infrastructure is straightforward plumbing.

**Phase v0.39-02:** NEEDS DEEPER RESEARCH (2-3 day investigation)
- How do we extract minimal diagnostic diff from TLA+ constraint set? (Requires constraint parsing + relevance ranking)
- How do we synthesize English explanation from minimal diff? (Requires LLM-assisted trace interpretation)
- Edge case: what if multiple constraints conflict with the trace? Rank by impact?
- Precision vs. accuracy tradeoff: overly detailed diagnostics are unreadable; too vague are useless.

**Phase v0.39-03:** NEEDS DEEPER RESEARCH (3-5 day investigation)
- Constraint DSL design: what subset of TLA+ can users safely mutate? (Must stay decidable; avoid soundness issues)
- Mutation semantics validation: how do we prevent creating unsatisfiable or contradictory specs?
- State space explosion: when does consequence model become intractable? How do we bound TLC exploration?
- Trace replay against mutated model: how do we align bugs traces (often incomplete, different abstraction level) against formal traces?

**Phase v0.39-04:** Standard hardening, unlikely to need deeper research. Integration is mechanical.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Overall Approach | MEDIUM | No direct academic precedent for "dual-cycle"; synthesis is sound but novel. TLA+ mutation is established; trace diffing is new. |
| Cycle 1 Diagnostic | MEDIUM | CEGAR foundations are solid; counterexample analysis is standard. Adapting to trace-based diagnosis (not abstract refinement) is novel; needs Phase 02 research. |
| Cycle 2 Simulation | MEDIUM | Constraint mutation + consequence modeling are standard patterns. Integration into single pipeline is novel; needs Phase 03 research on DSL + mutation semantics. |
| Convergence Gate | MEDIUM-HIGH | 3-condition AND gate is straightforward logic. v0.38 already has invariant verification + neighbor framework; reuse is low-risk. |
| v0.38 Dependencies | HIGH | v0.38 shipped; bug-model lookup, TLC execution, proximity-neighbor registry, inverted semantics all available. Reuse is reliable. |
| Stack Choices | HIGH | TLA+ + TLC are production tools; ecosystem is mature. Minimal new infrastructure needed. |
| Differentiators | MEDIUM | "Targeted diagnostics" and "neighbor-aware convergence" are achievable but require careful implementation. Not established patterns; higher risk. |

## Gaps to Address

**Constraint DSL Design (Phase 03 blocker):**
- What's the exact syntax users will use to express fix intent? (TLA+ FIX blocks? Alloy constraint patches? Custom DSL?)
- How do we validate mutations without SMT solver integration? (Semantic checker only? Full SAT/SMT?)
- What constraints are "safe" to mutate? (Avoid soundness issues, unsatisfiable specs)

**Trace Normalization (Phase 01/02 blocker):**
- How do we map bug execution traces (often incomplete, coarse-grained) to formal TLA+ traces (precise, state-level)?
- What's the canonical "bug trace" format? (Timestamped events? State snapshots? Code line numbers + variable values?)
- How do we handle concurrent traces? (Linearized? Partial order representation?)

**Neighbor Regression Scaling (Phase 04 blocker):**
- v0.38 proximity-neighbor framework exists. Can we parallelize 2-hop TLC verification without overwhelming resources?
- When do we skip the neighbor check? (If neighbors unchanged? If time budget exceeded?)

**LLM-Assisted Explanation (Phase 02 blocker):**
- Can we reliably generate "model assumes X but trace shows Y" from a minimal constraint diff?
- What prompts work best for constraint-to-English explanation? (Need examples from real TLA+ models)

## Roadmap Recommendations

1. **Do conduct Phase 02 research before committing to Cycle 1 implementation.** The diagnostic-from-constraint-diff is novel; validate that it's feasible and produces usable explanations.

2. **Do conduct Phase 03 research before implementing model mutation engine.** Constraint DSL design and mutation semantics validation are blockers; settling on these early avoids rework.

3. **Consider phased MVP:** If Phase 03 research reveals mutation semantics is riskier than expected, consider v0.39 as "Cycle 1 diagnostic only" and defer Cycle 2 to v0.40. Diagnostic alone is valuable; solution simulation can follow.

4. **Leverage v0.38 infrastructure heavily.** Don't redesign bug-model lookup, TLC execution, or proximity-neighbor verification. Reuse and extend.

5. **Plan for Phase 02/03 research to inform feature scope.** Current roadmap assumes all P1 features ship in v0.39. If research reveals complexity, defer P2 features (natural language intent, Alloy mutation, auto-constraint-extraction) to v0.39.x/v0.40.

## Sources

- [Counterexample-guided abstraction refinement | ACM](https://dl.acm.org/doi/10.1145/876638.876643)
- [Diagnostics in Probabilistic Program Verification | POPL 2026](https://popl26.sigplan.org/details/dafny-2026-papers/3/Diagnostics-in-Probabilistic-Program-Verification)
- [Test Oracle Strategies for Model-Based Testing](https://www.researchgate.net/publication/305793864_Test_Oracle_Strategies_for_Model_Based_Testing)
- [Invariant-based Program Repair | FASE 2024](https://arxiv.org/html/2312.16652)
- [Automated Model Repair for Alloy | ASE 2018](https://kaiyuanw.github.io/papers/paper14-ase18.pdf)
- [Incremental Verification Using Trace Abstraction | SpringerLink](https://link.springer.com/chapter/10.1007/978-3-319-99725-4_22)

---

*Research summary for: Dual-cycle formal reasoning*
*Milestone: v0.39*
*Researched: 2026-03-18*
