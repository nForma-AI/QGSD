# Integration Checklist: v0.39 Dual-Cycle Implementation

**For implementers building Waves 1-3 of dual-cycle formal reasoning**

## Pre-Implementation Review Checklist

- [ ] Read SUMMARY_v0.39_DUAL_CYCLES.md (executive overview)
- [ ] Read INDEX_v0.39_DUAL_CYCLES.md (quick reference)
- [ ] Read ARCHITECTURE_v0.39_DUAL_CYCLES.md (detailed specs)
- [ ] Review existing v0.38 model-driven-fix.md workflow
- [ ] Understand refinement-loop.cjs (MRF-01, MRF-02 patterns)
- [ ] Understand model-constrained-fix.cjs (constraint extraction)
- [ ] Understand run-formal-verify.cjs (--scope flag usage)
- [ ] Understand resolve-proximity-neighbors.cjs (2-hop BFS)

## Wave 1: Cycle 1 Diagnostic Foundation

### cycle1-diagnostic-diff.cjs Implementation

**File path:** `/Users/jonathanborduas/code/QGSD/bin/cycle1-diagnostic-diff.cjs`

**Specification:**
- Input: model path, bug context (text or file), checker output
- Output: Markdown diagnostic report
- Saves to: `.planning/formal/cycle1-diagnostics/{BUG_ID}.md`

**Key responsibilities:**
1. Extract model's final state from checker output
2. Extract expected bug behavior from BUG_DESC
3. Compare and identify mismatches
4. Suggest targeted model refinements

**Test cases (8 total):**
- [ ] TLA+ checker output parsing
- [ ] Alloy checker output parsing
- [ ] PRISM checker output parsing
- [ ] Timeout mismatch detection
- [ ] State variable mismatch detection
- [ ] Transition order mismatch detection
- [ ] Invariant mismatch detection
- [ ] Empty/malformed output handling

**Dependencies:**
- None (pure Node.js analysis)

**Related files to study:**
- `bin/refinement-loop.cjs` — parseCheckerSummary() function (similar output parsing)
- `bin/run-tlc.cjs` — Example checker output format
- `bin/run-alloy.cjs` — Example Alloy output format

### model-driven-fix.md Phase 2 Enhancement

**File path:** `/Users/jonathanborduas/code/QGSD/commands/nf/model-driven-fix.md`

**Location in file:** Step 2 (Reproduction), after "no matches" branch

**Current code (around line 95-98):**
```
- If all models pass (none reproduced):
  Display: `Existing models do not reproduce this bug. Proceeding to refinement.`
  Set `$REPRODUCTION_STATUS` = "not_reproduced"
  Proceed to Phase 3.
```

**Enhancement to add:**
```
- If all models pass (none reproduced):
  Display: `Existing models do not reproduce this bug. Proceeding to refinement.`
  Set `$REPRODUCTION_STATUS` = "not_reproduced"

  (NEW) Generate Cycle 1 diagnostic:
    If `$VERBOSE` or `--debug` flag:
      node bin/cycle1-diagnostic-diff.cjs \
        --model="$MODEL" \
        --bug-context="$BUG_DESC" \
        --checker-output="$CHECKER_OUTPUT" \
        --format md
      Display diagnostic to user

  Proceed to Phase 3.
```

**Test cases (2 total):**
- [ ] Phase 2 enhancement executes diagnostic when flag set
- [ ] Phase 2 diagnostic suppressed when flag not set (backward compat)

**Related files to modify:**
- None (only model-driven-fix.md itself)

### Wave 1 Integration Test

**Test:** `/test/integration/phase2-cycle1-diagnostic.test.cjs` (NEW)

**Scenarios:**
- [ ] Create test model with known mismatch to bug description
- [ ] Run formal-scope-scan --run-checkers on model
- [ ] Trigger Phase 2 reproduction check
- [ ] Verify diagnostic is generated
- [ ] Verify diagnostic contains expected mismatch analysis

**Duration:** ~1 hour (includes creating test fixtures)

### Wave 1 Deliverable Checklist

- [ ] cycle1-diagnostic-diff.cjs implemented + 8 tests passing
- [ ] model-driven-fix.md Phase 2 enhancement implemented + 2 tests passing
- [ ] Integration test passing
- [ ] Diagnostic report format documented in code comments
- [ ] Example diagnostic reports added to test fixtures

**Total time estimate:** 2-3 days

