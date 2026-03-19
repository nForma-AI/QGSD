# Project Research Summary

**Project:** nForma v0.39 — Dual-Cycle Formal Reasoning
**Domain:** Model-driven software debugging with diagnostic and solution validation
**Researched:** 2026-03-18
**Confidence:** HIGH (architecture), MEDIUM (implementation details)

## Executive Summary

nForma v0.39 extends the existing model-driven-fix architecture (v0.38) with two complementary feedback loops that transform models from one-way validators into bidirectional reasoning tools. **Cycle 1 (Diagnostic)** reframes failed model reproduction as an opportunity to diagnose model gaps rather than retry blindly — when a model can't reproduce a known bug, the system generates targeted diffs ("model assumes timeout=5s but bug shows 10s") that guide refinement. **Cycle 2 (Solution Simulation)** accepts fix ideas in natural language, constraints, or code sketches, normalizes them to model mutations, generates consequence models, simulates the fix in formal space before touching code, and verifies three convergence gates (original invariants preserved + bug resolved + no neighbor regressions).

The architecture is purely additive — no changes to existing v0.38 modules, only 7 new isolated modules inserted at natural integration points. Both cycles run within the existing 6-phase orchestrator as enhanced intelligence layers. The research validates that this is achievable with existing infrastructure (TLA+, Alloy, PRISM checkers), no new runtime dependencies, and a build order of 4 phases totaling 11-16 days of development.

**Key finding:** The dual-cycle approach is novel in formal verification literature — no existing "dual-cycle" pattern — but the foundation is solid, synthesizing established techniques (CEGAR, constraint mutation testing, invariant refinement) in a new integration specific to model-driven debugging.

---

## Key Findings

### Recommended Stack

No new runtime dependencies required. All new modules orchestrate existing TLA+/Alloy/PRISM checkers via Node.js subprocess management.

**Core technologies (reused from v0.38):**
- **TLA+ (TLC model checker)** — Primary formalism; existing integration in `run-tlc.cjs`; supports `-dumpTrace json` for ITF (Informal Trace Format) output
- **Alloy (SAT solver)** — Secondary formalism; existing integration in `run-alloy.cjs`; XML counterexample output
- **PRISM (probabilistic checker)** — Optional; lightweight support for probabilistic models

**New libraries (minimal):**
- **json-diff-ts** (v1.2.0) — State sequence comparison for Cycle 1 diagnostic diffs; only new npm dependency

**Why this stack:** TLC/Alloy are production-grade formal verification tools; TLA+ ecosystem is mature; extending existing infrastructure minimizes new build surface. No need for custom TLA+ parsers (regex-based operator extraction proven safe in existing `model-constrained-fix.cjs`). ITF trace format is language-neutral JSON; native Node.js parsing sufficient.

### Expected Features

#### Table Stakes (Users Expect These)

**Cycle 1:**
- **Model diagnostic diffing** — When model fails to reproduce bug, generate "model assumes X but trace shows Y" comparison; essential for shifting mental model from "model is broken" to "model is incomplete"
- **Bug as ground truth** — Reframe inverted verification semantics: model fails = success (captures bug), model passes = failure (incomplete)
- **Trace comparison infrastructure** — Canonical TLA+ representation; field-level divergence detection via json-diff-ts

**Cycle 2:**
- **Fix intent normalization** — Accept constraint syntax (TLA+ FIX blocks, Alloy patches) and normalize to mutation rules; core for unifying user input
- **Model mutation engine** — Apply constraint mutations to TLA+ specs (Alloy in v0.39.x); text-based operator rewriting proven safe via regex patterns
- **Consequence model generation** — Create shadow models simulating fix effects without modifying production code; essential for "simulate before committing"
- **Convergence gate (3-condition AND)** — Verify (all original invariants hold) AND (bug no longer triggered) AND (no 2-hop neighbor regressions); enforcement point that blocks code commit
- **Iteration limit & escape** — Default 3 iterations; `--max-iterations` override; distinguish "converged" from "max attempts reached"

#### Differentiators (Competitive Advantage)

1. **Inverted verification semantics** — Model MUST FAIL on bug trace (not "pass tests"); flips traditional success model
2. **Targeted diagnostic instead of blind retry** — Surgical diffs ("model assumes deadlock-free, but trace shows L1→L2→L3→L1 cycle") vs. 20-parameter combos
3. **Fix intent → model mutation pipeline** — Unified path from natural language/constraints/code sketches to formal simulation; users can't bypass validation
4. **Consequence modeling as auditable artifact** — Mutated model becomes living evidence: "here's exactly why this fix works and what invariants it preserves"
5. **Neighbor-aware convergence** — Reuses v0.38's proximity-neighbor framework; catches cross-component regressions automatically
6. **Structural enforcement** — Stop hook blocks code commit until convergence gate passes; compliance is forced, not advisory

