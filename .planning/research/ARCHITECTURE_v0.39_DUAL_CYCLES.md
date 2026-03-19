# Dual-Cycle Formal Reasoning Architecture (v0.39)

**Project:** nForma v0.39 — Dual-Cycle Formal Reasoning
**Researched:** 2026-03-18
**Mode:** Architecture integration (existing v0.38 + new v0.39 features)
**Confidence:** HIGH

## Executive Summary

nForma v0.39 extends the existing 6-phase model-driven-fix workflow (v0.38) with two new diagnostic and solution capabilities:

1. **Cycle 1 (Diagnosis):** When a discovered/created model fails to reproduce a known bug, instead of blind refinement retry, generate a diagnostic diff showing "model assumes X but bug shows Y" to guide targeted model improvement.

2. **Cycle 2 (Solution Simulation):** Before touching code, test fix ideas (natural language descriptions, constraints, or code sketches) by normalizing them to model mutations, generating consequence models, and verifying all convergence gates (original invariants + bug resolved + no neighbor regressions) automatically.

Both cycles run in model space with formal verification gates, reducing code-level iteration. Cycle 1 integrates into Phase 2-3 (Reproduction/Refinement) as enhanced diagnostic feedback. Cycle 2 inserts as a new **Phase 4.5 (Solution Simulation)** between constraint extraction and constrained fix.

The architecture preserves the existing 6-phase orchestrator (`model-driven-fix.md`) and modular runner ecosystem, adding new modules for:
- Fix idea normalization (handling natural language, constraint syntax, code sketches)
- Consequence model generation (model mutation from normalized fix ideas)
- Convergence gate automation (invariant + bug + regression checks)
- Diagnostic diff generation (Cycle 1 feedback for model misalignment)

## Recommended Architecture

### Phase Integration Map

```
Existing v0.38 Model-Driven-Fix:
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Discovery      → Find existing models                  │
│ Phase 2: Reproduction   → Run checkers on existing models       │
│ Phase 3: Refinement     → Create/refine model (refinement-loop) │
│ Phase 4: Constraint     → Extract constraints (model-constrained)│
│ Phase 5: Constrained Fix → Apply constraints, verify neighbors   │
│ Phase 6: Pre-Verification → Verify fix resolves bug              │
└─────────────────────────────────────────────────────────────────┘
         ↓ Enhanced with v0.39 features ↓

Enhanced v0.39 with Dual Cycles:
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Discovery                                              │
│ Phase 2: Reproduction                                           │
│   ├─ (NEW) Cycle 1 Diagnostic: If model fails to reproduce,     │
│   │   generate "model assumes X but bug shows Y" feedback       │
│   └─ Guides Phase 3 refinement with specific corrections       │
│ Phase 3: Refinement (inverted verification loop)                │
│ Phase 4: Constraint Extraction                                  │
│ Phase 4.5: Solution Simulation (NEW — Cycle 2)                  │
│   ├─ Accept fix idea (natural language, constraints, sketches)  │
│   ├─ Normalize to model mutations                               │
│   ├─ Generate consequence model                                 │
│   ├─ Run convergence gates (automated)                          │
│   └─ Report: PASS (deploy code) | ITERATE | BLOCKED            │
│ Phase 5: Constrained Fix                                        │
│ Phase 6: Pre-Verification                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Input | Output | Existing? | New? |
|-----------|---|---|---|---|---|
| **model-driven-fix.md** | 6-phase orchestrator | bug description, flags | fix verdict | Yes | Enhanced |
| **refinement-loop.cjs** | Bug context normalization + inverted verification | model, bug context | reproducing model \| best-effort model | Yes | No change needed |
| **model-constrained-fix.cjs** | Extract constraints from model | model spec | constraint array | Yes | No change needed |
| **resolve-proximity-neighbors.cjs** | 2-hop BFS neighbor resolution | model ID | neighbors array | Yes | No change needed |
| **run-formal-verify.cjs** | Master formal verification runner | project root, scope | pass/fail matrix | Yes | No change needed |
| **run-tlc.cjs / run-alloy.cjs** | TLC/Alloy subprocess wrappers | model path, config | checker output, exit code | Yes | No change needed |
| **normalize-fix-idea.cjs** ← NEW | Fix idea type detection + normalization | raw fix idea (text/constraints/code) | { type, normalized_form, metadata } | — | Yes |
| **generate-consequence-model.cjs** ← NEW | Model mutation from normalized fix ideas | base model, mutation spec | consequence model file path | — | Yes |
| **convergence-gate.cjs** ← NEW | Automated invariant + bug + regression check | model, bug context, neighbors | { passed: bool, violations: [], summary } | — | Yes |
| **cycle1-diagnostic-diff.cjs** ← NEW | Generate "model assumes X but bug shows Y" | model output, expected bug behavior | diagnostic markdown | — | Yes |

### Data Flow: Cycle 1 (Diagnostic)

```
Phase 2 → "Existing models do not reproduce bug"
  ↓
