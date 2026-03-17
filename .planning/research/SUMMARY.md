# Research Summary: Model-Driven Debugging for nForma

**Project:** nForma v0.38 — Model-Driven Debugging
**Domain:** Formal verification-guided debugging; transforming models from validation gates to fix-guidance tools
**Researched:** 2026-03-17
**Confidence:** HIGH (architecture verified against codebase; MEDIUM on pitfalls given novelty of LLM-driven model analysis)

---

## Executive Summary

Model-driven debugging transforms nForma's formal models from descriptive (CI validation gates) to prescriptive (explaining bugs, constraining fix space, preventing regressions). The core insight: when a bug occurs, the matching formal model can explain the root cause and constrain the fix—without requiring developers to read TLA+ or Alloy specifications. This requires three integrated subsystems: (1) **Bug-to-Model Lookup** (extending existing `formal-scope-scan.cjs` with bug-pattern matching), (2) **Constraint Extraction & Translation** (parsing INVARIANT/PROPERTY blocks to English via Haiku), and (3) **Model-Aware Debug Integration** (injecting constraints into `/nf:debug` quorum phase). The critical risk is **false confidence from symptom reproduction**—a model may reproduce what a bug looks like without explaining why it happens. Mitigation: require explicit mechanism-verification gates that compare model assumptions to production traces before accepting the model's root-cause claim.

The recommended technology stack is minimal: two npm packages (`fast-xml-parser` for Alloy XML parsing, `acorn` for JavaScript scope analysis) plus five custom parsers (trace→ITF, constraint extraction, constraint→English). No changes to existing TLC/Alloy runners. The architecture is fail-open: missing models or failed constraint extraction degrades gracefully to existing `/nf:debug` behavior. Expected time-to-value: 2–4 weeks for MVP (Phases 1–2), with Phase 3 (solve-layer B→F integration) following after user validation.

---

## Key Findings

### Recommended Stack

Model-driven debugging requires minimal new dependencies. The existing formal verification infrastructure (TLC, Alloy, PRISM, model-registry with 200+ models) already exists; the new stack focuses on *parsing and translation* between formal and natural language representations.

**Core technologies:**
- **fast-xml-parser v5.4.1**: Parse Alloy SAT solver XML instance output. Rationale: Alloy 6 outputs instances as XML; this library is battle-tested (Microsoft, NASA, VMware usage) and avoids Java process overhead vs. native Alloy API.
- **acorn v8.11.0**: JavaScript AST parser for code-file-to-model mapping. Rationale: Standard in ESLint ecosystem; enables scope analysis to answer "which formal models affect this code file?"
- **Custom ITF trace parser** (no external deps): Convert TLC stderr trace.txt output to ITF JSON format. Rationale: TLC's native output is simpler than XML; lightweight custom parser covers 100% of trace format.
- **Custom constraint extractor** (no external deps): Regex-based extraction of INVARIANT/PROPERTY blocks from TLA+ and Alloy specs. Rationale: Specs are highly structured; regex handles 95% of cases; parser combinators would be over-engineering.
- **Haiku LLM integration** (existing quorum dispatch): Constraint-to-English translation. Rationale: Reuse existing quorum infrastructure; Haiku is fast (2–5s per constraint batch) and available in current harness.

**Version pinning:** Lock `fast-xml-parser` and `acorn` to exact versions (5.4.1 and 8.11.0) to ensure consistent AST/XML parsing across developer machines and CI.

**Installation:** `npm install fast-xml-parser@5.4.1 acorn@8.11.0`

### Expected Features

Features are organized by dependency and user value. The core value proposition is the **Bug-to-Fix guidance loop**: when a developer runs `/nf:debug "symptom description"`, the tool returns not just suggested fixes but also the formal model assumptions and constraints that fix must satisfy.