#### Anti-Features (Explicitly NOT Building)

- **Auto-generate all fixes from counterexample** — Combinatorial explosion; loses user intent; requires triage. Instead: user-guided intent → system validates
- **Parallel iterations** — Race conditions in shared state; hard to explain which converged. Instead: sequential with learning (cap at 3)
- **Direct code-as-intent** — Bypasses formal validation. Instead: extract intent in language/constraint form first
- **Unbounded iteration** — Unsafe; prevents convergence detection. Instead: configurable limit (default 3) with escape hatch
- **User-editable model mutations** — Breaks model coherence. Instead: constraint DSL + mutation engine ensures coherence

### Architecture Approach

The architecture inserts two new capability layers into the existing 6-phase model-driven-fix workflow without modifying existing phases:

**Cycle 1 (Diagnostic)** integrates into **Phase 2 (Reproduction)** as optional post-check: If existing models fail to reproduce bug, call `cycle1-diagnostic-diff.cjs` to generate targeted feedback before Phase 3 refinement. Diagnostic is advisory, not enforcing.

**Cycle 2 (Solution Simulation)** inserts as new **Phase 4.5** between Constraint Extraction (Phase 4) and Constrained Fix (Phase 5): User proposes fix → normalize fix idea → generate consequence model → run three convergence gates → report verdict (PASS/ITERATE/BLOCKED). Gates are automated, requiring no user interaction.

**Component boundaries:**

| Layer | Components | Integration |
|-------|-----------|---|
| **Cycle 1: Diagnostics** | parse-tlc-counterexample.cjs, diagnostic-diff-generator.cjs | Reuse: refinement-loop.cjs (inverted semantics), run-tlc/alloy (trace output) |
| **Cycle 2: Mutation & Validation** | normalize-fix-idea.cjs, generate-consequence-model.cjs, convergence-gate.cjs | Reuse: run-formal-verify.cjs (master runner), resolve-proximity-neighbors.cjs (2-hop BFS), model-constrained-fix.cjs (operator extraction patterns) |
| **Orchestration** | model-driven-fix.md (Phase 2/4.5 enhancements) | No changes to Phase 1, 3, 5, 6 logic |

**Data flow:** TLC/Alloy output (trace JSON) → parse-counterexample → diagnostic-diff → quorum context injection. Quorum proposal → normalize-fix-idea → generate-consequence-model → convergence-gate → verdict.

### Critical Pitfalls

1. **Consequence models trap diagnosis in narrow solution space** — Generating consequence models for only ONE fix idea may miss better solutions or create false confidence. Mitigation: Generate models for 2-3 alternatives; add mutual exclusivity check before committing. Phase 2 work: Define multi-candidate tool contract.

2. **Convergence oscillation between incompatible invariants** — Fix A satisfies invariant-1 but violates invariant-2; Fix B the reverse; system loops forever. Mitigation: Pre-flight invariant compatibility check (mutual satisfiability test); establish priority ordering (safety > liveness > performance); detect A-B-A-B oscillation pattern. Phase 1 work: Compatibility pre-check required before Cycle 2 starts.

3. **Uncontrolled model registry pollution** — Consequence models accumulate without lifecycle management, causing registry bloat and false positives in bug-to-model lookup. Mitigation: Store consequence models in session-scoped temp directories (NOT main registry); add 7-day TTL metadata; archive on fix commit; exclude from semantic lookup. Phase 1 work: Establish separate consequence model storage.

4. **Intent-to-mutation translation fidelity breaks silently** — Natural language "add mutex lock" translates to model mutation that adds lock flag but never releases it (vacuous success). Fix commits, code deadlocks in production. Mitigation: Require explicit mutation pseudo-code; reverse-translate mutations back to English; detect vacuous success (mutation must execute in >50% of trace); run adversarial negative model. Phase 2/3 work: Add validation gates.

5. **Integration with existing inverted semantics breaks** — Refinement-loop uses inverted verification (violation = success capturing bug); Cycle 2 uses normal semantics (violation = failure). Contradictory gates. Mitigation: Add `verification_mode` tag to all model runs; auto-detect consequence model mode; gate logic checks mode before interpreting outcome. Phase 1 work: Explicit mode tagging in all model runner contracts.