Cycle 1: Generate Diagnostic Diff
  1. Extract model's final state from checker output
  2. Extract expected bug behavior from BUG_DESC
  3. Compare: "Model assumes X but bug shows Y"
  4. Save diagnostic to .planning/formal/cycle1-diagnostics/{BUG_ID}.md
  ↓
Output to user: "Model mismatch detected: {diagnostic summary}"
  ↓
Phase 3 Refinement receives diagnostic context
  - Guides spec generation toward the observed discrepancy
  - Improves chance of Phase 3 creating reproducing model on first attempt
```

**Integration:** Cycle 1 diagnostic runs AFTER Phase 2 reproduction check fails, BEFORE Phase 3 starts. It enhances the user's understanding of why the model doesn't match the bug without changing the workflow loop count.

### Data Flow: Cycle 2 (Solution Simulation)

```
Phase 4 → Extract constraints
  ↓
User proposes fix (via /nf:apply-fix or prompt)
  ↓
Phase 4.5: Solution Simulation (NEW)
  1. Normalize fix idea
     Input: "Change X to Y" | "{constraint}" | "code sketch"
     Output: { type: 'constraint' | 'narrative' | 'code', normalized }

  2. Generate consequence model
     Input: base model + mutation spec
     Output: consequence-model.tla / consequence-model.als

  3. Run convergence gates (automated, no user intervention)
     ├─ Invariant gate: All original invariants still hold
     ├─ Bug gate: Bug no longer triggered
     └─ Regression gate: No violations in 2-hop neighbors

  4. Report verdict
     ├─ PASS → "Safe to apply. Code fix aligns with model constraints."
     ├─ ITERATE → "Violation detected. Suggested refinement: {detail}"
     └─ BLOCKED → "Fundamental conflict. This approach incompatible with {invariant}."

  5. Save results to .planning/formal/cycle2-simulations/{BUG_ID}/{attempt_N}.json
     ↓
If PASS:
  → Proceed to Phase 5 (Constrained Fix) with confidence
If ITERATE:
  → User refines fix idea, repeat Step 1-4 (configurable iteration limit, default 3)
If BLOCKED:
  → Exit with error; user must rethink approach
