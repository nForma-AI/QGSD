# Feature Research: Dual-Cycle Formal Reasoning (v0.39)

**Domain:** Model-driven debugging with diagnostic and solution validation cycles
**Researched:** 2026-03-18
**Confidence:** MEDIUM (formal verification literature is sparse on "dual-cycle" terminology; findings synthesized from CEGAR, invariant refinement, and model-based testing research)

## Executive Summary

Dual-cycle formal reasoning extends v0.38's model-driven debugging with two additional feedback loops:

- **Cycle 1 (Diagnostic):** When a model fails to reproduce a known bug, generate a targeted diagnostic diff ("model assumes X but bug shows Y") instead of blind retry. Reframes the problem from "model needs fixing" to "model is incomplete/wrong" — the bug is ground truth.

- **Cycle 2 (Solution Simulation):** Accept fix ideas (natural language, constraint syntax, or code sketches), normalize to model mutations, generate a consequence model, simulate the fix in model space, verify convergence gates, then commit code. All iteration happens before code is touched.

This research identifies what's table-stakes (diagnostic diffing, consequence modeling, automated convergence gates) vs. differentiators (targeted diagnostics instead of blind retry, inverted verification semantics, neighbor-aware convergence) vs. anti-features (unbounded iteration, direct code-as-intent, auto-generation of all fixes).

## Feature Landscape

### Table Stakes (Users Expect These)

Features essential for dual-cycle reasoning to function as designed. Missing these = product fails to validate diagnosis or solution.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Cycle 1: Model diagnostic diffing** | When model fails to reproduce known bug, users need to know what assumption the model made that conflicts with observed behavior — not just "retry with different params" | MEDIUM | Core insight: diff is "model assumes X, but trace shows Y" — compare model-projected behavior against actual bug trace, extract minimal difference set |
| **Cycle 1: Bug as ground truth** | Users reframe bug not as "model needs fixing" but as "model is incomplete/wrong" — bug validates, model explains | LOW | Semantic reframe; affects prompt language and gate interpretation, not architecture |
| **Cycle 2: Fix intent normalization** | Accept fix ideas in three forms (natural language, constraint syntax, code sketches) and normalize to unified internal representation for model mutation | MEDIUM | Natural language → constraint extraction (LLM-assisted). Constraint syntax → model transformation rules. Code sketches → abstracted change patterns |
| **Cycle 2: Consequence model generation** | Given fix mutations, generate a shadow model that simulates the fix's effects without touching production code | HIGH | Requires model mutation engine; infers what behavior changes follow from constraint changes; must preserve most original behavior to detect unintended consequences |
| **Cycle 2: Simulation loop with trace playback** | Apply consequence model to original bug trace(s), verify bug no longer triggers | MEDIUM | Reuse existing TLC/Alloy execution; inject mutated constraints into model checker; trace playback validates fix scope |
| **Convergence gate (automated)** | Three-condition AND gate: (all original invariants still hold) AND (bug no longer triggered) AND (no 2-hop neighbor regressions) | MEDIUM | Gate logic is straightforward; complexity is in neighbor regression detection (requires proximity-neighbor model lookup and parallel verification from v0.38) |
| **Iteration limit & escape** | Configurable max iterations (default 3, override `--max-iterations`); distinguish "converged" from "max attempts reached" in output | LOW | Parameter + output state tracking |

### Differentiators (Competitive Advantage)