**Must-have (table stakes — launched in v0.38):**
1. **Bug-to-Model Lookup** — Find formal models matching failing code files. Extend `formal-scope-scan.cjs` to match by source file (code filename → model @requirement annotations), semantic similarity (via proximity-index), and bug-pattern matching (common error signatures).
2. **Model Execution on Bug Trace** — Run TLA+/Alloy checkers with actual failing trace as input constraints. Convert execution events (state transitions, variable changes) to TLA+ ASSUME statements; rerun model checker to confirm model reproduces the bug.
3. **Trace-to-Counterexample Conversion** — Map execution timestamps/events to formal state representation. Parse bug logs into JSON, normalize to ITF (Informal Trace Format), validate against model vocabulary.
4. **Root Cause Extraction** — Parse model counterexample to identify which invariant violated at which state transition. Link formal variable names back to source code via @requirement annotations.
5. **Plain-English Constraint Summary** — Extract 3–5 key invariants from matching models, translate to English (e.g., "Quorum consensus requires 3/4 agreement"). Developers read English, not TLA+ syntax.
6. **Pre-Verification of Fix** — Before shipping, verify the proposed fix symbolically against the model. Run APALACHE in bounded-verification mode: "Does invariant still hold if we apply this code patch?"

**Should-have (competitive differentiator — v0.39+):**
1. **Cross-Model Regression Prevention** — Fix verified against Model A? Run the same verification against Models B, C, D (any model sharing requirements/files). Report any new counterexamples.
2. **Model Refinement from Bugs** — When no model explains a bug, auto-generate/refine a model from the failing trace. Use specification mining (sparse coding) to extract temporal patterns; synthesize new INVARIANT.
3. **B→F Solve Layer** — New 20th layer in solve pipeline tracking "bugs formal models should have caught but didn't." Drives model-refinement roadmap autonomously.

**Defer (v0.40+):**
1. **Fix Constraint Solver** — Given model invariants, synthesize the minimal constraint space that fix must satisfy. Use SMT solving to generate explicit bounds on variables the fix modifies.
2. **Invariant-Driven Solve Prioritization** — Rank solve waves by "likelihood of violating high-impact invariants" derived from PRISM sensitivity analysis and recent bug patterns.

### Architecture Approach

Model-driven debugging extends three existing nForma subsystems without breaking changes:

1. **Model Lookup Layer** — Extend `formal-scope-scan.cjs` with `--bug-mode` flag. New logic: load optional `bug-patterns.json` (common failure signatures), match against bug description using Levenshtein distance > 0.75, boost proximity_score for pattern hits, return ranked model list with metadata (proximity score, lookup strategy, which spec sections apply).

2. **Constraint Extraction Layer** — New file `bin/model-constrained-fix.cjs`. Read matched models' invariants.md files, parse constraint blocks (SAFETY, LIVENESS, BOUNDS, PRECONDITION headers), extract formal references, link to @requirement annotations via proximity graph, generate English constraint list with confidence scores. Output schema: `{ model, constraints: [{type, english, formal, confidence, applies_to_fix}] }`.

3. **Debug Bundle Injection** — Modify `/nf:debug` Step A to run bug-to-model lookup + constraint extraction after failure context collection. Inject results into quorum-worker bundle as "Formal Model Intelligence" section. Workers see model recommendations + constraint guidance + existing failure context.

4. **Solve Layer B→F** — New 20th layer tracking bugs not explained by formal models. Runs in wave 7 (post h_to_m). Handler iterates git history, matches each bug to models, identifies unflagged gaps, routes to `/nf:close-formal-gaps` for model refinement or logs as v0.39 candidates.

**Build order (no cycles):** Phase 1 (lookup+extraction) → Phase 2 (debug integration) → Phase 3 (solve layer) → Phase 4 (testing). Graceful degradation: if lookup fails, debug flow continues with existing 4-worker dispatch.

### Critical Pitfalls

Integrating model-driven debugging carries seven distinct risk categories, all preventable with structural gates designed upfront:

1. **False Confidence from Model Reproduction** [CRITICAL]
   - **What:** Model reproduces symptom (state X reaches) but not mechanism (why X is reachable). Fix based on model works for test case, fails in production.
   - **Prevention:** After model reproduction, mandate separate mechanism-verification gate. Compare model-claimed root cause to production trace timeline, not just end state. Mark provisional models with flag until mechanism verified.
   - **Design point:** Add "model-to-mechanism" validation step in /nf:debug flow before fix is considered valid.