```

**Integration:** Cycle 2 is a NEW Phase 4.5, inserted between Phase 4 (Constraint Extraction) and Phase 5 (Constrained Fix). It is **optional** — if `--skip-fix` or `--no-cycle2` provided, skip to Phase 5. The phase gates fix ideas before code is committed.

### Existing Module Touch Points

**No changes required to v0.38 modules; only additions:**

1. **model-driven-fix.md orchestrator**
   - Add Phase 2 post-check: If reproduction fails, call `cycle1-diagnostic-diff.cjs` with Cycle 1 mode
   - Add Phase 4.5: If user confirms fix idea, enter Cycle 2 simulation loop
   - Both are **gated by user confirmation or --auto-cycle flags**

2. **refinement-loop.cjs** (NO CHANGES)
   - Already handles bug context normalization (MRF-01)
   - Already inverts verification semantics (MRF-02)
   - Cycle 1 diagnostic is generated POST-refinement, not during
   - No code changes needed

3. **model-constrained-fix.cjs** (NO CHANGES)
   - Already extracts constraints
   - Cycle 2 accepts constraints as input (but also accepts natural language + code sketches)
   - No code changes needed

4. **run-formal-verify.cjs** (POSSIBLE ADDITION)
   - Already supports `--scope=ModelList` for neighbor verification
   - Cycle 2 convergence gates use same scoping mechanism
   - Minor addition: Accept `--cycle2-mode` flag to suppress some summary reporting
   - Existing behavior preserved for all other uses

## New Modules Required

### 1. normalize-fix-idea.cjs

**Purpose:** Detect and normalize fix ideas in 3 forms.

**Interface:**
```bash
node bin/normalize-fix-idea.cjs --idea="..." [--model=path] [--format json|text]
```

**Input Detection:**
- **Natural language:** "Change timeout to 100ms" → Extract entities, suggest model variable edits
- **Constraint syntax:** "{invariant SomeProperty}" → Parse, validate against model syntax
- **Code sketch:** "if (x > 5) { y = 0; }" → Suggest corresponding model state transition

**Output:**
```json
{
  "original_idea": "...",
  "detected_type": "natural_language" | "constraint" | "code_sketch",
  "normalized_form": {
    "type": "constraint" | "predicate",
    "statements": ["TLA+ / Alloy assignment(s)"],
    "applies_to": "state variable | transition | invariant",
    "confidence": 0.85
  },
  "suggested_correction": "If confidence < 0.7: ask user",
  "metadata": {
    "model_type": "tla" | "alloy",
    "affected_vars": ["x", "y"],
    "affects_invariants": ["SomeProperty"],
    "complexity": "low" | "medium" | "high"
  }
}
```

**Key Logic:**
- Try constraint parser first (TLA+ `=`, Alloy `in`)
- Fall back to code sketch parser if constraint fails
- Fall back to NLP entity extraction if code fails
- Return high-confidence normalized form or ask user for clarification

### 2. generate-consequence-model.cjs

**Purpose:** Apply a normalized fix idea to the base model, generating a consequence model.

**Interface:**
```bash
node bin/generate-consequence-model.cjs \
  --base-model=path/model.tla \
  --mutation-spec=normalized_json \
  --output=path/consequence.tla \
  [--formalism=tla|alloy]
```

**Process:**
1. Load base model (TLA+ or Alloy)
2. Parse normalized mutation spec
3. Apply mutation:
   - For **state variable changes:** update initial value / bounds
   - For **transition changes:** inject new condition / assignment
   - For **constraint changes:** modify invariant definition
4. Preserve all original invariants unchanged (they are gates)
5. Write consequence model to `--output`
6. Return mutation summary JSON

**Output:**
```json
{
  "base_model": "path/model.tla",
  "consequence_model": "path/consequence.tla",
  "mutation_summary": {
    "type": "state_variable_change" | "transition_change" | "constraint_addition",
    "affected_components": ["component_1", "..."],
    "new_invariants_injected": false,
    "original_invariants_preserved": true,
    "estimated_state_space_increase": 2.3
  }
}
```

**Key Logic:**
- Never modify existing invariants
- Only inject `Init`, state variables, or transition guards
- Preserve formalism (don't mix TLA+ with Alloy syntax)
- Validate model compiles before returning

### 3. convergence-gate.cjs

**Purpose:** Automated convergence check (replaces manual Phase 5b verification).

**Interface:**
```bash
node bin/convergence-gate.cjs \
  --consequence-model=path/model.tla \
  --bug-context="..." \
  --neighbors=CSV_SCOPE \
  [--verbose] [--format json|text]
