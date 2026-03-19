# Pitfalls Research: Dual-Cycle Formal Reasoning Integration

**Domain:** Formal verification with dual-cycle diagnosis + solution simulation
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

Dual-cycle formal reasoning (Cycle 1: model-based diagnosis, Cycle 2: solution simulation) introduces six critical failure modes when integrated into existing model-driven-fix infrastructure:

1. **Consequence models trap diagnosis in narrow solution space** — Model generated from a single fix idea may miss alternative solutions or create false confidence that the fix is the only option
2. **Convergence oscillation between incompatible invariants** — Fix A satisfies invariant-1 but violates invariant-2; Fix B the reverse; system loops forever
3. **Uncontrolled model registry pollution** — Consequence models accumulate without lifecycle management, causing registry bloat and pollution of future bug-to-model lookups
4. **Intent-to-mutation translation fidelity breaks silently** — Natural language fix ideas translated to model mutations may express something subtly different from the intent, creating false negatives
5. **Integration with existing inverted semantics breaks** — Existing refinement-loop uses inverted semantics (violation = success); Cycle 2 must preserve this while adding new gate logic
6. **Regression prevention scope creep** — Proximity-based neighbor verification works at 2-hop distance, but can miss wider cross-model dependencies that consequence models introduce

These are not hypothetical: they emerge from the interaction between existing model structures (92+ persistent models, inverted verification semantics, 2-hop proximity edges) and new features (consequence models, solution iteration, automated gates).

---

## Critical Pitfalls

### Pitfall 1: Consequence Models Trap Diagnosis in Narrow Solution Space

**What goes wrong:**

A Cycle 2 consequence model is generated from ONE fix idea (e.g., "add retry logic"). It successfully demonstrates that this fix resolves the bug. System declares success and commits the fix — but a simpler solution existed (e.g., "remove race condition in lock acquisition"). The consequence model was never exercised against alternative fixes.

Alternatively: Consequence model is so permissive (captures only "bug must not happen") that it accepts ANY fix. Fix gets committed. Later, that fix breaks a non-obvious invariant in a neighbor model that Cycle 2 never consulted.

**Why it happens:**

- Consequence model generation is fix-specific: `generate_consequence_model(original_model, bug_context, fix_idea)`. The model encodes the fix's assumptions in its structure.
- No mechanism to compare across multiple fix ideas before committing.
- No oracle for "completeness" — system can't tell if consequence model is over-constrained (misses better solutions) or under-constrained (accepts broken solutions).
- Existing `/nf:debug` infrastructure (v0.38) already maps bugs to models semantically. Consequence models create a 1:1 mapping (bug → original model → consequence model → fix), which silences that semantic lookup.

**How to avoid:**

1. **Generate consequence models for ALL viable fix alternatives, not just the first one** (Phase 3 work):
   - Quorum worker produces 2-3 fix candidates, not 1
   - Cycle 2 generates consequence models for each
   - Convergence gate requires **mutual exclusivity check**: only 1 fix can simultaneously satisfy all original invariants + bug resolution. If multiple succeed, escalate to manual triage.

2. **Explicitly narrow consequence model scope** (Phase 2 work):
   - Tool contract: consequence models MUST specify delta constraint (only test the specific invariant change introduced by the fix)
   - Prevent models from specifying system-wide correctness
   - Add schema validation: consequence models must declare `base_model`, `fix_scope`, and `constrained_invariants` array

3. **Add consequence model lifecycle tracking** (Phase 4 work):
   - Tag consequence models with `created_for_bug_id`, `attempted_fix_ideas` (array of all alternatives), `decision_made_for` (which fix was selected)
   - When commit happens, mark consequence model with `committed_fix` and `outcome` (success/revert after X days)
   - Use outcome tracking to calibrate future consequence model generation (if consequence models for this bug-class have poor historical success rate, flag for human review)

**Warning signs:**

- Consequence model shows "all invariants hold" but accepts 3+ different fix ideas without distinguishing them
- Consequence model never rejects a proposed fix (100% pass rate on alternatives)
- Fix is committed without evidence of why it was chosen over other candidates
- Neighbor models (2-hop proximity) start failing AFTER fix is committed but consequence model passed

**Phase to address:**

- **Phase 2 (Consequence Model Design):** Establish tool contracts requiring multi-candidate generation, scope declaration, and mutual exclusivity checking
- **Phase 3 (Solution Simulation Loop):** Implement consequence model generation for multiple fix ideas, comparison logic, and triage escalation
- **Phase 4 (Convergence Gates):** Add outcome tracking and historical validation (did previous consequence models for this bug-class actually prevent regressions?)

---

### Pitfall 2: Convergence Oscillation Between Incompatible Invariants

**What goes wrong:**