2. **State Space Explosion on On-Demand Checking** [CRITICAL]
   - **What:** Large models (500+ state vars) can't complete TLC/APALACHE check within 60-second /nf:debug timeout. Interactive debugging becomes unusable.
   - **Prevention:** (a) Use APALACHE symbolic solver instead of TLC for large models (handles integer clocks, arrays; faster than exhaustive TLC). (b) Pre-constrain state space using ASSUME statements derived from bug trace. (c) Cache TLC results across sessions (recompute only on model/code change). (d) For interactive debugging, check only models flagged MINIMAL/LOW state-space risk (from state-space-estimation-tool.cjs).
   - **Design point:** Add `--quick-verify` mode that skips high-risk models if timeout approaches.

3. **Over-Constraint in Fix Space** [CRITICAL]
   - **What:** Extracting too many constraints from a model may eliminate all valid fixes. Model says "X must be true AND Y must be true AND Z must be true"—but satisfying all three is impossible with available code changes.
   - **Prevention:** Rank constraints by relevance (frequency in failed traces). Surface top 3–5 only. Distinguish between "hard constraints" (safety invariants that must hold) and "soft hints" (patterns that help but aren't necessary).
   - **Design point:** Constraint extractor outputs confidence scores; filter before presenting to developer.

4. **Model Refinement Loops That Never Converge** [MODERATE]
   - **What:** Automatically refining models from bugs can create iteration spirals: fix A breaks assumption B, refining B exposes gap C, refining C loops back to A.
   - **Prevention:** Cap auto-refinement iterations to 3. Require human sign-off before 4th iteration. Track model version history; detect loops via TLA+ trace comparison.
   - **Design point:** B→F layer marks auto-generated models with epoch counter; after 3 epochs, escalate to human review.

5. **Cross-Model Regression Cascades** [MODERATE]
   - **What:** Fix verified against Model A passes. But Model A's invariant about timeout indirectly depends on Model B's invariant about message delivery. Fix breaks B's invariant, leading to cascade failures.
   - **Prevention:** Cross-model regression check (Phase 2) must run fix verification against all models with shared requirements (not just direct neighbors). Use model-registry proximity graph to identify transitive dependencies.
   - **Design point:** Pre-verification step includes transitive closure of affected models.

6. **B→F Layer Noise Inflation** [MODERATE]
   - **What:** Test flakiness (test passes 80% of time) gets misclassified as "formal model gap" when tests sometimes pass and sometimes fail. Solve pipeline treats flaky test as bug the model should explain.
   - **Prevention:** Before routing bugs to B→F layer, filter for stability: require bug to appear in >= 2 recent commits or pass rate < 50%. Log flaky tests separately.
   - **Design point:** B→F handler includes stability check before creating unflagged-bug entry.

7. **Debug Performance Impact** [MINOR]
   - **What:** Model consultation (lookup + constraint extraction + Haiku translation) adds 5–10 seconds per `/nf:debug` invocation. Developers may skip model guidance and solve manually, defeating the feature.
   - **Prevention:** Cache lookup results in session memory. Pre-compute constraints offline (batch all specs once per solve run). Batch Haiku calls (5 constraints in one API call vs. 5 calls).
   - **Design point:** /nf:debug caches results; clear only on new failure context.

---

## Implications for Roadmap

Based on research dependencies and risk mitigation order, the recommended phase structure is:

### Phase 1: Bug-to-Model Lookup & Constraint Foundation
**Rationale:** This is the dependency foundation for all downstream features. Cannot extract constraints without knowing which models apply. Cannot verify fixes without lookup results.

**Delivers:**
- Extend `formal-scope-scan.cjs` with `--bug-mode` flag and bug-pattern matching
- Create `bin/model-constrained-fix.cjs` (constraint parser)
- User can run: `node bin/formal-scope-scan.cjs --bug-mode --description "timeout failure"` and get ranked model list with constraints

**Addresses features:** Bug-to-Model Lookup, Trace-to-Counterexample Conversion (partial)

**Avoids pitfalls:** False-confidence prevention (by identifying which models are relevant); state-space explosion (by filtering to relevant models only)

**Effort:** 1–2 weeks. Existing proximity graph is reused; minimal new code. Test with 10 real bugs from git history.

**Research flags:** None — patterns well-established in existing codebase.

---

### Phase 2: Debug Integration & Fix Guidance
**Rationale:** Validates core value proposition: `/nf:debug` returns not just "possible root causes" but "root causes with formal model backing and specific constraints." This is the user-facing MVP.

**Delivers:**
- Modify `commands/nf/debug.md` to run lookup+extraction after failure collection
- Inject model intelligence into quorum-worker bundle
- Workers return `model_recommendation: [APPLY | INSPECT | DEFER]` in addition to existing root_cause/next_step
- `/nf:debug` output shows "Formal Model Constraints" section

**Addresses features:** Root Cause Extraction, Plain-English Constraint Summary, Pre-Verification of Fix (partial)

**Avoids pitfalls:** Over-constraint (by filtering top 3–5 constraints); false-confidence (by requiring developers to verify mechanism); performance (by caching results)

**Effort:** 2–3 weeks. Integration point is clean (optional bundle enrichment). Requires Haiku constraint translation (existing LLM infrastructure). Test with 20 real bugs; measure /nf:debug latency before/after.

**Research flags:** None — existing quorum infrastructure already handles LLM integration.

---

### Phase 3: Solve Layer B→F & Autonomous Gap Closure
**Rationale:** Once debug loop is working, automation opportunity: formal pipeline can now identify which bugs formal models *should* have caught but didn't. Drives model-refinement roadmap autonomously.

**Delivers:**
- Add `b_to_f` to LAYER_KEYS (20th layer)
- Create `bin/solve-handlers/b_to_f.cjs` (residual computation)
- Modify `solve-wave-dag.cjs` to wire B→F dependencies (wave 7, post h_to_m)
- New data file `.planning/formal/bug-model-gaps.json` tracking covered/unflagged bugs
- Section 3o in `solve-remediate.md`: route unflagged bugs to `/nf:close-formal-gaps` or mark as v0.39 candidates

**Addresses features:** B→F Solve Layer, Model Refinement from Bugs (partial)

**Avoids pitfalls:** B→F noise (by requiring stability check); model-refinement loops (by capping iterations); cross-model regression (by preparing architecture for Phase 4)

**Effort:** 2–3 weeks. Waves already exist; adding new layer is pattern-matched to existing h_to_m layer. Test with 30 real bugs; verify B→F fires only on stable failures.

**Research flags:** **Phase 3a (Pitfall Prevention)** — Before shipping B→F layer, validate cascade-exemption logic on known cascade scenarios. Oscillation detection must distinguish cascade (monotonic discovery of new gaps) from genuine regression (same layer's residual oscillates).

---

### Phase 4: Cross-Model Regression & Advanced Synthesis
**Rationale:** After debug and solve loops are proven, add defensive checks (pre-verification across model graph) and advanced synthesis (auto-generating new invariants from failing traces).

**Delivers:**
- Implement cross-model regression in pre-verification phase
- Specification-mining module for auto-generating INVARIANT from failing traces
- Model graph execution in parallel (verify fix against all neighbors)
- Invariant-Driven Solve Prioritization (rank solve waves by PRISM sensitivity)

**Addresses features:** Cross-Model Regression Prevention, Model Refinement from Bugs (full), Fix Constraint Solver (partial), Invariant-Driven Solve Prioritization

**Avoids pitfalls:** Regression cascades (by exhaustive neighbor checking); model refinement loops (by capping auto-generation iterations); predictive power bias (by computing recall metric for all models)

**Effort:** 3–4 weeks. Specification mining requires research into sparse-coding techniques. Parallel model execution requires load-balancing for 200+ models. This is the most complex phase; recommend `/qgsd:research-phase` for specification-mining library selection.

**Research flags:** **Phase 4a (Advanced Synthesis)** — Specification mining from execution traces is novel in this context. Needs research on sparse-coding library (Parsimmon vs. Chevrotain vs. custom) and trace-pattern mining approach (template-based vs. statistical learning). **Phase 4b (Predictive Feedback)** — Measuring model predictive power requires cross-referencing test failures with model coverage. Needs research on traceability-matrix join strategy and survivorship-bias metrics (precision vs. recall vs. F1).

---

### Phase Ordering Rationale

1. **Phases 1 & 2 are prerequisites for 3 & 4.** You cannot measure "which bugs models should explain" (B→F) without first having a working lookup+extraction system (Phase 1) and proven debug integration (Phase 2).

2. **Phases 1 & 2 validate the core hypothesis** that formal models can explain bugs. Phase 3 builds on that validation by automating the discovery process. Phase 4 requires Phase 3 to be working reliably.

3. **Risk mitigation order matters.** False-confidence and state-space pitfalls (Phase 1–2) must be solved before expanding to regression checks (Phase 3–4). Solving in reverse order wastes effort.

4. **User value accrues incrementally.** After Phase 2, developers can use `/nf:debug` with model guidance immediately. After Phase 3, the solve pipeline works autonomously. Phase 4 is optimization.

5. **Dependencies are clean.** No cycles: Phase 1 has zero dependencies, Phase 2 depends on 1, Phase 3 on 1–2, Phase 4 on 1–3.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | fast-xml-parser, acorn are production-grade. Custom parsers are lightweight, well-understood. Haiku integration reuses existing infrastructure. |
| **Features** | MEDIUM-HIGH | Table-stakes features (lookup, extraction, constraint translation) are well-established in formal verification literature. Differentiators (model refinement, B→F layer) are novel in this context; confidence medium. |
| **Architecture** | HIGH | Integration points verified against actual codebase (200+ models, formal-scope-scan.cjs, solve-remediate.md). No breaking changes required. Fail-open design is proven pattern in nForma. |
| **Pitfalls** | MEDIUM | Pitfalls 1–3 are well-known in formal verification (false confidence, state explosion, over-constraint). Pitfall 4+ are specific to nForma's automated refinement + quorum dispatch; confidence is medium because no production case studies exist for this combination. |

**Overall confidence:** MEDIUM-HIGH

Gaps that need attention during planning/execution:
- **Specification mining library selection (Phase 4):** Research sparse-coding implementations; recommend `/qgsd:research-phase` if pursuing Phase 4 in v0.38.
- **Predictive power metrics (Phase 4):** Traceability-matrix join strategy not yet detailed; needs implementation planning during Phase 4 scoping.
- **Cascade exemption validation (Phase 3):** Must test oscillation-detection logic on known cascade scenarios before shipping B→F layer. Recommend dedicated test suite.
- **Model-to-mechanism validation (Phase 2):** No automated check yet; requires human-in-the-loop at /nf:debug output. May need UX design during Phase 2 planning.

---

## Sources

### Primary Research (HIGH confidence)
- **STACK.md** — Detailed technology analysis: fast-xml-parser (v5.4.1 rationale), acorn (v8.11.0 rationale), ITF format specification, alternatives considered
- **FEATURES.md** — Feature landscape with table-stakes vs. differentiators; dependency DAG; MVP definition (6 features for v0.38); known challenges with mitigations
- **ARCHITECTURE.md** — Component-level integration design: bug-to-model lookup, constraint extraction, debug bundle injection, B→F solve layer; build order; dependency graph
- **PITFALLS.md** — Domain pitfalls specific to model-driven debugging (false confidence, state explosion, over-constraint, refinement loops, regression cascades, noise inflation, performance); recovery strategies

### Secondary Sources (MEDIUM confidence)
- nForma codebase (v0.37): `/Users/jonathanborduas/code/QGSD/bin/formal-scope-scan.cjs` (lookup implementation), `.planning/formal/model-registry.json` (201 models), `.planning/formal/requirements.json` (371 requirements)
- Formal verification literature: APALACHE (symbolic model checking), TLC (bounded model checking), FLACK (counterexample-guided fault localization)
- Specification mining research: Seshia et al. (sparse coding for spec mining), CEGAR (counterexample-guided abstraction refinement)

### Tertiary (LOW confidence, needs validation)
- Predictive power metrics: Research on survivorship bias in formal verification (not extensively documented in production systems)
- Model refinement loop convergence: Literature exists, but automated closure in multi-model systems is not well-studied

---

*Research completed: 2026-03-17*
*Ready for roadmap planning: YES*