```

**Gates (in order):**
1. **Invariant Gate:** All original invariants still hold on consequence model
   - Run checker: if any original invariant violated → FAIL
2. **Bug Gate:** Bug no longer triggered in consequence model
   - Check: Does the bug condition still evaluate true?
   - If condition still triggers → FAIL
3. **Regression Gate:** No violations in 2-hop neighbor models
   - Run scoped verification on neighbors
   - If any neighbor fails → WARN (fail-open unless `--strict`)

**Output:**
```json
{
  "consequence_model": "path/model.tla",
  "verdict": "PASS" | "ITERATE" | "BLOCKED",
  "gate_results": {
    "invariant_gate": {
      "passed": true | false,
      "violations": [{ "invariant": "Name", "trace": "..." }]
    },
    "bug_gate": {
      "passed": true | false,
      "detail": "Bug condition no longer triggered" | "..."
    },
    "regression_gate": {
      "passed": true | false,
      "neighbors_passed": 5,
      "neighbors_failed": 0,
      "failures": [{ "model": "neighbor_id", "violation": "..." }]
    }
  },
  "suggested_refinement": "if verdict === ITERATE: guidance for next mutation"
}
```

**Verdict Logic:**
- **PASS:** All 3 gates pass → Safe to apply
- **ITERATE:** Invariant or Bug gate fails → Suggest refinement (e.g., "Bug gate failed: condition X still true, try adding Y constraint")
- **BLOCKED:** Fundamental conflict detected (e.g., "Cannot satisfy bug gate without violating invariant Z") → User must restart

### 4. cycle1-diagnostic-diff.cjs

**Purpose:** Generate diagnostic feedback when a model fails to reproduce the bug.

**Interface:**
```bash
node bin/cycle1-diagnostic-diff.cjs \
  --model=path/model.tla \
  --bug-context="description" \
  --checker-output="...output from formal-scope-scan --run-checkers" \
  [--format md|json]
```

**Process:**
1. Extract model's final state from checker output (what the model found)
2. Extract expected bug behavior from BUG_DESC (what should happen)
3. Diff: "Model assumes {X} but bug shows {Y}"
4. Identify mismatch points (e.g., timing, state variable bounds, transition guard)
5. Suggest targeted fixes to the model spec

**Output:** `.planning/formal/cycle1-diagnostics/{BUG_ID}.md`

```markdown
## Cycle 1 Diagnostic: {BUG_TITLE}

**Model:** {path}
**Status:** Failed to reproduce (mismatch detected)

