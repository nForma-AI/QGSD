# Research Summary: Model-Driven Debugging for nForma

**Domain:** Adding model-driven debugging to existing formal verification system
**Project:** nForma v0.38
**Researched:** 2026-03-17
**Overall Confidence:** MEDIUM (academic research + formal verification infrastructure analysis; limited production case studies for LLM-driven model-based debugging)

---

## Executive Summary

Model-driven debugging promises to evolve nForma's formal models from descriptive (validation gates) to prescriptive (guides for fixing bugs and constrains solution space). But integrating model-driven debugging into an existing system with 92+ formal models carries seven critical risks:

1. **False confidence from model reproduction** — Models may reproduce symptoms without explaining mechanisms, leading to fixes that don't solve root causes
2. **State space explosion on on-demand checking** — 60-second timeout makes large models unusable for interactive debugging
3. **Over-constraint in fix space** — Extracting constraints from models may eliminate valid fixes
4. **Model refinement loops that never converge** — Iterative refinement can run indefinitely without yielding useful results
5. **Cross-model regression cascades** — Fixing one model breaks neighbors; cascades propagate
6. **B→F layer noise inflation** — Test flakiness gets misclassified as formal gaps, inflating solve residual
7. **Debug performance impact** — Model consultation adds 5–10 seconds per invocation, making /nf:debug slow

**All risks are preventable with explicit structural gates built at design time.** They cannot be patched after deployment. The research recommends a phased approach prioritizing state-space management and false-confidence prevention before broader integration.

---

## Key Findings

### Stack & Technology

**Model Checking Infrastructure (Already in place):**
- TLA+ (TLC model checker): 22+ models, used for concurrent system verification
- Alloy (SAT-based solver): 43+ models, used for structural and state machine verification
- PRISM (probabilistic model checker): 7+ models, used for failure rate and consensus analysis
- State-space estimation tool (v0.34): classifies models by risk level (MINIMAL, LOW, MODERATE, HIGH)
- Proximity index (v0.26): identifies cross-model dependencies

**Existing Formal Architecture:**
- 92+ models organized in three-layer system (Evidence/Semantics/Reasoning)
- Gate system (Wiring/Purpose/Coverage) with auto-promotion after 3 clean runs
- Model registry with maturity ratings and consecutive pass counts
- Traceability between requirements and models (15+ requirement groups)

### Critical Pitfalls & Prevention Strategy

**Pitfall 1: False Confidence from Model Reproduction** [CRITICAL]
- **Prevention:** Require mechanism-verification gate. After model reproduction, mandate separate investigation proving root cause mechanism
- **Design point:** Add "model-to-mechanism" gate in /nf:debug flow before fix is considered valid
- **Phase:** Must address in Phase 1 (Debug Integration)

**Pitfall 2: State Space Explosion on On-Demand Checking** [CRITICAL]
- **Prevention:** Pre-flight state-space estimation; tier models by size; use partial results on timeout
- **Design point:** Implement tiered checking (fast: 5s, medium: 30s, large: 300s background)
- **Phase:** Must address in Phase 1; blocks responsive debugging

**Pitfall 3: Constraint Over-Specification** [CRITICAL]
- **Prevention:** Classify constraints (CORE/AUXILIARY/ASSUMPTION); sensitivity analysis on models
- **Design point:** Extract minimal constraint set; require post-fix validation of which constraints were necessary
- **Phase:** Must address in Phase 2 (Constraint Extraction)

**Pitfall 4: Model Refinement Non-Convergence** [MODERATE]
- **Prevention:** 2-iteration budget per bug; focus on mechanism, not symptom; manual investigation fallback
- **Design point:** Require explicit mechanism hypothesis before iterating; stop after 1 day
- **Phase:** Address in Phase 2

**Pitfall 5: Cross-Model Regression Cascades** [MODERATE-HIGH]
- **Prevention:** Pre-fix regression mapping; one-shot formal pre-verification; dependency tracking
- **Design point:** Map regression surface before applying fix; escalate if >2 models regress
- **Phase:** Address in Phase 3 (Solve Integration)

**Pitfall 6: B→F Layer Noise Inflation** [MODERATE]
- **Prevention:** Flakiness filtering (re-run failed tests); formal-gap classification; cleanup cycle
- **Design point:** Only mark persistent failures as formal gaps; monthly cleanup
- **Phase:** Address in Phase 3 (Solve Integration)

