# Domain Pitfalls: Model-Driven Debugging

**Domain:** Adding model-driven debugging to existing formal verification system (nForma v0.38)
**Researched:** 2026-03-17
**Confidence:** MEDIUM (academic research + formal verification experience; limited production case studies for LLM-driven model-based debugging)

---

## Executive Summary

Adding model-driven debugging to nForma carries seven critical categories of risk. The most dangerous are **false confidence from model reproduction** (a model may reproduce symptoms without capturing root cause), **state space explosion under on-demand checking** (60-second timeout makes large state spaces unusable), and **over-constraint in fix space** (extracting too many constraints from models may eliminate valid fixes). Moderate risks include **model refinement loops that never converge**, **cross-model regression cascades**, and **B→F layer noise inflation**. All risks are preventable with structural gates and validation loops, but require explicit mitigation at design time—they cannot be patched after deployment.

---

## Critical Pitfalls

### Pitfall 1: False Confidence from Model Reproduction

**What goes wrong:** A formal model successfully reproduces the bug symptom (e.g., state X reaches when it shouldn't), and the team concludes the model explains the root cause. In reality, the model reproduces the *symptom* but not the *mechanism*. The actual root cause may be different — a race condition the model doesn't capture, a timing assumption the model makes incorrectly, or a cross-layer interaction the model abstracts away. Fixes applied based on the model work for the specific test case but fail in production or under different conditions.

**Why it happens:**
- Models are abstractions by design — they simplify reality
- Symptom reproduction feels like understanding but is only correlation
- LLM-generated models prioritize reachability (can we trigger this?) over mechanism (why does it happen this way?)
- Developers with 40+ formal models already running are tempted to trust model output more than is warranted
- A model that matches the symptom *looks correct* without deeper verification

**Example scenario:**
- Bug: "User sessions sometimes lose data under load"
- Model reproduces: "Session state can transition to LOST under concurrent updates"
- Team extracts fix: "Add lock to session updates"
- What the model missed: The real cause is garbage collection pausing the thread, not concurrency itself
- Result: Fix doesn't solve the problem; sessions still lose data under high GC pressure

**Consequences:**
- Shipping fixes that don't solve the root problem
- Wasted debugging effort (investigators trust the model when they shouldn't)
- False negatives in production (symptom goes away temporarily, root cause remains)
- Eroded confidence in the formal verification pipeline if fixes fail

**Prevention:**
- **Require root cause mechanism evidence, not symptom reproduction alone.** After model reproduction, mandate a separate investigation phase that explains *why* the model state is reachable
- **Run "negative verification":** If the fix is applied, does the model explicitly prove the bug state is unreachable? Or only that the symptom is harder to trigger?
- **Compare model claim to production traces.** Extract one production instance of the bug. Verify the model's proposed mechanism actually matches the trace timeline, not just the end state
- **Implement a "model-to-mechanism" gate** in /nf:debug flow: model reproduction → mechanism hypothesis → evidence gathering → constraint extraction → fix
- **Mark models that reproduce without mechanism understanding with a PROVISIONAL flag** in model-registry.json; don't let them gate production fixes until mechanism is verified

**Detection:**
- Fix ships; symptom resurfaces after 1–2 weeks (root cause still active)
- Model says "should be fixed" but production metrics unchanged
- Same symptom appears under different conditions (model was too specific to one trigger)
- Post-mortem reveals mechanism different from model prediction

---

### Pitfall 2: State Space Explosion on On-Demand Model Checking

**What goes wrong:** Debug flow invokes model checking on-demand with a 60-second timeout (debug responsiveness requirement). For large state spaces, the checker hits timeout before exploring meaningful paths. The result is either (a) false negatives (bug exists but model checker runs out of time to find it), or (b) timeouts treated as "model clean" when actually the space was too large. Repeated timeouts erode user confidence and slow down debugging.

**Why it happens:**
- nForma has 92+ formal models; many evolved to track complex system behavior
- Models with unbounded domains (e.g., AccountIds ∪ {NoAccount} with MaxPool=4 only as hint) have estimated HIGH risk for explosion
- On-demand invocation requires interactive response time; background verification can afford 5–15 minutes
- Symmetry reduction and abstraction were applied for batch mode; on-demand use case wasn't optimized
- User expectations: "check this model against the bug" should be instant, not "we timed out, sorry"

**Example scenario:**
- /nf:debug on a quorum dispatch bug
- Bug involves N concurrent workers racing; nForma models this with 4 worker slots
- Each slot can be in 6 states; transitions depend on message queue (unbounded), retry count (unbounded), timestamp (continuous)
- State space: 6^4 × unbounded × unbounded × unbounded = tens of millions of states
- On 60-second timeout: TLC explores 10M states, timeout fires
- Result: "Model check inconclusive" but user thinks "model says it's fine"

**Consequences:**
- Debug loop stalls (model checker timing out repeatedly)
- Users skip model consultation and debug ad-hoc instead
- False negatives: bugs exist but model checker didn't have time to find them
- Timeouts misinterpreted as "all clear" verdicts

**Prevention:**
- **Pre-flight state-space estimation in formal-scope-scan.cjs:** Before invoking model checker on-demand, estimate state space from CONSTANTS and unbounded domains. If > 1M states, don't invoke; instead return "model too large for on-demand checking, use formal registry for known properties"
- **Partition models into on-demand-safe and batch-only tiers:**
  - ON-DEMAND tier: estimated states ≤ 100K (verified via state-space-report.json, risk_level ≤ LOW)
  - BATCH tier: larger models, used in plan-phase and solve loops (300s timeout)
  - REGISTRY-ONLY tier: very large models, used for reference and manual analysis
- **Implement tiered checking strategy:**
  - First check: ultra-fast sanity (abstract model, 5s timeout, answers "obviously broken" only)
  - Second check: medium state space (concrete model, 30s timeout, answers most queries)
  - Third check: large state space (background, 300s timeout, used for formal gates)
- **Add timeout-specific response:** Instead of "inconclusive," return "Model too large for 60s timeout. Review formal registry for known properties covering this code."
- **Requirement: Solvers must guarantee response in time bound.** If timeout hit, return PARTIAL_RESULT with explored fraction (e.g., "checked 40% of state space, no bug found in explored region")

**Detection:**
- model-checker.log shows repeated TIMEOUT entries
- /nf:debug takes >45 seconds per invocation due to timeouts
- User explicitly asks "why did you time out?"
- solve-sessions show "model check inconclusive" on bugs that later appeared in production

---

### Pitfall 3: Constraint Over-Specification in Fix Space

**What goes wrong:** When extracting constraints from a formal model to guide a fix, the tool extracts too many constraints. The extracted set is sufficient to satisfy the model but excludes the actual valid fix. Example: model says "Session.state must never reach LOST," "concurrent updates must be serialized," and "GC pauses must not exceed 100ms." Extracting all three as constraints eliminates the real fix (which doesn't serialize updates but adds GC-aware checkpoints). Developer wastes time trying to satisfy impossible constraint combinations, or applies a fix that's overly complex because it satisfies over-extracted constraints.

**Why it happens:**
- Constraint extraction is often automated (parsing TLA+/Alloy specs to English rules)
- Parser extracts all reachable constraints without distinguishing core from auxiliary
- Developer doesn't know which constraints are essential vs. accidental to the model
- Over-extraction is "safer" (fewer bugs if you over-constrain) but blocks valid fixes
- No feedback loop: constraints extracted once, not validated against actual fix space

**Example scenario:**
- Model: Session state machine with 5 transitions, 3 invariants, 7 auxiliary predicates
- Constraint extraction tool returns: "session updates must be atomic," "session state must be validated on every read," "session timeout must be idempotent," "GC is not allowed during session transition"
- Developer reads constraints, thinks: "all 4 are core to the fix"
- Developer applies fix: acquires lock during all session operations
- Performance tanks; fix creates deadlock under load
- Root cause: Only 2 constraints were essential; the other 2 were model artifacts

**Consequences:**
- Fixes don't work because they can't satisfy impossible constraint combinations
- Fixes work but are unnecessarily complex or slow
- Over-constrained fixes create new bugs (deadlocks, performance regressions)
- Developer frustration: "Model said this was necessary but it made things worse"

**Prevention:**
- **Classify constraints by necessity level in extraction output.** For each extracted constraint, mark as CORE (required to prevent bug), AUXILIARY (used in proof but not essential), or ASSUMPTION (model assumption, may not hold in practice)
- **Implement constraint validation gate:** After fix is applied, formally verify (via model re-check) which extracted constraints were actually necessary. Document for future reference
- **Use sensitivity analysis on models.** Before extraction, vary one constraint at a time and re-check for the bug. Constraints whose variation doesn't change reachability are non-essential and shouldn't be extracted
- **Provide constraint source tracing.** For each extracted constraint, link to the TLA+/Alloy line that generated it. Developers can evaluate source context and decide if constraint applies to their fix
- **Limit extraction depth.** Don't extract ALL reachable constraints; extract a minimal set that ensures the bug is unreachable. Use model checking with constraint synthesis to find the minimal constraint set

**Detection:**
- Extracted constraint set has >5 constraints for a single-variable bug (suspicious over-specification)
- Developer explicitly asks "which of these constraints actually matter?"
- Applied fix satisfies all constraints but performance/behavior degrades
- Post-fix model re-check shows many extracted constraints were over-fitted to model

---

### Pitfall 4: Model Refinement Loops That Never Converge

**What goes wrong:** When a bug cannot be reproduced by any existing model, the /nf:debug flow spawns a refinement loop: create/refine a model to capture the failure mode. The loop iterates: run model, check if it reproduces the bug, if not, add details and try again. In practice, this loop can run indefinitely because (a) the model is being refined toward a symptom, not a mechanism (see Pitfall 1), (b) each refinement takes 5–15 minutes to run and verify, or (c) the model becomes so detailed it's no longer abstract and hits state space explosion.

**Why it happens:**
- Debugging without a model is slow; the team wants a model to guide the fix
- Creating models is expensive; refinement seems cheaper than starting over
- Each refinement seems productive ("now model includes X detail") but may not get closer to root cause
- No convergence criterion: when to stop refining and accept "model can't capture this"?
- Refinement based on symptom (model should reproduce symptom) not root cause (model should explain mechanism)

**Example scenario:**
- Bug: "Tests pass individually but fail when run in parallel"
- Iteration 1: Create model with 2 test tasks. Model doesn't reproduce failure.
- Iteration 2: Refine to 4 test tasks. Failure still doesn't reproduce.
- Iteration 3: Refine to add scheduler interaction. Model gets larger, still no failure.
- Iteration 4: Refine to include OS thread scheduling. Model is now too detailed, hits explosion.
- Iteration 5–8: Try different abstractions, none reproduce the parallel failure
- Team spends 3 days iterating; original bug still unfixed; model still doesn't capture it
- Real cause (found later): Incorrect lock release order, not covered by any model detail explored so far

**Consequences:**
- Time sink: refinement loop consumes 2–5 days per bug without resolution
- Abandoned models: Partial models created during refinement left in registry, cause confusion
- Fix delayed: While team refines model, bug remains in production
- False negatives: Team gives up on model; real root cause remains undiscovered

**Prevention:**
- **Implement iteration budget and convergence gate.** Allow maximum 2 model refinement iterations per bug. After 2 iterations, if model doesn't reproduce bug, STOP. Force manual root-cause investigation (see nf-debugger discipline)
- **Distinguish model refinement (mechanism) from symptom matching (outcome).** Require that each refinement must explain *why* the bug occurs, not just make it reachable. If model refinement is only making bug reachable without explaining cause, that's Pitfall 1; stop and investigate manually
- **Use existing model proximity as refinement guide.** Before creating new model, search model-registry.json for proximity matches. Refine the closest existing model instead of starting fresh. Limits refinement scope
- **Time-box refinement to 1 day total.** If model doesn't reproduce bug after 1 day of refinement work, abandon and switch to manual debugging
- **Require hypothesis confidence gate for each refinement iteration.** Before iterating, ask: "Are we confident the next refinement will reproduce the bug?" If <70% confidence, stop and investigate manually instead

**Detection:**
- Model refinement task in /nf:debug logs shows >3 iterations on same model
- Model created date in model-registry.json shows recent addition with low consecutive_pass_count
- Debug session spans >8 hours with model in "refining" status
- Multiple partial models in .planning/formal/tla/ with incomplete CFG files (signs of abandoned iterations)

---

### Pitfall 5: Cross-Model Regression Cascades

**What goes wrong:** A fix is validated against the directly-related formal model (e.g., Session state machine) and passes. But that model has dependencies on neighboring models (e.g., Concurrency model, GC model). The fix breaks an invariant in a neighbor model, causing that neighbor to fail. The team fixes the neighbor, which breaks its neighbor, and so on. What starts as a single-model fix triggers a cascade of regressions across the formal model graph.

**Why it happens:**
- nForma has a formal proximity index and cross-model decomposition analysis (v0.26)
- Models are not fully independent; they share assumptions, share variables, or verify related properties
- When a fix changes behavior in shared domain, it can ripple to neighbors
- Regression testing of all 92+ models takes time; testing is deferred to plan-phase, not done per fix
- Developer doesn't know which models are affected until full regression test runs

**Example scenario:**
- Bug in AccountManager: "Accounts sometimes not released from pool"
- Fix: "Add explicit cleanup call in release() method"
- Validates against AccountManager model: PASS ✓
- Validates against Concurrency model (models pool access patterns): FAIL ✗ (cleanup call not atomic)
- Developer fixes atomicity: PASS ✓
- Validates against TransactionBoundary model (depends on Concurrency atomicity guarantees): FAIL ✗ (atomicity changes transaction boundaries)
- Developer refines TransactionBoundary: PASS ✓
- Now 4 more neighbors fail
- Cascade: 1 original fix → 7 models updated → integration regression in cross-layer dashboard

**Consequences:**
- Fix balloons in scope: single bug fix touches 5–10 files across multiple models
- Time multiplier: each regression fix adds 2–3 hours
- Integration risk: cumulative changes may introduce new bugs
- Formal model trust erosion: if fixes keep breaking models, teams trust models less

**Prevention:**
- **Build pre-fix regression surface map.** Before applying fix, run formal-scope-scan.cjs with --proximity flag to identify all models that touch affected code. Pre-declare these as regression test targets
- **Implement cascade detection gate.** If fix causes >2 model regressions, STOP. Don't fix them incrementally. Instead, escalate to plan-phase for structured formal verification before applying fix
- **Require one-shot formal pre-verification.** Before committing fix, run TLC/Alloy on all proximity models with the fix code injected. If any model fails, reject the fix and require architectural change (e.g., fix is too invasive, breaks abstractions)
- **Add model isolation invariants.** For each formal model, document which other models it depends on. Dependency violations are caught immediately (integration test in formal layer)
- **Version model changes with fix.** When a fix updates neighbor models, record the fix commit hash in those models' comments. If fix is reverted, model changes are reverted too. Prevents orphaned model updates

**Detection:**
- solve-sessions show multiple model re-checks (>3) for a single fix commit
- model-registry.json shows consecutive_pass_count reset for multiple models on same day
- Formal verification logs show "cascade: N models updated as result of fix"
- fix commit adds/modifies >3 .planning/formal/*.tla files

---

### Pitfall 6: B→F Layer Noise Inflation in Solve Residual

**What goes wrong:** The B→F (Bug→Formal) layer is new in v0.38 and tracks bugs that formal models should explain but don't. In practice, this layer becomes a noise sink. Tests fail for reasons unrelated to formal model coverage (flaky network call, timing-sensitive test, environment variable missing). These failures get tagged as "formal gap" when they're actually test infrastructure problems. Solve loop spends cycles on false-positive formal remediation while real bugs go unaddressed. The residual grows because unrelated failures inflate B→F layer instead of being filtered as noise.

**Why it happens:**
- nForma's /nf:solve already has 18 residual layers, each finding different sources of failure
- B→F layer was added to track "bugs formal models can't explain yet"
- But test failures have many non-formal causes: flakiness, environment, test isolation
- No filtering between "legitimate formal gap" (model should cover this) vs. "test noise" (infrastructure problem)
- Developers assume all test failures are formal gaps without verifying
- No feedback: over time, B→F layer grows with noise but isn't actively cleaned

**Example scenario:**
- Test fails: "nf:solve doesn't converge after 3 iterations"
- Symptom: solve layer 5 (Gate B) can't find matching model for bug
- B→F layer marks: "Formal gap: Gate B can't cover concurrent slot worker timeout"
- Reality: Network was slow that run; slot actually timed out for unrelated reason
- Next solve cycle: Spends time trying to write a model for slot timeouts
- But the model is unnecessary; real fix is to add network resilience to quorum dispatch
- B→F layer now has 50+ entries; only 20% are actual formal gaps

**Consequences:**
- Solve cycle spends time on noise-driven formal remediation
- Solve residual doesn't reflect actual coverage gaps
- Model registry grows with models addressing test noise, not real bugs
- Developer loses signal: which solve failures are actually formal gaps?

**Prevention:**
- **Implement B→F noise filtering gate.** Before marking a test failure as "formal gap," run the test 5 times. If it passes ≥2 times, mark as FLAKY (noise), not FORMAL_GAP. Only persistent failures are B→F candidates
- **Require root-cause classification before B→F entry.** Is the failure due to model coverage (formal gap)? Or test isolation, timing, environment? Classify failures using the same rigor as /nf:debug. Only CONFIRMED formal gaps go into B→F layer
- **Implement B→F cleanup cycle.** Every 7 days, re-test all B→F entries to verify they're still legitimate gaps. Remove resolved or noise entries
- **Add formal-model-requirement traceability to B→F entries.** Each B→F entry links to which formal model SHOULD cover it. If no model exists, clarify: is this a new model we need to write? Or an infrastructure issue? Don't let entries accumulate without resolution plan
- **Implement B→F SLA.** B→F entries older than 30 days without a corresponding formal model are auto-closed as noise

**Detection:**
- B→F layer residual grows >20% per week
- B→F entries don't correspond to any formal model in model-registry.json
- Re-running same failing test multiple times shows >50% pass rate (indicates flakiness, not formal gap)
- solve-sessions show solve cycles with B→F remediation that don't reduce residual

---

## Moderate Pitfalls

### Pitfall 7: Performance Impact of Debug Responsiveness

**What goes wrong:** /nf:debug flow invokes formal-scope-scan.cjs and model consultation, adding latency. On-demand model checking (even for small models) takes 5–10 seconds per invocation. Over a 30-minute debugging session with 10 model consultations, 1–2 minutes of overhead is added. Users perceive /nf:debug as slow and start skipping model consultation entirely, reverting to ad-hoc debugging. Model pipeline becomes a rarely-used feature instead of a core part of the debug loop.

**Why it happens:**
- Formal model checking has inherent latency; TLC and Alloy analyzers don't run instantaneously
- v0.38 goal is to integrate models into /nf:debug, not to make them instant
- No explicit latency budget; model invocation happens on the critical path of /nf:debug
- JVM startup time (TLC/Alloy are Java) adds 2–3 seconds per invocation if not cached
- User expectations: /nf:debug should return in <10 seconds

**Prevention:**
- **Implement formal model caching.** Cache formal-scope-scan results for 10 minutes. If same bug is debugged twice within 10 minutes, reuse cached model list instead of rescanning
- **Pre-warm JVM for model checkers.** On /nf:debug startup, spawn background TLC/Alloy processes if not already running. Invocations reuse existing processes, cutting 2–3s startup
- **Implement optional model consultation.** /nf:debug runs without model consultation by default (fast path). Offer --use-models flag for users who want model guidance and can afford latency
- **Latency budget for model consultation.** If model check exceeds 15s, return "model check taking longer than expected, skipping" and resume /nf:debug. Model results are advisory, not blocking
- **Measure and report latency.** In /nf:debug output, show time spent on model consultation (e.g., "Model query: 3.2s"). Make latency visible so teams can decide if model consultation is worth it

**Detection:**
- /nf:debug duration increases >10s after model consultation feature ships
- User feedback: "/nf:debug is slow now"
- Logs show repeated TIMEOUT_EXCEEDED for model invocations
- solve-sessions show model consultation being skipped or disabled

---

### Pitfall 8: Documentation and Communication of Model Precision

**What goes wrong:** Developers with 40+ formal models available assume high precision and treat model recommendations as gospel. But models are abstractions — some with coarse abstractions, some with simplifying assumptions. A model may be correct (internally consistent) but not applicable to the specific bug being debugged. Developers apply model-derived fixes that don't solve the problem because the model wasn't precise enough for the use case.

**Why it happens:**
- Model-registry.json includes metadata but not user-friendly precision assessments
- Layer maturity ratings exist (1-3) but don't directly map to "appropriate for this type of bug"
- LLM-generated models don't always include precision disclaimers
- Developers are busy; they read "model says fix X" without understanding model scope
- No visible "confidence" or "precision" metadata in /nf:debug output

**Prevention:**
- **Add precision field to model-registry.json.** For each model, include `precision_level: FINE | COARSE | EXPERIMENTAL`, documenting scope and limitations
- **Require precision justification.** For each model, document: "This model is precise for [type of bugs] but abstracts away [type of behavior]. Best for [use case]. Not recommended for [contraindication]"
- **Display precision in /nf:debug output.** When recommending a model, include a note: "Model precision: COARSE. This model is suitable for timing bugs but abstracts concurrency. Verify mechanism independently"
- **Implement model self-doubt mechanism.** If a model reproduces a bug but is marked COARSE or EXPERIMENTAL, /nf:debug should flag: "Model reproduction successful, but model precision is limited. Recommend manual verification of root cause"

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Ownership |
|---|---|---|---|
| **debug command integration** | Pitfall 2 (state explosion) + Pitfall 7 (performance) | Pre-flight state-space estimation; tiered checking (fast/medium/large) | Phase 1: Debug Integration |
| **constraint extraction** | Pitfall 3 (over-specification) | Constraint classification (CORE/AUXILIARY/ASSUMPTION); sensitivity analysis | Phase 2: Constraint Extraction |
| **model refinement loop** | Pitfall 4 (non-convergence) + Pitfall 1 (false confidence) | 2-iteration budget; mechanism-focused refinement; manual investigation fallback | Phase 2: Model Refinement |
| **B→F layer integration** | Pitfall 6 (noise inflation) | Flakiness filtering; formal-gap classification; cleanup cycle | Phase 3: Solve Integration |
| **cross-model validation** | Pitfall 5 (regression cascades) | Pre-fix regression mapping; one-shot formal pre-verification; dependency tracking | Phase 3: Solve Integration |
| **performance tuning** | Pitfall 7 (debug latency) | JVM caching; optional model consultation; latency budgeting | Phase 4: Performance |
| **documentation** | Pitfall 8 (precision illusion) | Model precision metadata; self-doubt mechanism; user education | Phase 4: Documentation |

---

## Integration Pitfalls (Higher-Level)

### Pitfall 9: Model-Debug Workflow Abandonment

**What goes wrong:** After v0.38 ships, the new model-driven debugging workflow isn't widely adopted. Instead of /nf:debug → model consultation → constrained fix, teams fall back to old patterns: /nf:debug → quorum-based root cause → ad-hoc fix. The formal models exist but aren't used. Investment in model-driven debugging infrastructure is wasted; models are maintained but not integrated into the actual debug loop.

**Prevention:**
- **Build integration tests that require model usage.** Unit tests should pass, but integration tests should verify that /nf:debug actually consults models and provides constraint output. If model consultation is skipped, integration test fails
- **Make model consultation part of the debug SLA.** If a debug session doesn't consult at least one model, flag as anomalous. Encourage users to use models
- **Track adoption metrics.** Log every model consultation in /nf:debug. Monthly reports show adoption rate. Low adoption triggers investigation into barriers

---

### Pitfall 10: False Security from Formal Models in Solve Loop

**What goes wrong:** Once model-driven debugging is integrated into /nf:solve, teams rely on formal models to catch all bugs. Over-confidence sets in: "If the model says it's fixed, it's fixed." But models don't cover all scenarios. Production issues emerge that formal models didn't catch, eroding confidence in the entire formal verification pipeline.

**Prevention:**
- **Maintain clear model scope documentation.** For each model, document what it covers and what it doesn't. Keep visible in solve output
- **Keep manual code review required.** Even after model passes, require code review. Models and code review are complementary, not alternatives
- **Implement production monitoring fallback.** If /nf:solve reports "model-verified fix," but production metrics don't improve, investigate immediately. Don't assume model was correct

---

## Pitfalls Requiring Research During Phases

| Pitfall | Research Needed | Timing | Owner |
|---|---|---|---|
| **Pitfall 1** (false confidence) | What evidence suffices to confirm a mechanism beyond symptom reproduction? | Phase 1 research | Debugging methodology expert |
| **Pitfall 2** (state explosion) | Which TLA+ models in nForma hit state-space explosion under 60s timeout? Profile actual performance | Phase 1 research | Formal methods engineer |
| **Pitfall 3** (over-specification) | What's the minimal constraint set to ensure bug unreachability? Does sensitivity analysis work? | Phase 2 research | Formal methods engineer |
| **Pitfall 4** (non-convergence) | How many iterations before we're confident model refinement won't yield results? | Phase 2 research | Debugger experience |
| **Pitfall 5** (cascades) | How tightly coupled are the 92+ models? What's the actual regression surface? | Phase 3 research | Architecture analysis |
| **Pitfall 6** (B→F noise) | What's the actual flakiness rate of nForma tests? Can we auto-classify noise? | Phase 3 research | Test infrastructure analysis |

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| **State space explosion risk** | HIGH | Academic literature is extensive; state explosion is well-documented pitfall in formal methods |
| **False confidence from model reproduction** | HIGH | Multiple sources confirm this risk; endemic to model-based debugging |
| **Over-specification in constraints** | MEDIUM | Research covers general case; nForma-specific analysis needed in Phase 2 |
| **Model refinement convergence** | MEDIUM | Risk is clear; mitigation strategies borrowed from iterative design; nForma specifics unknown |
| **Cascade regression risk** | MEDIUM-HIGH | Risk exists; unknown how tightly coupled nForma's 92+ models actually are |
| **B→F noise inflation** | MEDIUM | Risk is new to v0.38; depends on actual test flakiness rates; needs profiling |
| **Debug performance impact** | MEDIUM | Risk depends on actual TLC/Alloy performance; needs benchmarking |

---

## Key Dependencies

**Pitfall Mitigation Dependencies:**

```
Pitfall 1 (false confidence)
  ↓ depends on
  Pitfall 4 (refinement) & Pitfall 8 (documentation)

Pitfall 2 (state explosion)
  ↓ depends on
  Accurate state-space estimation (v0.34 formal-scope-scan)

Pitfall 3 (over-specification)
  ↓ depends on
  Constraint extraction tooling (Phase 2)

Pitfall 5 (cascades)
  ↓ depends on
  Proximity index quality (v0.26 analysis)

Pitfall 6 (B→F noise)
  ↓ depends on
  Flakiness classification in solve loop (needs research)

All pitfalls
  ↓ depend on
  Clear documentation of model precision (Phase 4)
```

---

## Recommendations for Roadmap Prioritization

**Critical path (must address before production):**
1. Pitfall 2 (state explosion) — Add state-space pre-flight estimation; implement tiered checking
2. Pitfall 1 (false confidence) — Implement mechanism-verification gate in debug flow
3. Pitfall 3 (over-specification) — Add constraint classification and sensitivity analysis

**Before end of Phase 3 (Solve Integration):**
4. Pitfall 5 (cascades) — Implement regression surface mapping; one-shot pre-verification
5. Pitfall 6 (B→F noise) — Implement flakiness filtering; B→F cleanup cycle
6. Pitfall 4 (non-convergence) — Implement iteration budget; mechanism-focused refinement

**Phase 4+ (Documentation & Polish):**
7. Pitfall 7 (performance) — JVM caching; optional model consultation; latency budgeting
8. Pitfall 8 (precision communication) — Add precision metadata; self-doubt mechanism
9. Pitfall 9 (workflow abandonment) — Integration tests; adoption metrics
10. Pitfall 10 (false security) — Scope documentation; production monitoring fallback

---

## Sources

- [Bridging Design Verification Gaps with Formal Verification](https://www.design-reuse.com/article/61616-bridging-design-verification-gaps-with-formal-verification/)
- [Model Checking: Algorithmic Verification and Debugging](https://www.researchgate.net/publication/220423326_Model_Checking_Algorithmic_Verification_and_Debugging)
- [Model Checking and the State Explosion Problem](https://www.researchgate.net/publication/289682092_Model_Checking_and_the_State_Explosion_Problem)
- [Model checking of spacecraft operational designs: a scalability analysis](https://link.springer.com/article/10.1007/s10270-025-01281-6)
- [Handling State Space Explosion in Component-based Systems](https://arxiv.org/pdf/1709.10379)
- [When Generated Tests Pass but Miss the Bug: A Case of False Confidence from AI Test Generation](https://dev.to/markk40123/when-generated-tests-pass-but-miss-the-bug-a-case-of-false-confidence-from-ai-test-generation-1674)
- [Using Formal Methods to Analyse Software Related Failures](https://www.dcs.gla.ac.uk/~johnson/papers/FME_Johnson_Keynote.PDF)
- [Debugging formal specifications using simple counterstrategies](https://www.researchgate.net/publication/224088972_Debugging_formal_specifications_using_simple_counterstrategies)
- [Don't over-constrain in formal property verification (FPV) flows](https://www.edn.com/dont-over-constrain-in-formal-property-verification-fpv-flows/)
- [On the Impact of Formal Verification on Software Development](https://ranjitjhala.github.io/static/oopsla25-formal.pdf)
- [Use of Formal Methods at Amazon Web Services](https://lamport.azurewebsites.net/tla/formal-methods-amazon.pdf)
- [Refinement Types for TLA+](https://www.cs.yale.edu/homes/vanzetto/pub/vanzetto-2014-Refinement_types_for_TLA+.pdf)
