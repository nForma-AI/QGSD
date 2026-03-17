# Feature Research: Model-Driven Debugging

**Domain:** CLI tool for formal verification-guided debugging and model refinement
**Researched:** 2026-03-17
**Confidence:** HIGH (research grounded in active ecosystem: APALACHE, TLC, FLACK, specification mining, constraint-based repair)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = debugging workflow feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Bug-to-Model Lookup** | Debuggers should automatically find formal models related to failing code. Without this, user must manually search model-registry. | MEDIUM | Extend `formal-scope-scan.cjs` proximity index to map failing code paths → matching models. Pre-filter models by source file and scope depth. |
| **Model Execution on Bug Trace** | If a model exists for a component, it should reproduce the bug deterministically. No reproduction = model is incomplete. | HIGH | Extend TLA+/Alloy runners to accept execution traces as input constraints; run model checker in "counterexample validation" mode against failed trace. Requires trace capture from bug reproduction. |
| **Trace-to-Counterexample Conversion** | Bug traces and formal model counterexamples should speak the same language. Without conversion, diagnosis is manual. | MEDIUM | Parse failing execution trace (timestamped events/state changes) and map to TLA+ variable assignments; export in format compatible with TLC/APALACHE/Alloy. |
| **Root Cause Extraction from Counterexample** | Model checker produces a trace; user should see "root cause is that X violated invariant Y" automatically. | MEDIUM | Parse counterexample trace, identify state transition where invariant first fails, extract variables involved, map to source code identifiers via model annotations. |
| **Plain-English Constraint Summary** | Fix should be guarded by clear constraints extracted from invariants. User shouldn't read TLA+ to understand "don't do X". | MEDIUM | Parse invariant predicates (TLA+ INVARIANT definitions, Alloy facts), translate quantifiers/operators to English, surface as "Fix constraint: do not Y while X". Alloy FLACK tool does this partially. |
| **Pre-Verification of Fix Against Model** | Before shipping, fix should be symbolically verified against the formal model that explained the bug. | HIGH | Instrument fix (code patch or modification) as TLA+ action or Alloy predicate; run APALACHE symbolic solver or Alloy analyzer to confirm invariant still holds with patch applied. Requires model parameterization. |

### Differentiators (Competitive Advantage)