Features that set nForma's dual-cycle apart from standard test-driven debugging or generic formal refinement.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Inverted verification semantics in Cycle 1** | Model MUST FAIL on bug trace to confirm bug capture (not "model passes tests") — flips traditional "passing tests = success" | LOW | Reuses v0.38's inverted gate logic; mental model shift only |
| **Targeted diagnostic instead of blind retry** | Instead of "try 20 parameter combinations," generate "model assumes deadlock-free, but trace shows circular wait on L1→L2→L3→L1" — surgical, explainable | HIGH | Requires counterexample diff extraction; minimal diagnostic candidate ranking (which differences matter); LLM-assisted explanation synthesis |
| **Fix intent → model mutation pipeline** | Not "write code then verify" but "sketch fix intent, simulate in model space, verify invariants + bug elimination before any code commit" | HIGH | Integrates natural language understanding, constraint mutation, and formal simulation in unified pipeline |
| **Consequence modeling as primary artifact** | The consequence model becomes queryable evidence: "here's why this fix solves the bug and preserves property X" — auditable fix rationale | MEDIUM | Model becomes living documentation; trace playback shows execution path through fix mutation |
| **Neighbor-aware convergence** | Blocks false convergence: fix solves original bug but breaks a 2-hop related model (e.g., timeout handling in sibling component) | MEDIUM | Reuses v0.38 proximity-neighbor framework; adds verification cost but prevents silent regressions |
| **No code commit without model convergence** | Code fix only written after model simulation passes all gates — structural enforcement, not "run tests and hope" | LOW | Workflow gate; leverages existing quorum + execute hooks |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Auto-generate all possible fixes from counterexample** | Seems efficient — extract bug trace, enumerate all fixes that satisfy trace | Combinatorial explosion; most candidates are nonsensical; requires triage. Loses user intent; model space becomes too large to simulate efficiently | Accept user-guided fix intent (natural language, constraint sketch, or code outline) — user provides direction, system validates via simulation |
| **Run all iterations in parallel** | Seems fast — spawn 3 consequence models simultaneously | Race conditions in model mutations; shared state conflicts if mutations alter same constraints; difficult to explain which iteration converged. Iteration N depends on learning from N-1 | Sequential iteration with learning; each consequence model informed by previous invariant violations; cap at N=3 default |
| **Accept any code change as "fix intent"** | More flexible than constraints | Code skips the model space entirely; defeats dual-cycle purpose; loses the "simulate before committing" guarantee | Require fix intent in language or constraint form first; optionally accept code as reference, but extract intent, validate intent in model space, THEN commit code |
| **Lower convergence gates to 2/3 conditions** | Speeds up shipping (skip neighbor check) | Silent regressions in related models; v0.38 discovered these are real (cross-model regression prevention is active gate) | Keep all 3 gates; neighbor check is already cached from v0.38; cost is low |
| **Expose model mutations to user edit** | User agency — let them directly tweak TLA+ | Breaks model coherence; user edits violate intended constraint semantics; leads to "works in model but nonsense" solutions | Constraint DSL + model mutation engine handles translation; user edits constraints, system ensures model stays coherent |

## MVP Definition

### Launch With (v0.39)

Minimum viable product — what's needed to make "model diagnostic" and "fix simulation" both functional.

- **Bug as Ground Truth reframing** — Workflow language change; affects `/nf:debug` Cycle 1 output and quorum prompts. Essential because without this mental model shift, Cycle 1 feels like "retry harder," not "diagnose model gap."

- **Trace Comparison for diagnostic diff** — Given bug trace and model-projected trace, compute minimal difference set: "model assumes X but trace shows Y." Essential because this IS the insight users need; without it, Cycle 1 has no diagnostic output.

- **Fix Intent Normalization (constraint form)** — Accept constraint syntax (TLA+ FIX blocks or Alloy constraint patches) and normalize to mutation rules. Defer natural language + sketch parsing to v0.39.x (lower priority if time-constrained). Essential because Cycle 2 needs a way to accept structured fix intent.

- **Model Mutation Engine (TLA+)** — Apply constraint mutations to TLA+ models; generate consequence models. Start with TLA+ (existing in v0.38); Alloy can follow in v0.39.x. Essential because without mutation, there's no Cycle 2.

- **Consequence Model Simulation** — TLC execution on mutated model; trace playback of original bug trace against consequence model. Essential because simulation validates that fix intent actually eliminates the bug.

- **Convergence Gate (3-condition AND)** — Invariants hold + bug resolved + neighbor check (can reuse v0.38 proximity framework). Essential because gate is the enforcement point; without it, simulation is advisory, not binding.