**Definition of done:** When Phase 2 reproduction fails, user sees "Model assumes X but bug shows Y" guidance, and Phase 3 can use this to guide refinement.

---

## Wave 2: Cycle 2 Solution Simulation

### normalize-fix-idea.cjs Implementation

**File path:** `/Users/jonathanborduas/code/QGSD/bin/normalize-fix-idea.cjs`

**Specification:**
- Input: fix idea (raw string), optional model path
- Output: JSON with detected type, normalized form, confidence, metadata
- CLI: `node bin/normalize-fix-idea.cjs --idea="..." [--model=path] [--format json|text]`

**Key responsibilities:**
1. Detect input type: constraint syntax vs code sketch vs natural language
2. Parse detected type to normalized form
3. Return confidence score (0-1)
4. Suggest correction if confidence < 0.7

**Test cases (12 total):**
- [ ] Constraint syntax detection (TLA+ style)
- [ ] Constraint syntax detection (Alloy style)
- [ ] Code sketch detection (simple if statement)
- [ ] Code sketch detection (assignment)
- [ ] Natural language entity extraction (variable + value)
- [ ] Natural language entity extraction (condition)
- [ ] High-confidence path (>85%)
- [ ] Medium-confidence path (70-85%)
- [ ] Low-confidence path (<70%, asks user)
- [ ] Malformed input handling
- [ ] Empty/null input handling
- [ ] Complex mutation detection (multiple statements)

**Dependencies:**
- None (pure Node.js parsing)

**Implementation notes:**
- Try constraint parser first (look for `=` or `in`)
- Fall back to code sketch parser (look for `{`, `}`, `(`, `)`)
- Fall back to NLP entity extraction (look for "change", "set", "add", etc.)
- Use confidence scoring to decide when to ask user

### generate-consequence-model.cjs Implementation

**File path:** `/Users/jonathanborduas/code/QGSD/bin/generate-consequence-model.cjs`

**Specification:**
- Input: base model path, mutation spec JSON, output path, formalism
- Output: Consequence model file (TLA+ or Alloy), mutation summary JSON
- CLI: `node bin/generate-consequence-model.cjs --base-model=path --mutation-spec=json --output=path [--formalism=tla|alloy]`

**Key responsibilities:**
1. Load and parse base model
2. Apply normalized mutation to model
3. Preserve original invariants unchanged
4. Validate model compiles
5. Write consequence model to disk

**Test cases (10 total):**
- [ ] TLA+ state variable change (bounds update)
- [ ] TLA+ transition guard injection
- [ ] TLA+ initialization change
- [ ] Alloy signature constraint change
- [ ] Alloy predicate injection
- [ ] Alloy relation constraint change
- [ ] Invariant preservation (TLA+)
- [ ] Invariant preservation (Alloy)
- [ ] Syntax validation (model compiles)
- [ ] Complex mutation handling (multiple changes)

**Dependencies:**
- File system (read/write models)
- Model format validation (TLA+ vs Alloy syntax checking)

**Implementation notes:**
- Never modify existing INVARIANT / PROPERTY definitions
- Only inject Init, variable bounds, or transition guards
- Detect formalism from file extension (.tla vs .als)
- Test consequence model compiles before returning

**Related files to study:**
- `.planning/formal/tla/MCsafety.tla` — Example TLA+ model structure
- `.planning/formal/alloy/quorum-votes.als` — Example Alloy model structure
- `bin/model-constrained-fix.cjs` — Similar model parsing logic

### convergence-gate.cjs Implementation

**File path:** `/Users/jonathanborduas/code/QGSD/bin/convergence-gate.cjs`

**Specification:**
- Input: consequence model path, bug context, neighbors CSV scope, formalism
- Output: JSON verdict (PASS | ITERATE | BLOCKED) with gate results
- CLI: `node bin/convergence-gate.cjs --consequence-model=path --bug-context="..." --neighbors=CSV_SCOPE [--verbose]`

**Key responsibilities:**
1. Invariant gate: Run checker, verify original invariants hold
2. Bug gate: Check if bug condition still evaluates true
3. Regression gate: Run scoped verification on neighbors
4. Compute verdict based on gate results
5. Suggest refinement if ITERATE