Features that set nForma apart. Not required by ecosystem, but define leadership.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Model Refinement from Bugs** | When a bug occurs but no model explains it, automatically generate/refine a model that captures the failure mode. First product to close the "model is incomplete" loop. | HIGH | Synthesize new TLA+ INVARIANT or Alloy constraint from failing trace; use specification mining (sparse coding from [Seshia et al.](https://people.eecs.berkeley.edu/~sseshia/pubdir/rv12-sc.pdf)) to extract temporal patterns; validate via counter-test (re-run bug scenario, confirm new invariant fails). Auto-commit refined model to model-registry. |
| **Counterexample-Guided Diagnosis** | Model checker produces a trace; nForma explains which assumptions were violated and why. Guidance surfaces the _root cause_, not just "invariant failed". | HIGH | Implement CEGAR loop: extract spurious counterexample from model, compare against actual bug trace, identify which model assumptions don't hold in reality, suggest model parameters or assumptions to adjust. Surface 3-5 candidate root causes ranked by likelihood. |
| **Cross-Model Regression Prevention** | Fix verified against one model? Automatically check it doesn't break neighboring models in the formal scope. | MEDIUM | Run fix verification in parallel against all models with shared source files or requirements (from model-registry proximity edges). Report any new counterexamples. Prevents side-effect bugs. |
| **B→F Solve Layer (20th Layer)** | New solve layer explicitly tracks bugs that formal models _should_ catch but don't. Drives model refinement roadmap. | MEDIUM | Create new layer in 19-layer solve engine: scan all open bugs, for each bug check if any formal model counterexample matches the bug signature. If no match, flag as "model gap" and queue for Phase 1 (model refinement). Feed into hypothesis-driven solve wave ordering. |
| **Fix Constraint Solver** | Given model invariants, automatically synthesize the minimal set of constraints that a fix must satisfy (not write the fix, but constrain the solution space). | HIGH | Use constraint generation (from symbolic execution literature) + syntax-guided synthesis: parse invariants as SMT constraints, identify variables modified by buggy code, solve for values that satisfy invariants, surface as "fix must set X ∈ [min, max] and maintain Y ≥ Z". |
| **Invariant-Driven Solve Prioritization** | Solve layer prioritizes remediation based on invariants violated in recent bugs, not arbitrary heuristics. | MEDIUM | Parse invariants from models that matched recent bugs; rank solve layers by "likelihood of violating high-impact invariants" from PRISM sensitivity analysis. Inject into hypothesis-driven wave ordering. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Automatic Patch Generation from Formal Models** | "Models explain bugs, so they should generate fixes" sounds natural. | Models encode constraints, not intent. Synthesized patches often satisfy invariants but introduce new logic errors. Weak specifications (test suites) lead to overfitting. [Constraint-based repair literature](https://clairelegoues.com/assets/papers/esecfse17s3.pdf) shows this requires strong specifications (rare in practice). | Instead: **Constraint-to-Implementation Guidance** — extract constraints, present to developer as "fix must satisfy X" and let developer write code. Add fix-validation layer that re-verifies against model after human writes patch. |
| **Real-Time Model Checking During Development** | "Check invariants after every keystroke" appeals to fast feedback. | TLA+/APALACHE/TLC have startup/state-space overhead (seconds to minutes even for medium models). Running on every save causes context loss and delays. | Instead: **Lazy Model Checking** — check only when user explicitly runs `/nf:debug` or when tests fail. Cache TLC results across sessions. Pre-compute state space once per model version; reuse across runs. |
| **Full Symbolic Execution of User Code** | "Trace all paths to find bugs" is tempting. | Path explosion: even simple loops create unbounded paths. Constraint solving becomes intractable for large programs. [Symbolic execution survey](https://arxiv.org/pdf/2508.06643) shows tools scale to ~1000 LOC max. nForma processes multi-million LOC codebases. | Instead: **Trace-Based Diagnosis** — capture actual failing execution (already available from bug reports), use symbolic execution only on the failing path slice. Run bug-specific model checkers, not full program synthesis. |
| **Automatic Model Decomposition** | "Split big models into smaller ones to improve checking speed" is appealing. | Decomposition creates interface contracts between models that are hard to maintain. Changes to one model fragment invalidate decomposition. [State-space analysis literature](https://www.researchgate.net/publication/257468440_Debugging_formal_specifications_A_practical_approach_using_model-based_diagnosis_and_counterstrategies) shows decomposition increases specification bug risk. | Instead: **Selective Model Checking** — use APALACHE symbolic solver instead of TLC for large models; focus checking on properties directly related to the bug (use model annotation @requirement links). Avoid decomposition unless models share zero requirements. |

## Feature Dependencies

```
[Bug-to-Model Lookup]
    └──requires──> [Model Execution on Bug Trace]
                       └──requires──> [Trace-to-Counterexample Conversion]
                                          └──requires──> [Root Cause Extraction from Counterexample]
                                                             └──requires──> [Plain-English Constraint Summary]

[Pre-Verification of Fix Against Model]
    └──requires──> [Root Cause Extraction from Counterexample]
    └──requires──> [Plain-English Constraint Summary]

[Model Refinement from Bugs]
    └──requires──> [Bug-to-Model Lookup]
    └──requires──> [Trace-to-Counterexample Conversion]
    └──requires──> [Root Cause Extraction from Counterexample]

[B→F Solve Layer]
    └──requires──> [Bug-to-Model Lookup]
    └──requires──> [Model Execution on Bug Trace]

[Cross-Model Regression Prevention]
    └──requires──> [Pre-Verification of Fix Against Model]
    └──enhances──> [B→F Solve Layer]

[Fix Constraint Solver]
    └──requires──> [Plain-English Constraint Summary]
    └──requires──> [Pre-Verification of Fix Against Model]

[Invariant-Driven Solve Prioritization]
    └──requires──> [Bug-to-Model Lookup]
    └──enhances──> [B→F Solve Layer]
```

### Dependency Notes

- **[Bug-to-Model Lookup] requires [Model Execution on Bug Trace]:** Can't use a model to explain a bug unless you can run the model against the failing scenario.
- **[Model Execution] requires [Trace Conversion]:** Model checkers work with formal state representations, not raw execution logs. Conversion bridges the gap.
- **[Root Cause Extraction] is bottleneck for all downstream features:** Many features depend on extracting _why_ an invariant failed, not just _that_ it failed. Must be solid before building on it.
- **[Pre-Verification] enhances [Model Refinement]:** A refined model should be immediately tested against the fix that motivated the refinement.
- **[Cross-Model Regression] conflicts with [Model Decomposition]:** Decomposed models create version-management complexity; regression checking becomes order-dependent. Don't build both in same phase.
- **[B→F Solve Layer] requires [Bug-to-Model Lookup]:** The layer's entire purpose is to identify bugs that models should catch. Can't do that without lookup.

## MVP Definition

### Launch With (v0.38 — Model-Driven Debugging)

Minimum viable product — what's needed to validate the concept that formal models can guide real debugging.

- [x] **Bug-to-Model Lookup** — Find relevant models from failing code (via formal-scope-scan proximity). Deliverable: extend formal-scope-scan.cjs to rank models by source-file match and scope depth.
- [x] **Model Execution on Bug Trace** — Run TLA+/Alloy checkers with failing trace as input constraints. Deliverable: TLA+ runner accepts trace-derived ASSUME statements; Alloy runner accepts trace facts.
- [x] **Trace-to-Counterexample Conversion** — Map execution events to formal model state. Deliverable: JSON→TLA+ event converter in trace-analyzer.cjs.
- [x] **Root Cause Extraction** — Parse counterexample, identify first invariant violation, extract variables. Deliverable: invariant-breach-analyzer.cjs parsing TLC output.
- [x] **Plain-English Constraint Summary** — Translate 3-5 invariants to English. Deliverable: constraint-translator.cjs with TLA+ operator→English mapping.
- [x] **Pre-Verification of Fix** — Verify fix against model that explained bug. Deliverable: fix-verification-layer.cjs running APALACHE in verify mode with patched code as ASSUME.

### Add After Validation (v0.39–v0.40)

Features to add once core bug-diagnosis loop is working end-to-end.

- [ ] **Model Refinement from Bugs** — Auto-generate new invariants from failing traces. Requires specification mining (sparse coding) implementation; higher complexity justifies later phase.
- [ ] **Cross-Model Regression Prevention** — Run fix against neighboring models in parallel. Requires model-graph execution infrastructure.
- [ ] **Invariant-Driven Solve Prioritization** — Rank solve waves by invariant likelihood. Requires integration with hypothesis-driven ordering system.

### Future Consideration (v0.41+)

Features to defer until model-driven debugging is proven operational.

- [ ] **B→F Solve Layer** — New 20th solve layer for "bugs models should catch". Requires mature model-lookup, fix-verification, and bug-tracking infrastructure. Risk: adds complexity without user value if models don't yet explain most bugs.
- [ ] **Fix Constraint Solver** — Synthesize constraint space for fixes. Requires mature constraint-extraction and SMT solver integration. Useful only if developers trust constraints (requires validation on real bugs).

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| Bug-to-Model Lookup | HIGH | MEDIUM | P1 | v0.38 |
| Model Execution on Bug Trace | HIGH | MEDIUM | P1 | v0.38 |
| Trace-to-Counterexample Conversion | HIGH | MEDIUM | P1 | v0.38 |
| Root Cause Extraction | HIGH | MEDIUM | P1 | v0.38 |
| Plain-English Constraint Summary | MEDIUM | MEDIUM | P1 | v0.38 |
| Pre-Verification of Fix | HIGH | HIGH | P1 | v0.38 |
| Model Refinement from Bugs | HIGH | HIGH | P2 | v0.39 |
| Cross-Model Regression Prevention | MEDIUM | HIGH | P2 | v0.40 |
| Invariant-Driven Solve Prioritization | MEDIUM | MEDIUM | P2 | v0.39 |
| B→F Solve Layer | MEDIUM | HIGH | P3 | v0.41+ |
| Fix Constraint Solver | MEDIUM | HIGH | P3 | v0.41+ |

**Priority key:**
- **P1:** Launch v0.38 — core bug-diagnosis loop, answers "which invariant is broken and why"
- **P2:** Add in v0.39–v0.40 — model improvement and multi-model safety
- **P3:** Future — advanced synthesis and solve orchestration, lower ROI early

## Ecosystem Patterns & Implementation Guidance

### Pattern 1: Bug Trace → Counterexample Mapping

**What:** Execution traces contain timestamped events and state snapshots. Formal models expect state represented as TLA+ variable assignments or Alloy relation facts. Conversion bridges the gap.

**When:** Always — core dependency for all downstream features.

**How (TLA+):**
```
Execution trace → JSON with event sequence:
{
  "events": [
    {"ts": 0, "var": "status", "value": "init"},
    {"ts": 1, "var": "counter", "value": 5},
    {"ts": 2, "var": "status", "value": "failed"}
  ]
}

Convert to TLA+ ASSUME:
ASSUME pc[self] = "init"
ASSUME counter = 5
ASSUME pc[self] = "failed"
```

**References:** [APALACHE symbolic model checker](https://apalache-mc.org/) accepts ASSUME constraints; [TLC trace viewer](https://tla.msr-inria.inria.fr/tlatoolbox/doc/model/results-page.html) parses state traces.

### Pattern 2: Counterexample-Guided Diagnosis (CEGAR Loop)

**What:** Model checker produces a counterexample trace. That trace might be "spurious" (impossible in real execution). CEGAR algorithm compares the model's counterexample against the actual bug trace to identify which model assumptions are wrong.

**When:** When a model produces a counterexample, but it doesn't match the observed bug.

**How:**
1. Run model checker: TLC generates trace T_model where invariant I fails.
2. Compare against actual bug trace T_bug:
   - Are the variable values the same at each step? If not, which are different?
   - Which variable changes first diverge the traces?
3. Hypothesis: "Model assumes [variable X behavior], but actual code does [different behavior]."
4. Refine model: Add constraint to rule out the spurious case, or adjust parameter.

**References:** [Counterexample-Guided Abstraction Refinement (CEGAR)](https://dl.acm.org/doi/10.1145/876638.876643) foundational paper; [FLACK tool for Alloy](https://cse.unl.edu/~hbagheri/publications/2021ASE_FLACK_tool.pdf) implements similar idea for specification debugging.

### Pattern 3: Constraint Extraction from Invariants

**What:** TLA+ invariants like `INVARIANT ~(x > 10 /\ y < 0)` encode constraints. Extract to plain English: "Fix must not set x > 10 while y < 0." User doesn't read TLA+ syntax.

**When:** Always — surface constraints to developers immediately after diagnosis.

**How:**
- Parse TLA+ operators: `/\` → "and", `\/` → "or", `~` → "not", `=` → "equals"
- Handle quantifiers: `\A x ∈ S: P(x)` → "for all x in [set], [property]"
- Map variable names to source code: Use @requirement annotations in model to link formal vars to code identifiers
- Surface top 3-5 constraints by relevance (frequency in failed traces)

**References:** [Alloy FLACK tool](https://cse.unl.edu/~hbagheri/publications/2021ASE_FLACK_tool.pdf) does localization by comparing satisfying vs failing instances; adapt for TLA+ invariants.

### Pattern 4: Specification Mining from Failing Traces

**What:** When no model explains a bug, synthesize a new invariant that would have caught it.

**When:** After Root Cause Extraction shows "no invariant guards this code path."

**How:**
1. Extract key events from failing trace (variable changes, state transitions).
2. Mine temporal patterns: "X always happens before Y", "whenever A, then eventually B"
3. Use sparse coding or pattern templates to find frequent subtraces
4. Convert pattern to invariant: Sparse subtrace → TLA+ INVARIANT predicate
5. Validate: Re-run failing scenario, confirm new invariant fails at right point

**References:** [Sparse Coding for Specification Mining](https://people.eecs.berkeley.edu/~sseshia/pubdir/rv12-sc.pdf); [RTL bug localization via LTL mining](https://dl.acm.org/doi/10.1145/3359986.3361202) (similar technique for hardware).

### Pattern 5: Fix Verification via Symbolic Execution

**What:** Developer writes fix. Before committing, verify it symbolically against the model that explained the bug.

**When:** After fix written, before merge.

**How:**
1. Instrument fix as TLA+ ACTION: represent code patch as state transition modifier
2. Run APALACHE symbolic checker: "Does invariant still hold if we apply this action?"
3. If APALACHE produces counterexample, fix is incomplete
4. Surface constraint: "Fix is valid only if X remains true" (from invariant assumptions)

**References:** [Automatic Program Repair via Formal Verification](https://springer.com/chapter/10.1007/978-3-030-11245-5_4) uses constraint generation for repair; [APALACHE symbolic solving](https://apalache-mc.org/) handles bounded verification efficiently.

### Pattern 6: Cross-Model Regression Prevention

**What:** Fix verified against Model A? Check it doesn't break Models B, C (which share source files or requirements).

**When:** Post fix-verification; before shipping.

**How:**
1. Extract fix scope: files modified, functions changed
2. From model-registry, find all models that reference these files (via @requirement annotations)
3. Run fix-verification in parallel against each model
4. Report any new counterexamples: "Fix passes Model A but breaks Model C"

**References:** nForma already has model-registry with bidirectional @requirement links (v0.25); extend to run verification in parallel across related models.

## Known Challenges & Mitigations

| Challenge | Impact | Mitigation |
|-----------|--------|-----------|
| **Trace capture overhead** | Bugs in production are hard to reproduce with full traces. | Accept partial traces (key state snapshots only). Use sampling for long-running traces. Provide manual trace-entry UI for developer-reported bugs. |
| **Model state explosion** | Large models can't be checked exhaustively. TLC times out. | Use APALACHE symbolic solver instead of TLC for large models (handles integer clocks, arrays). Pre-constrain state space using ASSUME statements from bug trace. |
| **Spurious counterexamples** | Model produces trace that doesn't match actual bug. CEGAR loop required. | Implement CEGAR: store model assumptions as separate layer in model-registry. When counterexample differs from bug trace, raise assumption violation instead of claiming invariant failure. |
| **Weak specifications** | Test-suite-driven fixes overfit and break on new inputs. | Don't auto-generate patches. Instead, generate constraints and require human verification. Measure fix quality post-deploy via production observability feedback. |
| **Model maintenance burden** | As code evolves, models become stale and produce false negatives. | Auto-update models: when @requirement annotations link models to code, trigger model re-verification on requirement change. Gate: if model breaks, mark SOFT_GATE and require manual review. |

## Sources

### Core Research
- [Counterexample-Guided Abstraction Refinement (CEGAR)](https://dl.acm.org/doi/10.1145/876638.876643) — Clarke et al., foundational technique for trace-guided model refinement
- [Sparse Coding for Specification Mining](https://people.eecs.berkeley.edu/~sseshia/pubdir/rv12-sc.pdf) — Seshia et al., mining specs from execution traces
- [FLACK: Counterexample-Guided Fault Localization for Alloy](https://cse.unl.edu/~hbagheri/publications/2021ASE_FLACK_tool.pdf) — fault localization via instance comparison

### Tools & Implementations
- [APALACHE: Symbolic Model Checker for TLA+](https://apalache-mc.org/) — SMT-based symbolic execution, handles large state spaces
- [TLC: The TLA+ Model Checker](https://github.com/tlaplus/tlaplus) — production-standard bounded model checking
- [Alloy Analyzer](https://cacm.acm.org/research/alloy/) — SAT-based specification checking, automated counterexample generation
- [TLC Trace Viewer](https://tla.msr-inria.inria.fr/tlatoolbox/doc/model/results-page.html) — trace analysis and visualization

### Program Synthesis & Repair
- [Automatic Program Repair Using Formal Verification](https://springer.com/chapter/10.1007/978-3-030-11245-5_4) — constraint-based repair templates
- [Syntax-Guided Synthesis (SyGuS)](https://www.cis.upenn.edu/~alur/SyGuS13.pdf) — specification-guided program generation
- [RTL Bug Localization via LTL Specification Mining](https://dl.acm.org/doi/10.1145/3359986.3361202) — temporal pattern mining for hardware debugging

### AI-Assisted Methods
- [Explainable Automated Debugging via LLM-driven Scientific Debugging](https://link.springer.com/article/10.1007/s10664-024-10594-x) — recent work on LLM-guided hypothesis generation
- [Enhancing Automated Loop Invariant Generation with LLMs](https://arxiv.org/html/2412.10483v1) — CLN2INV approach, learning invariants from traces
- [Automatic Bug Hunting via Data-Driven Symbolic Root Cause Analysis](https://dl.acm.org/doi/abs/10.1145/3460120.3485363) — combining symbolic execution with ML for diagnosis

### nForma-Specific Baseline
- nForma v0.25: Formal traceability (bidirectional model↔requirement links via @requirement annotations)
- nForma v0.26: Operational completeness (model-registry, requirement aggregation)
- nForma v0.29: Three-layer formal verification (Evidence, Semantics, Reasoning layers with grounding/abstraction/validation gates)
- nForma v0.37: Cross-layer feedback (quorum precedent memory, gate auto-promotion, scanner FP self-tuning)

---

**Feature research for:** Model-driven debugging (v0.38)
**Researched:** 2026-03-17