6. **Regression prevention scope creep** — Consequence models introduce wider dependencies; 2-hop proximity neighbors may miss regressions 3+ hops away OR scope expands unbounded causing 100x slowdown. Mitigation: Analyze consequence model mutations for transitively-impacted variables/invariants; dynamically expand neighbor set; enforce performance budget (regression check <5s). Phase 2/3 work: Intelligent neighbor selection.

---

## Implications for Roadmap

Based on research, the recommended phase structure is 4 phases aligned with delivery value:

### Phase v0.39-01: Foundation & Semantic Reframing (2-3 days)

**Deliverable:** Establish semantic reframe ("bug is ground truth, model is hypothesis") and foundational infrastructure.

**Addresses:**
- Bug as ground truth semantic reframe — affects prompts, output labels, convergence gate interpretation
- Trace comparison infrastructure — canonical TLA+ representation, normalization heuristics for alignment
- Fix intent normalization framework — constraint DSL syntax + minimal parser
- Iteration limit & escape — parameter tracking, configurable default (3)
- Verification mode tagging — explicit `mode: "inverted" | "normal"` on all model runs

**Modules:** Updated prompts/labels, trace comparison utilities, fix intent parser skeleton, verification_mode contract updates

**Why first:** Semantic reframe must precede diagnostic output; mode tagging must be in place before consequence models are created; foundation layers enable both Cycle 1 and Cycle 2.

**Risk:** LOW — mostly semantic/plumbing changes; no complex logic yet

**Uses:** Existing model-driven-fix.md orchestrator (no changes), quorum dispatch (new context injection)

### Phase v0.39-02: Cycle 1 Diagnostic Reframing (2-3 days)

**Deliverable:** When Phase 2 reproduction fails, user sees targeted diagnostic ("model assumes timeout=5s but bug shows 10s") instead of blind retry.

**Addresses:**
- Counterexample trace parsing — extract ITF JSON traces from TLC `-dumpTrace json` output
- Diagnostic diff generation — field-level divergence detection using json-diff-ts
- Quorum prompt injection — diagnostic context fed to fix proposal generation
- Phase 2 enhancement — add diagnostic call after "not reproduced" branch

**Modules:** parse-tlc-counterexample.cjs, diagnostic-diff-generator.cjs, model-driven-fix.md Phase 2 update

**Tests:** 10 integration tests (TLA+/Alloy/PRISM trace parsing, diff generation, prompt injection)

**Why second:** Depends on Phase 1 semantic reframe and trace comparison infrastructure. Diagnostic is self-contained; doesn't block Cycle 2. Provides value independently.

**Risk:** MEDIUM — counterexample parsing is straightforward JSON work, but diff quality depends on getting field-level divergence right. Needs Phase 2 research on formalism-specific trace format differences.

**Uses:** ITF format (official standard), json-diff-ts (npm), existing refinement-loop semantics (no changes)

**Avoids pitfall:** Consequence models trapping in narrow space — Cycle 1 diagnostic informs Cycle 2 fix intent suggestions, broadening solution exploration

### Phase v0.39-03: Cycle 2 Solution Simulation (5-7 days)

**Deliverable:** Phase 4.5 fully functional; users can propose fix ideas, system simulates in model space, 3 convergence gates auto-verify, verdict gates code commit.

**Addresses:**
- Model mutation engine — text-based operator rewriting (regex-safe from model-constrained-fix precedent)
- Consequence model generation — apply mutations, preserve original invariants, validate syntax
- TLC/Alloy execution on consequence models — reuse existing run-tlc/run-alloy runners
- Convergence gates — invariant verification + inverted bug check + neighbor regression
- Cycle 2 iteration loop — max 3 iterations, learning from gate failures
- Stop hook integration — enforce convergence before code commit

**Modules:** normalize-fix-idea.cjs, generate-consequence-model.cjs, convergence-gate.cjs, model-driven-fix.md Phase 4.5 insertion, consequence model lifecycle tracking

**Tests:** 45 integration tests (12 normalize, 10 generate, 15 convergence, 8 E2E full cycles)

**Why third:** Depends on Phase 1 mode tagging and Phase 2 diagnostic context. Cycle 2 is most complex; appropriate for execution after foundation is solid.

**Risk:** MEDIUM-HIGH — mutation engine semantics, state space explosion detection, and gate condition capture per formalism (TLA+/Alloy differ) need careful implementation. Consequence model testing against buggy code paths is novel. Needs Phase 3 research on constraint DSL design and mutation semantics validation.