Cycle 2 iteration 1: Quorum worker proposes fix-A. Consequence model simulates fix-A against original invariants. Invariant-1 holds, Invariant-2 violated. Gate rejects, asks for revision.

Iteration 2: Quorum worker proposes fix-B (attempting to satisfy invariant-2). Consequence model simulates fix-B. Invariant-2 now holds, Invariant-1 violated. Gate rejects again.

Iteration 3: Fix-C proposed, same oscillation. System never converges. User hits iteration limit (default 3) with no solution. Or: System converges on a patch that satisfies neither invariant cleanly but is "close enough" (false negative).

**Why it happens:**

- Original invariants were extracted from formal models that may embody conflicting assumptions about system behavior
- No analysis of invariant compatibility before Cycle 2 starts
- Convergence gate logic: `all invariants hold AND bug not triggered AND no neighbor regressions` treats all invariants as equal priority, but some may be in genuine conflict
- Existing code (solve-cycle-detector.cjs) detects oscillation in layer residuals, but consequence models introduce a new oscillation path: invariant-satisfaction oscillation within a single model

**How to avoid:**

1. **Pre-flight invariant compatibility check** (Phase 1 work):
   - When Cycle 2 starts, generate a "mutual satisfiability model" that tests all original invariants together
   - If mutual satisfiability fails, flag invariants as `conflicting` and require manual ordering/prioritization
   - Tool output: `{ invariants: [...], conflicting_pairs: [ { a, b, reason } ], resolution_required: boolean }`

2. **Invariant priority ordering** (Phase 2 work):
   - If conflict detected, require quorum to establish invariant priority order (e.g., safety > liveness, or bug-fix requirement > performance constraint)
   - Store priority in consequence model schema: `invariant_order: [ "safety", "liveness", "performance" ]`
   - Update convergence gate to: satisfy all safety invariants > all liveness > all performance (lexicographic rather than boolean AND)

3. **Oscillation detection with layer exclusion** (Phase 3 work):
   - Reuse existing solve-cycle-detector.cjs pattern but adapted for invariants:
   - Track per-iteration which invariants were violated
   - Detect A-B-A-B pattern: iteration 1 violates {inv-2}, iteration 2 violates {inv-1}, iteration 3 violates {inv-2} again
   - After 2 full cycles (4 iterations showing same alternation), escalate to manual intervention: "invariants appear incompatible"

4. **Consequence model as compatibility oracle** (Phase 3 work):
   - Generate a "witness consequence model" that encodes one invariant as PRIMARY and tests if secondary invariants can coexist
   - Run TLC/Alloy on witness model: `find a trace where (PRIMARY invariant holds AND secondary-1 holds AND ... AND secondary-N holds AND bug resolved)`
   - If witness model has 0 solutions after 5s TLC run, invariants are genuinely incompatible → escalate

**Warning signs:**