**Pitfall 7: Debug Performance Impact** [MODERATE]
- **Prevention:** JVM caching; optional model consultation; latency budgeting
- **Design point:** /nf:debug should complete in <10s without models; model consultation is optional
- **Phase:** Address in Phase 4 (Performance)

---

## Implications for Roadmap

### Phase Structure

**Phase 1: Debug Integration & State-Space Management** (6 weeks)
- Implement formal-scope-scan.cjs enhancements: pre-flight state-space estimation, model tiering
- Add model-to-mechanism gate in /nf:debug: require evidence-gathering after model reproduction
- Build ON-DEMAND tier (<100K states) vs BATCH tier (larger) models
- **Pitfalls addressed:** #2, #1 (partial), #7 (partial)
- **Success criteria:** /nf:debug invokes models, respects 60s timeout, returns in <15s

**Phase 2: Constraint Extraction & Model Refinement** (6 weeks)
- Build constraint extraction from TLA+/Alloy with classification (CORE/AUXILIARY/ASSUMPTION)
- Implement sensitivity analysis: which constraints truly prevent the bug?
- Add refinement budget (2 iterations max) and mechanism-focused gates
- **Pitfalls addressed:** #3, #4, #1 (deeper)
- **Success criteria:** Extracted constraints are validated post-fix; refinement doesn't exceed budget

**Phase 3: Solve Integration & Model Regression** (8 weeks)
- Integrate B→F layer with flakiness filtering and formal-gap classification
- Implement pre-fix regression surface mapping (formal-scope-scan with --proximity)
- Add one-shot formal pre-verification: check all proximity models before committing fix
- Implement B→F cleanup cycle (monthly)
- **Pitfalls addressed:** #6, #5
- **Success criteria:** Solve loop doesn't regress models; B→F entries are legitimate formal gaps

**Phase 4: Performance & Documentation** (4 weeks)
- Add JVM caching for TLC/Alloy processes; benchmark latency
- Implement optional model consultation (--use-models flag)
- Add precision metadata to model-registry.json; display in /nf:debug output
- **Pitfalls addressed:** #7, #8
- **Success criteria:** /nf:debug performs consistently; model precision is documented

### Phase Ordering Rationale

1. **Phase 1 first:** State-space management and false-confidence prevention are blocking issues. Without them, /nf:debug will be slow and unreliable.
2. **Phase 2 follows:** Constraint extraction depends on models working (Phase 1). Model refinement gates prevent refinement loops from consuming Phase 1 investment.
3. **Phase 3 integrates:** Once models are reliable (Phases 1–2), integrate into solve loop. Regression prevention is crucial at scale.
4. **Phase 4 polish:** Performance and documentation come last because their absence doesn't block core functionality, only usability.

### Research Flags for Phases

**Phase 1 needs deeper research:**
- [ ] Profile actual state-space sizes of 92+ models under TLC with 60s timeout
- [ ] Benchmark TLC/Alloy startup time; determine JVM caching feasibility
- [ ] Estimate which models hit state explosion under on-demand use case

**Phase 2 needs deeper research:**
- [ ] What's the minimal constraint set to ensure bug unreachability? (Constraint synthesis problem)
- [ ] Does sensitivity analysis (varying one constraint, re-checking) work in practice? Benchmark cost.
- [ ] How many refinement iterations are actually needed for typical bugs?

**Phase 3 needs deeper research:**
- [ ] What's the actual flakiness rate of nForma tests? (Baseline measurement needed)
- [ ] Can we auto-classify "formal gap" vs "test noise" reliably?
- [ ] How tightly coupled are the 92+ models? (Dependency graph analysis)