### What the Model Found
- Final state: {model's conclusion}
- Transition trace: {sequence}

### What the Bug Shows
- Expected failure: {bug description summary}
- Observed in: {affected code, production signal}

### Mismatch Analysis
| Aspect | Model | Reality | Suggestion |
|--------|-------|---------|-----------|
| Timeout value | 5000ms | 10000ms | Update model constant TIMEOUT = 10000 |
| State transition | immediate | delayed | Add delay predicate |

### Suggested Refinements
1. Change {variable} bounds from X to Y
2. Add {new invariant} to capture {missing constraint}
3. Verify {transition} timing against production
```

## Integration Points with v0.38

### 1. Phase 2 → Cycle 1 Diagnostic (NEW)

**Existing Phase 2 flow:**
```
Run checkers on existing models
├─ If reproduction found → Skip Phase 3, go to Phase 4
└─ If not reproduced → Proceed to Phase 3 (refinement)
```

**Enhanced Phase 2 with Cycle 1:**
```
Run checkers on existing models
├─ If reproduction found → Skip Phase 3, go to Phase 4
└─ If not reproduced →
    (NEW) Generate Cycle 1 diagnostic:
      node bin/cycle1-diagnostic-diff.cjs \
        --model=$MODEL \
        --bug-context="$BUG_DESC" \
        --checker-output="$CHECKER_OUTPUT"
    Display diagnostic to user
    Proceed to Phase 3 (refinement with diagnostic guidance)
```

**Code location:** model-driven-fix.md, Step 2 (Reproduction), after "not reproduced" branch

**User experience:** Instead of "model doesn't match, retrying blindly," user sees "model assumes timeout=5s but bug shows 10s timeout — update TIMEOUT constant"

### 2. Phase 4 → Phase 4.5 → Cycle 2 Solution Simulation (NEW)

**Existing Phase 4/5 flow:**
```
Phase 4: Extract constraints
Phase 5a: Present constraints
Phase 5b: Cross-model regression check
Phase 5c: Persist results
Phase 6: Pre-verification
```

**Enhanced flow with Cycle 2:**
```
Phase 4: Extract constraints
  ↓
(NEW) Phase 4.5: Solution Simulation (optional, gated by --cycle2 or user input)
  1. Prompt user for fix idea (unless --auto-fix provided)
     "Propose fix (natural language, constraint, or code sketch):"
  2. Loop (max 3 iterations, configurable via --max-iterations)
     a. normalize-fix-idea.cjs → normalized form
     b. generate-consequence-model.cjs → consequence model
     c. convergence-gate.cjs → PASS | ITERATE | BLOCKED
     d. If PASS → Proceed to Phase 5 with confidence note
        If ITERATE → Ask for refinement, repeat step 2a
        If BLOCKED → Exit with error message
  ↓
Phase 5a: Present constraints (now with Cycle 2 simulation verdict)
Phase 5b: Cross-model regression check
Phase 5c: Persist results
Phase 6: Pre-verification
```

**Code location:** model-driven-fix.md, NEW Phase 4.5 section (between Constraint Extraction and Constrained Fix)

**Data artifacts saved:**
- `.planning/formal/cycle2-simulations/{BUG_ID}/attempt_{N}.json` — Each iteration's normalized form, consequence model path, gate results
- `.planning/formal/consequence-models/{BUG_ID}-{ITERATION}.tla` — Generated consequence models

### 3. Constraint Integration

**Existing constraint usage (Phase 5a):**
```
Present to user as guidance text.
User applies fix manually or via other workflows.
```

**Enhanced with Cycle 2:**
```
Same constraints, but now ALSO:
- Accept constraints as input to Cycle 2 fix ideas
- User can say: "Apply constraint {name} as fix"
- Cycle 2 tests that constraint mutation in model space before code
- Increases confidence that constraint+code together resolve bug
```

## Suggested Build Order

### Wave 1: Diagnostic Foundation (Cycle 1 only)

**Goal:** Add diagnostic feedback to existing refinement loop without changing orchestrator logic.

1. **cycle1-diagnostic-diff.cjs** — Core diagnostic generation
   - Parses checker output (TLA+, Alloy, PRISM)
   - Extracts bug context from BUG_DESC
   - Generates markdown report
   - Dependencies: None (pure analysis)
   - Tests: 8 test cases (TLA+, Alloy, timeout mismatch, state mismatch, etc.)

2. **model-driven-fix.md** — Phase 2 enhancement
   - Add Cycle 1 diagnostic call after "not reproduced" branch
   - Add conditional to display diagnostic or skip (gated by --verbose or --debug)
   - Dependencies: cycle1-diagnostic-diff.cjs
   - Tests: 2 test cases (with/without diagnostic)

3. **Integration test: Phase 2 with diagnostic**
   - Create test bug with known mismatch
   - Run formal-scope-scan with model
   - Verify diagnostic is generated and displayed
   - No functional change to workflow behavior

**Deliverable:** When Phase 2 can't reproduce bug, user sees "Model assumes X but bug shows Y" guidance. Phase 3 refinement now has context.

### Wave 2: Solution Simulation (Cycle 2 full)

**Goal:** Complete dual-cycle architecture with full solution testing.

4. **normalize-fix-idea.cjs** — Fix idea type detection
   - Implement 3 parsers: constraint, code sketch, NLP entity extraction
   - Return normalized form + confidence + metadata
   - Dependencies: None (pure parsing)
   - Tests: 12 test cases (constraint parsing, code detection, NLP fallback, edge cases)

5. **generate-consequence-model.cjs** — Model mutation
   - Load base model (TLA+ or Alloy)
   - Apply normalized mutation
   - Preserve original invariants
   - Write consequence model
   - Dependencies: File system, model format validation
   - Tests: 10 test cases (TLA+ mutations, Alloy mutations, invariant preservation, syntax validation)

6. **convergence-gate.cjs** — Automated verification gates
   - Invariant gate: Run checker on consequence model, verify original invariants
   - Bug gate: Check if bug condition still holds
   - Regression gate: Run scoped verification on neighbors
   - Dependencies: run-formal-verify.cjs (via subprocess), existing checker runners
   - Tests: 15 test cases (pass, iterate, blocked, neighbor regression, various invariant violations)

7. **model-driven-fix.md** — Phase 4.5 insertion + orchestrator enhancement
   - Add Phase 4.5: Solution Simulation
   - Loop: normalize → generate → gate → verdict
   - User confirmation or --auto-cycle2 flag
   - Dependencies: normalize-fix-idea.cjs, generate-consequence-model.cjs, convergence-gate.cjs
   - Tests: 5 integration test cases (full cycle passes, iterate loop, blocked case, skip with --no-cycle2)

8. **Formal persistence layer** (lightweight)
   - Create `.planning/formal/cycle2-simulations/` tracking
   - Save attempt_N.json with normalized form, model paths, gate results
   - Dependencies: solve-debt-bridge.cjs (or similar file I/O)
   - Tests: 2 test cases (save/load cycle, multi-attempt tracking)

9. **Integration test: Full model-driven-fix with Cycle 2**
   - E2E: bug → discovery → reproduction → refinement → constraints → **cycle2 simulation** → fix → verify
   - Test pass case (all gates pass)
   - Test iterate case (one gate fails, retry succeeds)
   - Test skip case (--no-cycle2)
   - Dependencies: All Phase 4.5 modules

### Wave 3: User Experience & Refinement

**Goal:** Make dual cycles accessible and integrated into debug workflow.

10. **CLI flags and prompts**
    - Add to model-driven-fix.md:
      - `--auto-cycle2` — Automatically run Cycle 2 without user prompts
      - `--max-iterations=N` — Iteration limit for Cycle 2 (default 3)
      - `--no-cycle2` — Skip Phase 4.5 entirely
      - `--cycle2-verbose` — Show model checker output during gates
    - Add user prompts in Phase 4.5:
      - "Propose fix: (natural language, constraint, or code sketch):"
      - On ITERATE: "Refined suggestion: {detail}. Retry? (y/n)"
    - Dependencies: Existing prompt infrastructure
    - Tests: 4 flag test cases

11. **/nf:apply-fix command** (optional convenience wrapper)
    - Shorthand for proposing fix in Phase 4.5
    - Could also be used standalone (pre-Phase 1)
    - Routes to Phase 4.5 convergence gates
    - Dependencies: Phase 4.5 modules, commands/nf structure
    - Tests: 3 test cases (integrate with model-driven-fix phases)

### Wave Summary

| Wave | Modules | Tests | Integration | Duration |
|------|---------|-------|-------------|----------|
| 1 | cycle1-diagnostic-diff.cjs + Phase 2 enhancement | 10 | Phase 2 diagnostic flow | 2-3 days |
| 2 | normalize-fix-idea.cjs, generate-consequence-model.cjs, convergence-gate.cjs, Phase 4.5 + persistence | 45 | Full model-driven-fix with Cycle 2 | 5-7 days |
| 3 | CLI flags, prompts, /nf:apply-fix (optional) | 7 | End-user workflows | 2-3 days |
| **Total** | **7 new modules** | **62 tests** | **v0.39 complete** | **~12 days** |

## Scalability Considerations

### At 10K Users

**Cycle 1 diagnostics:** Lightweight (pure analysis, no execution). Storage: ~1-2MB per bug diagnostic. No performance impact.

**Cycle 2 simulations:** Higher cost — each iteration runs model checker.
- Mitigation 1: Iteration limit (default 3) prevents runaway
- Mitigation 2: Cache consequence models by normalized form hash (same idea → reuse model)
- Mitigation 3: Parallel gate execution (invariant + bug gates can run simultaneously)

### At 100K+ Models

**Neighbor regression checking:** 2-hop BFS already used in Phase 5b. Cycle 2 convergence gates use same infrastructure.
- No new scalability issues
- Neighbor cap (10 models) already enforced via config

### Model File Growth

**Consequence models:** One per Cycle 2 attempt per bug.
- Mitigation: Archive old consequence models after 7 days (configurable)
- Cleanup script: `bin/cleanup-old-consequence-models.cjs`

## Key Design Decisions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| **Cycle 1 diagnostic is advisory, not enforcing** | Preserves backward compatibility; doesn't force Phase 3 changes | Phase 2 logic unchanged; Phase 3 can still use blind retry if desired |
| **Cycle 2 is Phase 4.5, not a separate command** | Keeps solution testing in same workflow as bug fixing | Users see dual-cycle as single integrated experience |
| **Convergence gates automated (no user interaction)** | Removes decision fatigue; gates are objective (pass/fail on formal properties) | Users don't ask "does this pass?" — the model tells them |
| **Fix ideas normalized internally** | Users speak naturally (or in constraints or code); system translates | More accessible to non-formal users; still rigorous for formal experts |
| **Preserve all original invariants in consequence models** | Ensures consequence models test fix against all known constraints | Prevents consequence models from accidentally relaxing properties |
| **No modifications to existing modules** | Reduces regression risk; dual-cycle is additive | New modules are isolated; v0.38 features unaffected |

## Confidence Levels

| Area | Confidence | Notes |
|------|------------|-------|
| **Phase 2 → Cycle 1 integration** | HIGH | Diagnostic is read-only; doesn't change orchestrator logic; can be added as conditional output |
| **Phase 4.5 placement** | HIGH | Between constraint extraction and fix application; perfect insertion point; no dependencies on Phases 5-6 |
| **Module dependencies** | HIGH | All new modules are standalone; only depend on existing runners (run-tlc.cjs, run-alloy.cjs) |
| **Convergence gates logic** | MEDIUM | Gate definitions (invariant + bug + regression) are clear, but detecting "bug still triggered" requires careful implementation per formalism (TLA+/Alloy/PRISM differ) |
| **Consequence model generation** | MEDIUM | Model mutation is straightforward for simple changes (state variable bounds, guard conditions); complex mutations (multiple variables, new transitions) may need refinement |
| **User experience flow** | MEDIUM | Phase 4.5 interaction pattern (propose fix → normalize → test → iterate) is sound, but prompt design and error messaging need UX validation |

## Gaps Flagged for Phase-Specific Research

1. **Convergence gate detection per formalism**
   - How does "bug condition still triggered" differ between TLA+ and Alloy?
   - Need to specify bug condition capture in model-constrained-fix.cjs output
   - May require enhancement to constraint extraction to include "failure predicate" alongside "fix constraints"

2. **Consequence model complexity estimation**
   - How to warn user if mutation causes state space explosion?
   - Should we add pre-flight heuristic to estimate new state space size before generating consequence model?
   - May improve UX for Cycle 2 (avoid generating 10M-state models)

3. **Normalization confidence thresholds**
   - At what confidence level do we ask user for clarification vs. auto-accept normalization?
   - Tradeoff: accuracy vs. user friction
   - Recommend: <70% → ask; 70-85% → accept with caveat; >85% → accept silently

4. **Neighbor model selection for regression gate**
   - Current: 2-hop BFS (existing in Phase 5b)
   - For Cycle 2, should we use same 2-hop or tighter scope (direct neighbors only)?
   - Tight scope: faster, less regression risk; wide scope: catches farther impacts
   - Recommend: Use same 2-hop as Phase 5b for consistency; make configurable

5. **Iteration diagnostics in Cycle 2**
   - When ITERATE verdict, what guidance is "suggested refinement"?
   - Should it be: "Add constraint X" or "Consider invariant Y"?
   - Need clear mapping from gate failure → actionable suggestion
   - Recommend: Define suggestion templates in convergence-gate.cjs per gate type

## Architecture Strengths

1. **Additive, no regression risk:** All new modules are isolated; existing Phase 1-6 workflows unaffected
2. **Formal verification as gate:** Cycle 2's automated convergence gates are objective (not opinion-based)
3. **Reuse of existing infrastructure:** Leverage run-formal-verify.cjs, resolve-proximity-neighbors.cjs, existing runners
4. **User-friendly input:** Fix ideas in natural language, constraints, or code — not forced into formal syntax
5. **Closed-loop validation:** Bugs validate models (Cycle 1), models validate fixes (Cycle 2) — full reasoning cycle

## Architecture Risks

1. **Consequence model state space explosion:** Large mutations may be computationally expensive; need safeguards
2. **Normalization ambiguity:** Natural language parsing can fail; fallback strategy needed
3. **Gate condition capture:** Detecting "bug still triggered" must be precise; overly broad or narrow definitions break gates
4. **User confusion on iteration:** Multiple refinement loops (Phase 3 refinement + Phase 4.5 iteration) could overwhelm; need clear feedback

## Related Files

- `.planning/formal/model-registry.json` — Model metadata (used by run-formal-verify for scoping)
- `.planning/formal/bug-model-gaps.json` — Bug tracking (will store Cycle 1 diagnostic references)
- `.planning/formal/cycle2-simulations/` — NEW directory for consequence model results
- `bin/formal-scope-scan.cjs` — Model discovery (Phase 1)
- `bin/refinement-loop.cjs` — Bug context + inverted verification (Phase 3)
- `bin/model-constrained-fix.cjs` — Constraint extraction (Phase 4)
- `bin/resolve-proximity-neighbors.cjs` — 2-hop BFS (Phase 5b, used by Cycle 2)
- `commands/nf/model-driven-fix.md` — 6-phase orchestrator (to be enhanced)

## Sources

**High confidence** (from codebase analysis):
- `.planning/PROJECT.md` — v0.39 requirements and vision
- `.planning/STATE.md` — Milestone scope decisions
- `commands/nf/model-driven-fix.md` — v0.38 6-phase architecture
- `commands/nf/close-formal-gaps.md` — Phase 3 implementation
- `bin/refinement-loop.cjs` — Bug context normalization (MRF-01, MRF-02)
- `bin/model-constrained-fix.cjs` — Constraint extraction (CEX-01)
- `bin/run-formal-verify.cjs` — Scoped verification infrastructure
- `bin/resolve-proximity-neighbors.cjs` — 2-hop BFS neighbor resolution
- `commands/nf/solve-remediate.md` — Remediation dispatch patterns

**Medium confidence** (from code patterns, not yet implemented):
- Consequence model generation (code mutation logic not yet in codebase)
- Convergence gate automation (gate definitions sound, but formalism-specific details need validation)
- User prompt flow for Cycle 2 (interaction pattern inferred from Phase 5a constraints presentation)