- Convergence gate report shows alternating violated invariants across iterations (iteration 1: inv-2 fails, iteration 2: inv-1 fails, iteration 3: inv-2 fails)
- Iteration limit (default 3) hit, oscillation detected but not resolved
- Same quorum worker proposing fundamentally different fixes (suggests worker is thrashing)
- Consequence model timeout (TLC doesn't complete in 10s) when testing late-iteration fixes

**Phase to address:**

- **Phase 1 (Diagnostic Reframing):** Add invariant compatibility pre-check before Cycle 2 starts
- **Phase 2 (Consequence Model Design):** Define invariant priority ordering and require it in model schema
- **Phase 3 (Solution Simulation Loop):** Implement oscillation detection adapted from layer residual pattern, add witness model generation, escalation logic
- **Phase 4 (Convergence Gates):** Update gate logic from boolean AND to lexicographic priority, integrate compatibility oracle feedback

---

### Pitfall 3: Uncontrolled Model Registry Pollution

**What goes wrong:**

Each run of Cycle 2 generates a consequence model: `.planning/formal/models/consequence-<bug-id>-<fix-attempt-N>.tla`. After 100 bug-fix sessions, registry contains 200-300 consequence models. Registry size grows 3x in 6 months. Subsequent bug-to-model lookups (step A.3 of model-driven-fix) now search through 300+ models, causing:

- Semantic lookup slowness (formal-scope-scan.cjs takes 30s instead of 5s)
- False positives: new bugs semantically match old consequence models that are obsolete (bug was already fixed, consequence model is dead weight)
- Registry pollution masks signal: real persistent bugs are buried among one-off consequence models

**Why it happens:**

- Consequence models are valuable for a specific Cycle 2 session but worthless after fix is committed (or after 1 week if never used)
- No lifecycle management: no versioning, no TTL, no archival
- Existing model-registry.json tracks all 92+ persistent models, but has no distinction between "system invariants" (permanent) vs. "session-temporary" (consequence models)
- Adding consequence models to registry increases version churn, makes git history noisy

**How to avoid:**

1. **Separate consequence model storage** (Phase 1 work):
   - Do NOT add consequence models to `.planning/formal/models/` or model-registry.json
   - Instead: `.planning/formal/sessions/<session-id>/consequence-models/`
   - Each Cycle 2 session gets its own directory; session archival automatically cleans up old consequence models
   - Tool contract: consequence model paths are session-scoped and temporary

2. **Add lifecycle tagging to consequence models** (Phase 2 work):
   - Schema: `{ created_at, session_id, bug_id, fix_attempted, outcome, expires_at }`
   - Default TTL: 7 days from creation. If fix was committed, set to "never expires, archive after 30 days"
   - Archival script: move old consequence models to `.planning/formal/archived/` with manifest

3. **Registry cleanup gate** (Phase 3 work):
   - After each Cycle 2 convergence (whether success or failure), check registry for orphaned consequence models:
     - Consequence model points to a bug that was fixed → archive it
     - Consequence model TTL expired → archive it
   - Registry maintenance runs on `/nf:solve` completion, logs cleanup actions

4. **Distinguish consequence models in semantic lookup** (Phase 4 work):
   - Update formal-scope-scan.cjs to accept `--exclude-consequence-models` flag
   - Default: exclude consequence models from bug-to-model lookup (they're session-temporary, not persistent knowledge)
   - Preserve them for post-hoc analysis (debug how the fix was found) but don't use them as diagnosis oracles for future bugs

**Warning signs:**

- model-registry.json grows 50+ entries per week and doesn't shrink
- formal-scope-scan.cjs reports 200+ models found for a single bug query (high false-positive rate)
- Session directory `.planning/formal/sessions/` has 50+ subdirectories, each with consequence models, totaling 1000+ files
- Git commits to model-registry.json happen multiple times per day (high churn)
- Consequence models have same parent model but only differ in minor constraint tweaks (suggests no governance)

**Phase to address:**

- **Phase 1 (Diagnostic Reframing):** Establish consequence model storage outside main registry
- **Phase 2 (Consequence Model Design):** Add lifecycle metadata and TTL schema
- **Phase 3 (Solution Simulation Loop):** Implement archival script and registry cleanup gate
- **Phase 4 (Convergence Gates):** Integrate consequence model exclusion into semantic lookup, add diagnostic flags

---

### Pitfall 4: Intent-to-Mutation Translation Fidelity Breaks Silently

**What goes wrong:**

Quorum worker writes: "Add a mutex lock before the critical section to prevent race condition." Cycle 2 translation layer converts this to a model mutation. But the translation is subtle:

- Intent: "Acquire lock, execute critical section, release lock — atomically"
- Translation: Model adds a `locked` boolean flag that gets set to true at the start of critical section
- Missing from translation: Lock release semantics (flag never gets reset to false)
- Result: Consequence model shows "no race condition possible" (vacuously true — critical section never executes after first lock)
- Fix gets committed: code now deadlocks
- User discovers bug in production, not in consequence model

**Why it happens:**

- Natural language is ambiguous about temporal/causal ordering: "before" can mean logical order or happens-before timing
- Model mutations operate on formal semantics (state transitions, invariants) which are lower-level than fix intent
- No intermediate representation to check translation fidelity — goes straight from NLP output to TLA+ mutation
- Existing code has no "translation validation" step; translation is a one-way operation
- Consequence model may pass TLC/Alloy (checker finds model sound) but for the wrong reasons (vacuous success)

**How to avoid:**

1. **Require explicit mutation description** (Phase 2 work):
   - Before translation to TLA+, have quorum worker provide explicit mutation pseudo-code with before/after state
   - Tool validates that mutation is syntactically complete (doesn't leave system in inconsistent state)
   - Schema: `{ mutation_steps: [ { action, pre_condition, post_condition } ], completeness_check: "pass"|"fail" }`

2. **Add bidirectional translation layer** (Phase 2 work):
   - Model mutation → English summary (reverse translation): "Model will acquire lock, hold it, then release it. Lock prevents concurrent entry to critical section."
   - Compare against original fix intent
   - If reverse translation diverges significantly from intent, flag for manual review before TLC run
   - Use Haiku to score alignment: "Does this English summary match the original fix intent?" → 0.0-1.0 confidence

3. **Add vacuous success detection** (Phase 3 work):
   - After TLC/Alloy completes successfully on consequence model, run post-check:
   - Count how many times the critical mutation actually executes in the counterexample trace (if any)
   - If mutation never executes (e.g., loop runs 0 times, flag never toggles), report VACUOUS: "Model passed but mutation never triggered"
   - Require that consequence model passes TLC AND shows the mutation in >50% of system states, not just 1 corner case

4. **Add adversarial testing** (Phase 3 work):
   - Generate a second "negative consequence model" that deliberately encodes the WRONG version of the fix
   - E.g., if fix is "add lock", negative model adds lock but never releases it
   - Run TLC on negative model: should find a violation (deadlock)
   - If negative model ALSO passes (or has same success signature), consequence model is not sufficiently specific → reject and ask for refinement

**Warning signs:**

- Consequence model passes but code-level fix is trivial/different from what model tested
- Reverse translation (model mutation → English) doesn't mention key elements from original fix intent
- TLC output shows 0 transitions for the mutated variable
- Same fix idea tested in multiple consequence models produces inconsistent results (one passes, one fails)
- Bug recurs after fix is committed, but consequence model showed bug resolved

**Phase to address:**

- **Phase 2 (Consequence Model Design):** Establish explicit mutation pseudo-code requirement, reverse translation validation, vacuous success detection
- **Phase 3 (Solution Simulation Loop):** Implement alignment scoring, negative model generation, adversarial testing
- **Phase 4 (Convergence Gates):** Add reverse-translation fidelity as convergence gate criterion (not just "invariants hold")

---

### Pitfall 5: Integration with Existing Inverted Semantics Breaks

**What goes wrong:**

Existing refinement-loop.cjs (v0.38, from model-driven-fix phase 3) uses INVERTED verification semantics:
- When `--bug-context` is provided, model checker error = SUCCESS (model reproduces bug)
- Model checker pass = FAILURE (model doesn't capture bug)

Cycle 2 adds consequence models, which use NORMAL verification semantics:
- Model checker error (invariant violated) = FAILURE
- Model checker pass = SUCCESS

System has two models in play with contradictory semantics. Integration point: After Cycle 2 fixes the bug, system needs to FLIP semantics: consequence model should now use NORMAL semantics (fix should NOT trigger the bug). But if original model is still using inverted semantics with the same bug-context, the two models are now testing opposite things.

Decision gates contradict each other. Fix gets rejected even though it works.

**Why it happens:**

- refinement-loop.cjs was designed for Phase 3: refine a model until it reproduces a known bug (inverted)
- Cycle 2 introduces solution simulation: verify that a fix ELIMINATES the bug (normal)
- These are incompatible semantic frameworks
- No mechanism to flip semantics mid-workflow or to distinguish "model-validation-phase" (inverted) from "fix-validation-phase" (normal)
- Existing gate logic doesn't distinguish between the two contexts

**How to avoid:**

1. **Explicit semantic mode tag** (Phase 1 work):
   - Add `verification_mode: "inverted" | "normal"` to all model checker invocations
   - Tool contract: every model run declares which semantics it's using
   - `run-tlc.cjs --spec X.tla --mode normal` vs. `run-tlc.cjs --spec X.tla --mode inverted --bug-context "race condition"`
   - Update refinement-loop.cjs to always pass `--mode inverted`

2. **Consequence model auto-mode detection** (Phase 2 work):
   - When generating consequence model from original model + fix idea, automatically set `verification_mode: normal`
   - Consequence model inherits bug-context from original model, but inverts the gate logic:
     - Normal semantics: bug MUST NOT trigger (pass = model shows fix works)
     - Inverted semantics: bug MUST trigger (fail = model shows fix is incomplete)
   - Tool generates consequence model with mode auto-set; no manual override possible

3. **Separate gate logic per mode** (Phase 3 work):
   - Convergence gate logic becomes:
     ```
     IF mode = inverted:
       requirement = "violation found" (bug reproduced)
     ELSE IF mode = normal:
       requirement = "no violation found" (bug not triggered, invariants hold)
     ```
   - Update gate evaluation to check mode tag before evaluating outcome
   - Add schema validation: gates MUST check verification_mode first

4. **Add integration tests for mode flipping** (Phase 4 work):
   - Test suite: same bug, tested under inverted semantics (model refines until bug shows), then under normal semantics (consequence model verifies fix eliminates bug)
   - Both models tested in same Cycle 2 session; gates should not contradict
   - Test: if inverted-mode shows "violation found", then normal-mode should show "no violation" with same fix applied

**Warning signs:**

- Gate report shows contradictory results: "Original model: violation found (success), Consequence model: no violation (success)" — both marked success is impossible
- Refinement loop shows "bug reproduced" (inverted success), but Cycle 2 convergence shows "bug still triggered" (normal failure) — contradicts
- Same model run shows different interpretation depending on which gate reads it
- Fix gets committed after Cycle 2 passes, but test suite still shows bug present (inverted model didn't see fix)

**Phase to address:**

- **Phase 1 (Diagnostic Reframing):** Add verification_mode tag to all model checker contracts
- **Phase 2 (Consequence Model Design):** Auto-detect and set consequence model mode, update gate logic to check mode
- **Phase 3 (Solution Simulation Loop):** Implement mode-aware gate evaluation, fix semantic mode flipping
- **Phase 4 (Convergence Gates):** Add integration tests validating that inverted + normal semantics don't contradict

---

### Pitfall 6: Regression Prevention Scope Creep

**What goes wrong:**

Existing regression prevention (v0.38) uses 2-hop proximity-neighbor verification: after a fix is decided, system queries neighbor models within 2 hops (shared concepts, source files, invariants). System then runs those neighbors' invariants against consequence model to ensure no regressions.

But consequence models introduce wider dependencies:

- Original bug is in component A, fix affects component A's interface with component B
- 2-hop neighbors might include component C (which uses B)
- But consequence model also introduces constraint that transitively affects component D (via B→C→D)
- Component D's invariant model (4+ hops away in original proximity graph) is NOT checked, so regression is missed
- Fix commits, component D fails in production

Alternative: scope creep in the other direction. To be "safe," regression check expands from 2-hop to include ALL transitive dependencies. System runs 200+ invariant models. Cycle 2 now takes 5 minutes per iteration (was 5 seconds). Iteration limit is hit because timeout, not because convergence failed.

**Why it happens:**

- Consequence models change the system's dependency graph dynamically (they embed constraints from ONE fix attempt)
- Existing proximity graph is static and pre-computed (built at model-registry generation time)
- No mechanism to update proximity edges when consequence model introduces new constraints
- Regression prevention hard-coded to 2-hop distance; no way to tune for consequence models
- No cost/benefit analysis: what's the real regression risk at 3+ hops? Is it worth 100x slowdown?

**How to avoid:**

1. **Consequence model dependency analysis** (Phase 2 work):
   - Tool extracts dependency analysis from consequence model mutation:
     - What variables does mutation touch?
     - What invariants mention those variables?
     - What other models define those invariants?
   - Output: `consequence_impacts: { direct_vars, affected_invariants, transitively_impacted_models }`
   - Use this to dynamically expand the neighbor set beyond static 2-hop

2. **Intelligent neighbor selection** (Phase 3 work):
   - Instead of: "check all 2-hop neighbors"
   - New approach: "check 2-hop neighbors PLUS any models that share transitively-impacted invariants"
   - Query consequence model impacts + proximity index to compute smart neighbor set
   - Result: regression check targets models that actually care about the fix's constraints

3. **Performance budget per Cycle 2 iteration** (Phase 3 work):
   - Convergence gate has timeout: regression check must complete in < 5 seconds
   - If neighbor set grows too large, automatically tier into quick-check (core neighbors) + deferred-check (distant neighbors)
   - Quick-check gates convergence; deferred-check runs post-commit as validation (can be async)
   - Report: "Regression check complete for 8 core neighbors (5s). 12 distant neighbors queued for post-commit validation."

4. **Scope validation** (Phase 4 work):
   - Add gate criterion: "regression check neighbor count must not exceed 3x baseline (2-hop count)"
   - If consequence model is so wide-reaching that it requires checking 50+ neighbors, flag as "systemic change" and require manual review
   - Systemic changes bypass automated convergence; require explicit user approval

**Warning signs:**

- Regression check runs on 50+ models (10x more than baseline 2-5 models)
- Cycle 2 iteration time grows from 5s to 60s+ (slowdown suggests expanding neighbor set)
- Consequence model specifies constraints on variables not mentioned in original bug description (scope creep)
- Fix is committed, but different bug recurs in an unrelated component 2 weeks later (missed regression)
- Gate reports "timeout" for regression check (iterating up to 50 models took > 5s)

**Phase to address:**

- **Phase 2 (Consequence Model Design):** Add consequence model dependency analysis, extract transitively-impacted models
- **Phase 3 (Solution Simulation Loop):** Implement intelligent neighbor selection, tier regression checks by performance budget
- **Phase 4 (Convergence Gates):** Add scope validation gate, systemic change detection, post-commit validation for deferred checks

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| **Single fix candidate per iteration** | Faster to generate (quorum produces 1 fix, not 3) | Narrows solution space, may miss better fixes, creates false confidence | Only acceptable for MVP (Cycle 2 Phase 3); must switch to multi-candidate before shipping |
| **Consequence model stored in main registry** | Simpler implementation (one place for all models) | Registry pollution, semantic lookup failures, git churn, hard to distinguish persistent vs. temporary | Never acceptable; adds 100+ models per week within 6 months |
| **Skip vacuous success detection** | Saves 1-2s TLC runtime per fix | Silent failures, false negatives where mutation never actually executes | Never acceptable; risk of committed fixes that don't actually work |
| **Ignore invariant compatibility pre-check** | Saves 1 pre-flight TLC run (5s) | Convergence oscillation, iteration limit hit without resolution, user frustration | Only acceptable for MVP; must add compatibility check before Phase 3 |
| **Use static 2-hop proximity for regression check** | No dynamic analysis needed, consistent runtime | Missed regressions in distant models, scope creep if widened, false confidence | Only with consequence model dependency analysis (Phase 2); otherwise false negatives |
| **No lifecycle tracking for consequence models** | Less metadata to track | Impossible to correlate outcome with model quality, prevent repetition of bad patterns | Never acceptable; minimal cost (5 fields), huge diagnostic value |

---

## Integration Gotchas

Common mistakes when connecting dual-cycle reasoning to existing model-driven-fix workflow.

| Integration Point | Common Mistake | Correct Approach |
|---|---|---|
| **Phase 3 exit criteria** | Use same convergence gate as Phase 2 (inverted semantics) | Create new gate for Phase 3 (normal semantics: bug must NOT trigger, invariants must hold). Do NOT reuse Phase 2 gate. |
| **Consequence model registration** | Add to model-registry.json and git commit | Store in session temp directory; clean up after session ends. Exclude from bug-to-model semantic lookup (formal-scope-scan --exclude-consequence-models). |
| **Neighbor regression check** | Assume static 2-hop neighbors suffice for consequence models | Analyze consequence model mutations to identify transitively-impacted models. Expand neighbor set dynamically based on mutation analysis. |
| **Translation validation** | Skip reverse translation (model mutation → English). Assume TLC pass means correctness. | Require explicit reverse translation + alignment score. Detect vacuous success (mutation never executes). Run adversarial negative model. |
| **Invariant compatibility** | Test invariants one-at-a-time in convergence gate | Generate mutual satisfiability model pre-flight. If conflict detected, establish priority ordering before Cycle 2 starts. |
| **Iteration limit exceeded** | Treat as "user hit limit, give up" | Analyze oscillation pattern: are invariants conflicting? Does consequence model need narrower scope? Escalate to manual triage. |
| **Fix commit decision** | Use consequence model pass as 100% oracle | Consequence model pass = necessary but not sufficient. Require: (pass + no regression + intent translation confidence > 0.8 + outcome tracking enabled). |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Model registry linear search** | formal-scope-scan takes 5s for 50 models, 30s for 300 models | Exclude consequence models from registry (session-temp). Build semantic index (embedding + kNN lookup) for bug-to-model matching. | > 200 persistent + consequence models (happens within 3 months at 100 bug-fix sessions/month) |
| **Per-iteration TLC timeout** | Iteration 1: 2s, Iteration 2: 4s, Iteration 3: 8s. No visible reason. | TLC state space grows with iteration count (more constraints accumulate in model). Set hard timeout (5s). If timeout, escalate to narrower scope or manual intervention. | After 3-4 iterations on complex models with >100 state vars. |
| **Neighbor regression check unbounded growth** | 2 neighbors (baseline) → 8 neighbors (iteration 2) → 50 neighbors (iteration 4). Regression check now takes 60s. | Cap neighbor set by performance budget (must complete in 5s). Tier into quick + deferred checks. Set max neighbors = 3x baseline. | After 5-10 consequence model refinements, if model is systemically coupled to many others. |
| **Consequence model accumulation** | Session 1: 5 consequence models. Session 2: 15 total. After 20 sessions: 500+ models. | Implement lifecycle management: 7-day TTL for unused, archive on fix commit or failure. Cleanup gate runs after each Cycle 2 session. | After 50+ bug-fix sessions (normal rate for active codebase). |
| **Oscillation detection threshold** | System detects oscillation after 6 iterations (A-B-A-B-A-B). But iteration limit is 3. Oscillation never detected. | Lower detection threshold: detect after 4 points (2 full cycles). Or: dynamically extend iteration limit if oscillation pattern emerges (with cap at 10). | Invariant incompatibility scenarios where fix alternates between satisfying inv-1 vs. inv-2. |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Consequence model generation:** Often missing — specification of which fix idea it tests, multi-candidate comparison, and mutual exclusivity check. Verify tool output includes `fix_ideas_tested: [...]` and `mutual_exclusivity_analysis: true|false`.

- [ ] **Convergence gate:** Often missing — vacuous success detection and intent translation fidelity check. Verify gate checks: (inverted semantics detection + reverse translation alignment + mutation execution count > 50% + no timeout + regression clear).

- [ ] **Neighbor regression check:** Often missing — dynamic analysis of consequence model impacts. Verify tool output includes `transitively_impacted_models: [...]` and `smart_neighbor_set_size` (should be 2-3x baseline, not 10x).

- [ ] **Invariant compatibility analysis:** Often missing — pre-flight check or escalation when conflict detected. Verify Phase 1 runs mutual satisfiability test and stores result in consequence model metadata.

- [ ] **Lifecycle tracking:** Often missing — no way to correlate outcome (did fix actually prevent the bug long-term?) with consequence model quality. Verify all consequence models have `created_at, session_id, outcome, expires_at` fields and are queryable.

- [ ] **Oscillation detection integration:** Often missing — detection works but escalation path unclear. Verify system clearly identifies oscillation cause (incompatible invariants vs. fix-attempt thrashing), logs it, and requires manual triage.

- [ ] **Mode semantics integration:** Often missing — consequence model uses normal semantics but system still interprets gates under inverted semantics. Verify every model run has `verification_mode` tag and gates check it before evaluation.

- [ ] **Intention fidelity validation:** Often missing — no reverse translation or adversarial testing. Verify quorum worker output includes explicit mutation pseudo-code, reverse translation is scored, and negative consequence model is generated and passes/fails consistently.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **Consequence model traps in narrow solution** | MEDIUM | (1) Generate consequence models for 2-3 other fix candidates. (2) Compare mutual exclusivity. (3) If multiple fixes pass, select manually or escalate. (4) Mark original fix as "chosen among alternatives" in outcome tracking. |
| **Convergence oscillation detected** | HIGH | (1) Run mutual satisfiability model on all invariants. (2) If conflict found, establish priority ordering (safety > liveness > performance). (3) Regenerate consequence model with constrained invariant set. (4) Resume Cycle 2 with prioritized gates. Or: escalate to manual fix design. |
| **Model registry pollution** | MEDIUM | (1) Archive old consequence models (> 7 days unused) to `.planning/formal/archived/`. (2) Regenerate model-registry.json, excluding archived models. (3) Rebuild semantic index. (4) Verify formal-scope-scan performance recovers. |
| **Intent fidelity failure (vacuous success)** | HIGH | (1) Extract counterexample trace from original model (pre-fix). (2) Manually verify consequence model's mutation executes on this trace. (3) If mutation never executes, model is vacuous. (4) Request quorum to refine mutation or provide explicit pseudo-code. (5) Regenerate consequence model. |
| **Inverted/normal semantics contradiction** | HIGH | (1) Identify which gate is using wrong semantics (check verification_mode tag). (2) Rerun model with correct mode tag. (3) Compare outcomes. (4) If still contradictory, escalate — semantics framework may have deeper issue. (5) Document resolution in gate log. |
| **Regression in distant models (missed by 2-hop)** | MEDIUM | (1) Post-mortem: which model failed? (2) Add that model to proximity-index.json edges for the fixed model (update proximity graph). (3) Rerun regression check with expanded neighbor set. (4) Did fix cause the regression? If yes, revert and redesign fix. If no, separate bug — triage separately. |
| **Iteration limit hit without convergence** | MEDIUM | (1) Analyze oscillation pattern: which invariants alternate? (2) Run mutual satisfiability check. (3) If incompatible, establish priority and narrow consequence model scope. (4) Reset iteration counter and retry. (5) If oscillation continues, escalate to manual fix design. |
| **Consequence model timeout (TLC doesn't complete)** | LOW | (1) Reduce model complexity: exclude non-essential constraints from consequence model. (2) Set smaller state space bound (e.g., smaller array sizes, fewer threads). (3) Rerun TLC with tighter timeout (3s instead of 5s). (4) If still timeout, model may be too ambitious — request simpler fix. |

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| **Phase 1: Diagnostic Reframing** | Invariant compatibility not pre-checked before Cycle 2 starts | Add mutual satisfiability pre-flight check. Output: conflict detection + priority ordering requirement. |
| **Phase 2: Consequence Model Design** | Single fix candidate, no multi-candidate comparison | Design for 3 fix candidates per iteration. Add consequence model generation for all. Require mutual exclusivity check. |
| **Phase 2: Consequence Model Design** | No distinction between "model must reproduce bug" (inverted) vs. "fix must eliminate bug" (normal) | Add verification_mode tag to all model invocations. Auto-detect for consequence models. Update gate logic to check mode. |
| **Phase 2: Consequence Model Design** | Consequence models stored in main registry, polluting it | Use session-scoped temp directory. Add lifecycle metadata. Exclude from semantic lookup. |
| **Phase 3: Solution Simulation Loop** | Vacuous success not detected (mutation never executes) | Add post-TLC check: mutation must execute in > 50% of states. Run adversarial negative model. |
| **Phase 3: Solution Simulation Loop** | Oscillation between invariants not detected or escalated | Implement invariant-oscillation detection (adapt solve-cycle-detector pattern). After 2 full cycles, escalate to manual triage. |
| **Phase 3: Solution Simulation Loop** | Regression check scope doesn't expand for consequence model impacts | Add consequence model dependency analysis. Dynamically expand neighbor set based on impacted invariants. Tier by performance budget. |
| **Phase 4: Convergence Gates** | Fix committed without intent translation validation | Gate must check: reverse translation alignment + no vacuous success + outcome tracking enabled. Not just "TLC passed." |
| **Phase 4: Convergence Gates** | Regression check neighbors not expanded for systemic changes | Gate must cap neighbor set (3x baseline) and escalate if exceeded. Detect systemic changes; require manual approval. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---|---|---|
| Consequence models trap in narrow solution | Phase 2 | (1) Test tool contract: consequence model generation accepts 3+ fix ideas, not 1. (2) Integration test: mutual exclusivity check rejects overlapping solutions. (3) Outcome tracking shows all alternatives attempted. |
| Convergence oscillation between invariants | Phase 1 + Phase 3 | (1) Pre-flight mutual satisfiability model runs without error. (2) If conflict detected, priority ordering is extracted. (3) Phase 3: A-B-A-B oscillation detected in invariant satisfaction. (4) E2E test: oscillation triggers escalation, not iteration limit. |
| Model registry pollution | Phase 2 + Phase 3 | (1) Consequence models do not appear in model-registry.json. (2) Session cleanup runs after Cycle 2 ends. (3) Archive validation: old consequence models are moved to `.planning/formal/archived/`. (4) Semantic lookup performance: formal-scope-scan completes in < 10s with 300+ total models. |
| Intent fidelity breaks silently | Phase 2 + Phase 3 | (1) Explicit mutation pseudo-code required in tool output (schema validation). (2) Reverse translation alignment score > 0.8. (3) Vacuous success detection flags if mutation executes < 50%. (4) Adversarial model generated and passes/fails consistently. (5) E2E: vacuous fix is rejected, not committed. |
| Inverted semantics integration breaks | Phase 1 + Phase 2 | (1) All model runs have verification_mode tag (unit test). (2) Consequence model auto-mode detection works (unit test). (3) Gates check mode before interpreting outcome (unit test). (4) E2E: inverted model passes, consequence model passes, no contradiction. (5) Same bug, same fix, flip from inverted to normal semantics — outcomes align. |
| Regression prevention scope creep | Phase 2 + Phase 3 | (1) Consequence model dependency analysis extracts transitively-impacted models. (2) Neighbor set expansion verified: should be 2-3x baseline, not 10x. (3) Performance budget enforced: regression check completes in < 5s. (4) Scope validation: systemically coupled fixes escalate to manual review. (5) E2E: post-commit validation of deferred neighbors completes async, no timeout. |

---

## Sources

### Primary Sources (High Confidence)

- **nForma PROJECT.md** — Detailed description of v0.38 (Model-Driven Debugging) and v0.39 (Dual-Cycle Formal Reasoning) requirements, scope, and design decisions
- **refinement-loop.cjs** — Existing inverted verification semantics implementation; source of integration complexity
- **solve-cycle-detector.cjs** — Existing A-B-A-B oscillation detection pattern; template for consequence model oscillation detection
- **resolve-proximity-neighbors.cjs** — Existing 2-hop proximity graph traversal; basis for regression prevention scope analysis
- **model-driven-fix.test.cjs** — Existing workflow tool contracts; guides consequence model tool contract design

### Domain Knowledge (from Code Review)

- **92+ persistent formal models** in `.planning/formal/` — Existing registry scale and maturity level
- **model-registry.json schema** — Metadata structure that consequence models MUST NOT pollute
- **Quorum dispatch architecture** — Multi-candidate fix generation already supported (providers.json, nf-solve.cjs); integration point for Phase 3
- **Inverted semantics in refinement-loop.cjs** — Fundamental conflict with normal Cycle 2 semantics; integration risk

### Observations (Medium Confidence)

- Oscillation detection in solve-cycle-detector.cjs uses layer-residual patterns; this can be adapted for invariant-satisfaction oscillation
- Consequence model lifecycle (7-day TTL, archive on fix commit) mirrors existing session management patterns in nForma
- Vacuous success detection is not implemented anywhere in current codebase; new concept, untested in context
- Invariant compatibility pre-checking is not in current formal verification pipeline; must be added explicitly

---

*Pitfalls research for: Dual-Cycle Formal Reasoning (Model Diagnostic Diffing + Solution Simulation Loops)*
*Researched: 2026-03-18*