**Phase 4 needs deeper research:**
- [ ] What precision level do developers trust? (User study or survey)

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| **State space explosion risk** | **HIGH** | Academic literature is extensive and consistent; state explosion is a well-documented pitfall in formal methods (2025–2026 research confirms) |
| **False confidence from model reproduction** | **HIGH** | Multiple authoritative sources confirm endemic to model-based debugging; Amazon Web Services formal methods practices emphasize mechanism verification |
| **Over-specification in constraints** | **MEDIUM** | General pattern well-documented; nForma-specific analysis needed in Phase 2 (don't yet know constraint distribution in practice) |
| **Model refinement convergence** | **MEDIUM** | Risk is clear from general iterative design theory; nForma specifics unknown (how often is refinement needed?) |
| **Cascade regression risk** | **MEDIUM-HIGH** | Risk exists at model-system scale; unknown how tightly coupled nForma's 92+ models actually are (needs graph analysis) |
| **B→F noise inflation** | **MEDIUM** | Risk is new to v0.38 and depends on actual test flakiness rates (needs profiling) |
| **Debug performance impact** | **MEDIUM** | Depends on actual TLC/Alloy performance; needs benchmarking |
| **Overall architecture soundness** | **HIGH** | Three-layer formal architecture (v0.29) is well-designed; model-driven debugging is natural evolution |

---

## Gaps to Address

1. **No production data:** This research is based on academic literature and nForma's codebase. We need production experience with model-driven debugging to validate/refine these pitfalls. Early phases should include extensive logging and metrics collection.

2. **Constraint synthesis complexity:** Phase 2 depends on finding minimal constraint sets. Research assumes sensitivity analysis works; needs validation. May need formal methods expert consultation.

3. **Model coupling analysis:** Phase 3 depends on understanding how 92+ models interact. Existing proximity index (v0.26) provides foundation but hasn't been deeply analyzed for cascade risk.

4. **Flakiness baseline:** Phase 3 gates depend on classifying "formal gap" vs "test noise." First step is measuring actual flakiness rate in current test suite. Should be done early in Phase 1 as background task.

5. **User research:** Phase 4 documentation depends on understanding what precision levels developers trust. Light user study or survey recommended during Phase 3.

---

## Alignment with Project Principles

**nForma's three core principles:**

1. **Planning decisions are multi-model verified** — Model-driven debugging strengthens this by making models prescriptive (guide fixes) not just descriptive (validate designs)
2. **Structural enforcement over instruction-following** — Pitfall prevention via gates (mechanism-verification, state-space estimation, regression mapping) follows this principle
3. **Formal verification as active gate, not post-hoc check** — Model-driven debugging integrates models into the critical path of debugging and fixing

The research pitfalls are designed to prevent scenarios where structural gates fail (e.g., false confidence from incomplete model reproduction) and ensure gates work as intended.

---

## Recommended Reading Order

For the roadmap creator, reading order:

1. **PITFALLS_v0.38_MODEL_DRIVEN_DEBUG.md** (this research file) — Detailed pitfalls with examples
2. **Phase 1 design doc** (when created) — Focus on Pitfalls #1, #2, #7
3. **Phase 2 design doc** (when created) — Focus on Pitfalls #3, #4
4. **Phase 3 design doc** (when created) — Focus on Pitfalls #5, #6

Each design doc should include explicit mitigation strategies from PITFALLS file and acceptance criteria to detect if pitfall was introduced.

---

## Sources

- [Bridging Design Verification Gaps with Formal Verification](https://www.design-reuse.com/article/61616-bridging-design-verification-gaps-with-formal-verification/)
- [Model Checking: Algorithmic Verification and Debugging](https://www.researchgate.net/publication/220423326_Model_Checking_Algorithmic_Verification_and_Debugging)
- [Model Checking and the State Explosion Problem](https://www.researchgate.net/publication/289682092_Model_Checking_and_the_State_Explosion_Problem)
- [Model checking of spacecraft operational designs: a scalability analysis (2025)](https://link.springer.com/article/10.1007/s10270-025-01281-6)
- [Handling State Space Explosion in Component-based Systems](https://arxiv.org/pdf/1709.10379)
- [When Generated Tests Pass but Miss the Bug: A Case of False Confidence from AI Test Generation](https://dev.to/markk40123/when-generated-tests-pass-but-miss-the-bug-a-case-of-false-confidence-from-ai-test-generation-1674)
- [Using Formal Methods to Analyse Software Related Failures](https://www.dcs.gla.ac.uk/~johnson/papers/FME_Johnson_Keynote.PDF)
- [Debugging formal specifications using simple counterstrategies](https://www.researchgate.net/publication/224088972_Debugging_formal_specifications_using_simple_counterstrategies)
- [Don't over-constrain in formal property verification (FPV) flows](https://www.edn.com/dont-over-constrain-in-formal-property-verification-fpv-flows/)
- [On the Impact of Formal Verification on Software Development (2025)](https://ranjitjhala.github.io/static/oopsla25-formal.pdf)
- [Use of Formal Methods at Amazon Web Services](https://lamport.azurewebsites.net/tla/formal-methods-amazon.pdf)
- [Refinement Types for TLA+](https://www.cs.yale.edu/homes/vanzetto/pub/vanzetto-2014-Refinement_types_for_TLA+.pdf)