**Uses:** Operator extraction patterns from model-constrained-fix.cjs, inverted verification from refinement-loop.cjs, 2-hop proximity from resolve-proximity-neighbors.cjs, master runner from run-formal-verify.cjs

**Avoids pitfalls:** Oscillation detection adapted from solve-cycle-detector.cjs; mode semantics enforced via Phase 1 tagging; registry pollution prevented via session-scoped storage; vacuous success detection post-TLC; neighbor scope expansion via dependency analysis

### Phase v0.39-04: Integration & Hardening (2-3 days)

**Deliverable:** Full end-to-end dual-cycle workflow hardened; error handling, edge cases, final integration tests.

**Addresses:**
- Error handling — counterexample alignment failures, unsatisfiable mutations, timeout recovery
- Neighbor regression verification — parallel 2-hop execution, reuse v0.38 proximity framework
- Integration tests — full E2E from bug description through Cycle 1 diagnostic through Cycle 2 simulation to code commit
- Edge cases — empty traces, vacuously true fixes, invariant conflicts
- Outcome tracking — log which fixes converged, enable historical validation

**Modules:** Error handlers, integration test suite, outcome tracking persistence, documentation

**Tests:** 20 integration + E2E tests, manual validation with real TLA+ models

**Why fourth:** Depends on all prior phases working. Integration is mechanical; leverage existing v0.38 framework (no redesign needed).

**Risk:** LOW — mostly integration and testing; core logic already proven in Phases 1-3

**Uses:** All Phase 1-3 modules, existing quorum + execute hooks

---

### Phase Ordering Rationale

1. **Phase 1 → all others:** Semantic reframe and verification mode tagging are prerequisites. Both Cycle 1 and Cycle 2 depend on these foundational layers.

2. **Phase 2 → Phase 3:** Cycle 1 diagnostic informs Cycle 2 fix intent suggestions. Diagnostic output becomes context for quorum workers proposing fixes. Sequential improves quality.

3. **Phase 3 → Phase 4:** Can't integrate gates until consequence simulation works. Phase 4 is hardening on top of working core.

**Parallelization opportunity:** Phases 2 and 3 could partially overlap if Cycle 1 diagnostic is not strictly required for Cycle 2 MVP. However, research suggests coupling is tight; sequential is safer and cleaner.

**Alternative (if timeline pressured):** Deliver Phases 1 + 2 only as v0.39, deferring Phase 3 (Cycle 2) to v0.40. Diagnostic alone is valuable; users get early model feedback without waiting for full solution simulation.

### Research Flags for Phases

**Phase v0.39-01:** Standard pattern, unlikely to need `/qgsd:research-phase`. Foundation work is straightforward plumbing.

**Phase v0.39-02:** SHOULD RUN `/qgsd:research-phase` before committing to implementation.
- **Gap:** How to extract minimal diagnostic diff from counterexample trace? (Requires constraint relevance ranking)
- **Gap:** How to synthesize English explanation from diff? (Requires LLM-assisted interpretation)
- **Gap:** Precision vs. readability tradeoff — overly detailed diagnostics are unreadable; too vague are useless
- **Gap:** Formalism-specific trace format handling (TLA+ ITF vs Alloy XML vs PRISM output differ)

**Phase v0.39-03:** SHOULD RUN `/qgsd:research-phase` before committing to implementation.
- **Gap:** Constraint DSL design — what subset of TLA+ is safe for users to mutate? (Must stay decidable)
- **Gap:** Mutation semantics validation — how to prevent unsatisfiable or contradictory specs?
- **Gap:** State space explosion — when does consequence model become intractable? Pre-flight estimation heuristics?
- **Gap:** Bug trace alignment — how to map coarse-grained production traces to precise formal traces?
- **Gap:** Gate condition detection per formalism (TLA+ invariant violation looks different from Alloy SAT failure)