- **Iteration Limit & Escape** — Default 3 iterations; `--max-iterations` override. Output distinguishes "converged" from "max attempts." Essential because unbounded iteration is unsafe; users need a safety exit.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- **Parallel Iteration Experiments** — Run 3 consequence models in parallel, report which converges first. Defer; sequential iteration is clearer for v0.39.

- **Genetic Algorithm for Fix Candidate Enumeration** — If user fix intent is vague, enumerate constraint mutations and rank by convergence probability. Defer to v2.

- **Cross-Model Equivalence Checking** — After convergence, prove that consequence model + fix code is equivalent to original model + fix. Defer to research phase.

## Domain Patterns (from literature)

**CEGAR (Counterexample-Guided Abstraction Refinement):** Iteratively refine model by analyzing counterexamples. Cycle 1 diagnostic diff uses counterexample analysis but inverts focus: diagnose model gap rather than refine abstract model.

**Constraint Mutation Testing:** Modify constraints in formal specs; check if mutation allows erroneous behavior. Cycle 2 fix intent → constraint mutations; mutations that converge are meaningful.

**Iterative Refinement with Escape:** Repeat refinement cycles; cap iterations via convergence gate or statistical test. Cycle 2 uses 3-condition AND gate with configurable `--max-iterations` escape hatch.

**Invariant Preservation:** Ensure refinements don't violate original safety properties. Convergence gate checks "all original invariants hold."

**Property-Directed Search:** Guide refinement toward properties that matter. Fix intent directs mutation search; gate prioritizes bug elimination as primary property.

## Risk Factors

**High-Complexity:**
- Constraint mutation semantics (unsatisfiable specs, lost intent)
- Trace comparison for diagnosis (alignment issues, abstraction mismatch)
- Consequence model generation (state space explosion, tuning TLC parameters)
- Neighbor regression detection (expense, proximity graph completeness)

**Medium-Complexity:**
- Fix intent normalization (ambiguous syntax, parsing errors)
- Convergence gate implementation (straightforward logic, enforcement tricky)

**Low-Complexity:**
- Bug as ground truth (semantic reframe, no architecture change)
- Iteration limit & escape (parameter + state tracking)

## Implementation Sequencing

**v0.39-01:** Trace comparison, bug as ground truth, fix intent normalization, iteration limit
**v0.39-02:** Counterexample diff extraction, diagnostic output, quorum injection
**v0.39-03:** Model mutation engine, consequence generation, TLC loop, convergence gate
**v0.39-04:** Stop hook integration, neighbor regression, error handling, integration tests

## Sources

- [Counterexample-guided abstraction refinement | ACM](https://dl.acm.org/doi/10.1145/876638.876643)
- [Diagnostics in Probabilistic Program Verification | POPL 2026](https://popl26.sigplan.org/details/dafny-2026-papers/3/Diagnostics-in-Probabilistic-Program-Verification)
- [Test Oracle Strategies for Model-Based Testing](https://www.researchgate.net/publication/305793864_Test_Oracle_Strategies_for_Model_Based_Testing)
- [Mutation-Driven Generation of Unit Tests and Oracles | IEEE](https://ieeexplore.ieee.org/iel5/32/6173074/06019060.pdf)
- [Automated Model Repair for Alloy | ASE 2018](https://kaiyuanw.github.io/papers/paper14-ase18.pdf)
- [Invariant-based Program Repair | FASE 2024](https://arxiv.org/html/2312.16652)
- [Incremental Verification Using Trace Abstraction | SpringerLink](https://link.springer.com/chapter/10.1007/978-3-319-99725-4_22)
- [Generating Test Cases for Specification Mining | ISSTA 2010](https://dl.acm.org/doi/10.1145/1831708.1831719)
- [Specification Mutation for Test Generation and Analysis | NIST](https://csrc.nist.gov/CSRC/media/Presentations/Specification-Mutation-for-Test-Generation-and-Ana/images-media/thesis_vadim.pdf)

---

*Feature research for: Dual-cycle formal reasoning (model diagnostic + solution simulation)*
*Researched: 2026-03-18*
*Context: v0.39 milestone; builds on v0.38 model-driven debugging*