**Test cases (15 total):**
- [ ] Invariant gate PASS (all invariants hold)
- [ ] Invariant gate FAIL (one invariant violated)
- [ ] Bug gate PASS (bug no longer triggered)
- [ ] Bug gate FAIL (bug still triggers)
- [ ] Regression gate PASS (neighbors pass)
- [ ] Regression gate FAIL (neighbors fail)
- [ ] Regression gate SKIP (no neighbors found)
- [ ] Verdict: PASS (all gates pass)
- [ ] Verdict: ITERATE (invariant or bug fails)
- [ ] Verdict: BLOCKED (fundamental conflict)
- [ ] Suggested refinement on ITERATE (specific)
- [ ] Neighbor model execution error handling
- [ ] Checker timeout handling
- [ ] Empty consequence model handling
- [ ] Missing bug context handling

**Dependencies:**
- run-formal-verify.cjs (via subprocess call with --scope flag)
- Existing TLA+/Alloy/PRISM checker runners

**Implementation notes:**
- Gates run in order: invariant → bug → regression
- Stop at first failure for ITERATE (don't continue to next gate)
- Bug gate requires bug condition specification (see "Gaps flagged for research")
- Use resolve-proximity-neighbors.cjs output as neighbor scope

**Related files to study:**
- `bin/run-formal-verify.cjs` (line ~150) — --scope flag usage
- `bin/resolve-proximity-neighbors.cjs` — 2-hop BFS output format
- `bin/model-constrained-fix.cjs` — Constraint format (for understanding "failure predicate" concept)

### model-driven-fix.md Phase 4.5 Insertion

**File path:** `/Users/jonathanborduas/code/QGSD/commands/nf/model-driven-fix.md`

**Location in file:** NEW STEP after Phase 4 (Constraint Extraction), before Phase 5

**Phase 4.5 specification:**
```markdown
## Phase 4.5 — Solution Simulation (NEW — Cycle 2)

### Gate Input Extraction

Before running Cycle 2, extract from constraints:
- Bug condition (from constraint extraction output)
- Affected variables (from constraint extraction output)
- Neighbor scope (from resolve-proximity-neighbors.cjs)

### Phase 4.5a — Propose Fix Idea

Prompt user (unless --auto-cycle2):
  "Propose fix (natural language, constraint, or code sketch): "

Wait for user input or timeout (60s).

If no input and --auto-fix not set:
  Display: "Skipping Cycle 2. User did not propose fix."
  Proceed to Phase 5 (skip Phase 4.5 entirely).

If user input or --auto-fix provided:
  Set FIX_IDEA = input (or auto-generated idea)
  Proceed to Phase 4.5b.

### Phase 4.5b — Iteration Loop (max 3 or --max-iterations)

For iteration N = 1 to max_iterations:

  Step 1: Normalize fix idea
    node bin/normalize-fix-idea.cjs --idea="$FIX_IDEA" --format json
    Parse JSON output to NORMALIZED_FORM
    If confidence < 0.7:
      Ask user: "Unclear. Did you mean {suggestion}? (y/n)"
      If no: ask for clarification
    Proceed to Step 2

  Step 2: Generate consequence model
    node bin/generate-consequence-model.cjs \
      --base-model="$REPRODUCING_MODEL" \
      --mutation-spec="$NORMALIZED_FORM" \
      --output=".planning/formal/consequence-models/{BUG_ID}-{N}.tla" \
      --formalism="$FORMALISM"
    Parse mutation summary from output
    If generation failed:
      Display: "Could not apply fix idea to model: {error}"
      Ask for refinement; continue to Step 3 with guidance
    Proceed to Step 3

  Step 3: Run convergence gates
    node bin/convergence-gate.cjs \
      --consequence-model=".planning/formal/consequence-models/{BUG_ID}-{N}.tla" \
      --bug-context="$BUG_DESC" \
      --neighbors="$NEIGHBOR_SCOPE" \
      --format=json
    Parse JSON output: VERDICT, gate_results
    Save to: ".planning/formal/cycle2-simulations/{BUG_ID}/attempt_{N}.json"

  Step 4: Handle verdict
    If VERDICT == "PASS":
      Display: "✓ Solution simulation PASSED"
      Display: "All constraints satisfied. Safe to apply fix."
      Exit loop, proceed to Phase 5 with confidence note

    If VERDICT == "ITERATE":
      Display: "⚠ Suggested refinement: {suggested_refinement}"
      If N < max_iterations:
        Prompt: "Refine fix idea: "
        Wait for user input
        Set FIX_IDEA = new_input
        Continue to next iteration
      Else:
        Display: "Max iterations reached. Proceeding to Phase 5 anyway."
        Proceed to Phase 5

    If VERDICT == "BLOCKED":
      Display: "✗ Solution simulation BLOCKED"
      Display: "Fundamental conflict: {blocking_reason}"
      Exit workflow with error

### Persistence: Save Cycle 2 Results

Create directory structure:
  mkdir -p .planning/formal/cycle2-simulations/{BUG_ID}

For each iteration, save attempt_{N}.json:
{
  "iteration": N,
  "timestamp": "ISO-8601",
  "fix_idea_original": "...",
  "fix_idea_normalized": { ... },
  "consequence_model": "path/to/generated/model.tla",
  "verdict": "PASS|ITERATE|BLOCKED",
  "gate_results": { ... },
  "suggested_refinement": "..."
}

Also save final summary to:
  .planning/formal/cycle2-simulations/{BUG_ID}/summary.json
{
  "bug_id": "...",
  "final_verdict": "PASS|INCOMPLETE|BLOCKED",
  "iterations": N,
  "timestamp": "...",
  "consequence_models": ["path/1.tla", "path/2.tla"],
  "link_to_phase4_constraints": ".planning/formal/constraints/{BUG_ID}.json"
}
```

**Test cases (5 total):**
- [ ] Full cycle passes (all gates PASS)
- [ ] Iterate loop: first attempt fails, second passes
- [ ] Iterate loop: max iterations reached, exit
- [ ] Blocked case: fundamental conflict detected
- [ ] Skip case: --no-cycle2 or user declines to propose fix

### Persistence Layer Implementation

**File path:** `.planning/formal/cycle2-simulations/` (NEW directory)

**Structure:**
```
.planning/formal/cycle2-simulations/
  {BUG_ID}/
    attempt_1.json
    attempt_2.json
    attempt_3.json
    summary.json
  {BUG_ID2}/
    attempt_1.json
    summary.json
```

**Implementation:**
- Create `cycle2-simulations/` directory if missing
- Save attempt_{N}.json after each gate check
- Save summary.json after exit (success or failure)
- No cleanup needed (accumulate for audit trail)

**Related files:**
- `.planning/formal/bug-model-gaps.json` — Link to bug tracking
- `.planning/formal/model-registry.json` — Reference for model metadata

### Wave 2 Integration Test

**Test:** `/test/integration/phase4-5-cycle2-simulation.test.cjs` (NEW)

**Scenarios:**
- [ ] Full cycle: propose fix → normalize → generate → gate (all PASS)
- [ ] Iterate scenario: first attempt ITERATE, second PASS
- [ ] Blocked scenario: fundamental conflict detected
- [ ] Skip scenario: user declines or --no-cycle2
- [ ] Error handling: malformed fix idea, model generation fails, etc.

**Fixtures needed:**
- Test bug description + reproducing model
- Pre-extracted constraints for Phase 4
- 2-hop neighbor models for regression gates

**Duration:** ~2-3 hours

### Wave 2 Deliverable Checklist

- [ ] normalize-fix-idea.cjs implemented + 12 tests passing
- [ ] generate-consequence-model.cjs implemented + 10 tests passing
- [ ] convergence-gate.cjs implemented + 15 tests passing
- [ ] model-driven-fix.md Phase 4.5 orchestration implemented
- [ ] Phase 4.5 persistence layer implemented
- [ ] Integration test Phase 4.5 end-to-end passing
- [ ] Sample consequence models in test fixtures
- [ ] Sample cycle2-simulations/{BUG_ID}/attempt_*.json in fixtures
- [ ] Documentation: How to interpret gate results and suggested refinements

**Total time estimate:** 5-7 days

**Definition of done:** Full Phase 4.5 executing, all convergence gates working, users can test fix ideas in model space with PASS | ITERATE | BLOCKED verdicts.

---

## Wave 3: UX Polish

### CLI Flags and Prompts

**File path:** `/Users/jonathanborduas/code/QGSD/commands/nf/model-driven-fix.md`

**Flags to add:**

1. `--auto-cycle2` — Automatically run Cycle 2 without prompts
   - Implies `--cycle2` is enabled
   - Use first proposed fix idea (from `--fix-idea` or auto-generate)

2. `--max-iterations=N` — Iteration limit for Cycle 2 (default 3)
   - Type: integer, 1-10
   - Example: `--max-iterations=5`

3. `--no-cycle2` — Skip Phase 4.5 entirely
   - Proceed directly from Phase 4 to Phase 5

4. `--cycle2-verbose` — Show model checker output during gates
   - Pass to convergence-gate.cjs as `--verbose`
   - Also show consequence model mutations

5. `--fix-idea="..."` — Pre-populate fix idea (optional auto-mode)
   - For automated workflows
   - Example: `--fix-idea="Change timeout from 5000 to 10000"`

**Test cases (4 total):**
- [ ] --auto-cycle2 with provided --fix-idea
- [ ] --max-iterations=N respected in iteration loop
- [ ] --no-cycle2 skips Phase 4.5 entirely
- [ ] --cycle2-verbose shows detailed output

### Optional: /nf:apply-fix Command

**File path:** `/Users/jonathanborduas/code/QGSD/commands/nf/apply-fix.md` (NEW)

**Purpose:** Convenience wrapper for Phase 4.5 fix idea proposal

**Interface:**
```bash
/nf:apply-fix "Change timeout to 100ms" [--bug-id=ID] [--max-iterations=N]
```

**Behavior:**
- If run without prior `/nf:model-driven-fix`: error (no context)
- If run after Phase 4 constraints extracted: pre-populate fix idea in Phase 4.5
- Routes to model-driven-fix Phase 4.5 convergence gates

**Test cases (3 total):**
- [ ] /nf:apply-fix without context → error
- [ ] /nf:apply-fix after Phase 4 → routes to Phase 4.5
- [ ] /nf:apply-fix with --max-iterations flag

### Wave 3 Integration Test

**Test:** `/test/integration/cli-flags-ux.test.cjs` (NEW)

**Scenarios:**
- [ ] All new flags work correctly
- [ ] /nf:apply-fix works as expected
- [ ] Flag combinations (--auto-cycle2 --max-iterations=5)
- [ ] Backward compatibility: old flags still work

**Duration:** ~1 hour

### Wave 3 Deliverable Checklist

- [ ] All CLI flags implemented + tested
- [ ] /nf:apply-fix command implemented + tested (optional)
- [ ] help text updated for all new flags
- [ ] Example commands documented in model-driven-fix.md
- [ ] Integration test passing

**Total time estimate:** 2-3 days

**Definition of done:** Users can easily access dual-cycle features via flags or convenience commands. Documentation is clear.

---

## Post-Implementation Tasks

### Documentation

- [ ] Update `.planning/STATE.md` with v0.39 completion status
- [ ] Add v0.39 section to CHANGELOG.md
- [ ] Create user guide for Cycle 1 & Cycle 2 workflows
- [ ] Add example diagnostic reports to documentation
- [ ] Document gate condition detection per formalism

### Testing

- [ ] All 62 tests passing (8 + 45 + 7 + 2 integration)
- [ ] Run full test suite: `npm test`
- [ ] Manual E2E testing with real bugs and models
- [ ] Performance testing: consequence model generation time, gate execution time

### Code Review & CI

- [ ] Code review for Wave 1 → merge to main
- [ ] Code review for Wave 2 → merge to main
- [ ] Code review for Wave 3 → merge to main
- [ ] All CI gates pass
- [ ] No regressions in v0.38 functionality

### Deployment

- [ ] Version bump: v0.38 → v0.39
- [ ] Update installer (if needed)
- [ ] Deploy to staging → test
- [ ] Deploy to production

---

## Reference: File Locations Quick Map

| Component | File Path |
|-----------|-----------|
| Wave 1: Cycle 1 diagnostic | bin/cycle1-diagnostic-diff.cjs (NEW) |
| Wave 1: Phase 2 enhancement | commands/nf/model-driven-fix.md (MODIFY) |
| Wave 2: Normalize fix idea | bin/normalize-fix-idea.cjs (NEW) |
| Wave 2: Generate consequence model | bin/generate-consequence-model.cjs (NEW) |
| Wave 2: Convergence gates | bin/convergence-gate.cjs (NEW) |
| Wave 2: Phase 4.5 orchestration | commands/nf/model-driven-fix.md (MODIFY) |
| Wave 2: Persistence layer | .planning/formal/cycle2-simulations/ (NEW directory) |
| Wave 3: CLI flags & prompts | commands/nf/model-driven-fix.md (MODIFY) |
| Wave 3: /nf:apply-fix (optional) | commands/nf/apply-fix.md (NEW, optional) |

---

**Research date:** 2026-03-18
**Implementation start:** Ready to begin
**Estimated duration:** ~12 days (3 waves, ~4 days per wave + overlap)
**Confidence level:** HIGH for Wave 1-2, MEDIUM for Wave 3 UX polish