**Phase v0.39-04:** Standard hardening, unlikely to need deeper research. Integration is mechanical.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | No new dependencies; reuses TLA+/Alloy/PRISM checkers; ITF format is standard; json-diff-ts is established library |
| **Architecture** | HIGH | Phase integration points clear; module boundaries well-defined; reuses 5 existing v0.38 modules (no changes); additive only |
| **Build order** | HIGH | Dependencies respected; Phases 1→2→3→4 is only viable order; Phase 1 prerequisite for both cycles |
| **Cycle 1 diagnostic** | MEDIUM | Counterexample parsing is straightforward; diff generation established pattern; but diagnostic quality depends on formalism-specific implementation (TLA+ constraints differ from Alloy) — Phase 2 research needed |
| **Cycle 2 mutation** | MEDIUM | Text-based mutation proven safe via model-constrained-fix precedent; but consequence model generation and gate condition detection need formalism-specific validation — Phase 3 research needed |
| **Convergence gates** | MEDIUM-HIGH | 3-condition AND logic is straightforward; invariant + neighbor framework reused from v0.38; but detecting "bug still triggered" varies by formalism — needs Phase 3 specification |
| **Integration risk** | MEDIUM | Inverted semantics integration is a real pitfall; mitigated by Phase 1 mode tagging contract; but testing must validate no contradictions |
| **Overall** | MEDIUM | Novel synthesis of established techniques; architecture is sound; implementation details (formalism-specific logic) need Phase 2/3 research before committing |

---

## Gaps to Address

1. **Formalism-specific gate condition capture (Phase 3 blocker)**
   - Gap: How does "bug condition still triggered" work in TLA+ vs Alloy vs PRISM?
   - Impact: Convergence gate reliability depends on correct formalism-specific implementation
   - How to handle: Phase 3 research must specify gate detection per formalism; include unit tests for each

2. **Consequence model state space estimation (Phase 3 blocker)**
   - Gap: What pre-flight heuristics estimate mutation impact (e.g., variable bound change → 2x state space)?
   - Impact: Without estimation, consequence models may timeout; users hit iteration limit due to time, not convergence failure
   - How to handle: Phase 3 research must build heuristic table (mutation type → state space factor); add pre-flight estimation, warn user if model too large

3. **Bug trace alignment (Phase 2/3 blocker)**
   - Gap: How to map production bug traces (coarse-grained, incomplete) to formal TLA+ traces (precise, state-level)?
   - Impact: Diagnostic diff quality depends on alignment; trace mismatch causes false negatives
   - How to handle: Phase 2/3 research must define canonical bug trace format and alignment strategy

4. **Constraint DSL syntax (Phase 3 blocker)**
   - Gap: What syntax will users use to express fix intent? (TLA+ FIX blocks? Custom DSL? Plain English?)
   - Impact: Normalization fidelity depends on DSL clarity; ambiguous syntax leads to wrong mutations
   - How to handle: Phase 3 research must prototype 2-3 DSL options with real users; select simplest that captures intent

5. **Invariant compatibility pre-flight (Phase 1 decision)**
   - Gap: Should Phase 1 run mutual satisfiability test on all invariants before Cycle 2 starts?
   - Impact: Without pre-check, oscillation between incompatible invariants is possible; wastes iterations
   - How to handle: Phase 1 research should validate that mutual satisfiability test is feasible and cost-effective; if <1s per bug, include it; if >5s, defer to Phase 3

6. **Neighbor regression scope (Phase 3 decision)**
   - Gap: Is 2-hop proximity sufficient for consequence models, or do mutations introduce wider dependencies?
   - Impact: Too narrow scope misses regressions; too wide scope causes timeout
   - How to handle: Phase 3 must add consequence model dependency analysis (which variables/invariants touched?); dynamically expand neighbor set; enforce performance budget

---

## Sources

### Primary (HIGH confidence)

- **Stack research:** Official TLA+ Tools documentation, Apalache ITF spec, json-diff-ts npm package
- **Architecture research:** nForma v0.38 codebase (model-driven-fix.md, refinement-loop.cjs, resolve-proximity-neighbors.cjs); verified existing integration points
- **Features research:** CEGAR literature (ACM), Constraint Mutation Testing papers (IEEE), Invariant Refinement research (FASE 2024, ASE 2018)
- **Pitfalls research:** nForma codebase pattern analysis (solve-cycle-detector.cjs oscillation detection, model-registry.json scale, inverted semantics precedent)

### Secondary (MEDIUM confidence)

- Model-based testing literature (test oracle strategies, mutation-driven testing)
- Alloy SAT-based specification repair papers
- Trace abstraction incremental verification

### Tertiary (LOW confidence, needs validation)

- Hypothetical edge cases (vacuous success detection, mutual exclusivity checks) — patterns inferred from codebase but not yet implemented

---

*Research completed: 2026-03-18*
*Ready for roadmap: yes*
*Next: Confirm Phase 2 + Phase 3 research scope before committing implementation dates*
