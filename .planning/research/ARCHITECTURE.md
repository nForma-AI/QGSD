# Architecture: Model-Driven Debugging Integration

**Project:** nForma v0.38 — Model-Driven Debugging
**Researched:** 2026-03-17
**Confidence:** HIGH

## Executive Summary

Model-driven debugging transforms nForma's formal models from descriptive (CI gate validation) to prescriptive (explaining bugs, constraining fixes, preventing regressions). The architecture extends three existing subsystems:

1. **Model Lookup Layer** — Bug-to-model discovery via extended `formal-scope-scan.cjs` with `--bug-mode`
2. **Constraint Extraction** — Parse specs to extract fix constraints, integrated into `/nf:debug` quorum dispatch
3. **Solve Layer B→F** — New 20th layer tracking bugs formal models should explain but don't

The design preserves existing wave-parallel remediation architecture while inserting bug-driven intelligence into the debug→solve→fix loop. Integration points are minimal (5 new/modified components), dependencies are clean (no graph cycles), and the build order respects solve-layer prerequisites.

## System Architecture

### Current State (v0.37)

```
Code/Test/Docs ────────┐
                       ├──→ (19 layers) ──→ nf-solve ──→ solve-remediate ──→ fix
Requirements/Models ──┤
Production Signals ───┘

Per-layer handlers (gas pedal dispatch):
  wave 0: r_to_f, r_to_d, t_to_c, p_to_f
  wave 1: f_to_t, c_to_f
  wave 2: f_to_c, d_to_c
  wave 3: c_to_r, t_to_r, d_to_r, git_heatmap
  wave 4: hazard_model
  wave 5: l1_to_l3
  wave 6: l3_to_tc, per_model_gates, h_to_m
```

**Key facts:**
- 19 layers in LAYER_KEYS (layer-constants.cjs)
- Dependency DAG in solve-wave-dag.cjs enforces ordering
- Each wave runs up to 3 layers in parallel (RAM budget)
- Remediation dispatch uses Agent subprocesses per layer
- Debug loop (nf:debug) calls quorum workers independently of solve

### Proposed State (v0.38 with Model-Driven Debugging)

```
Bug Report ───────┐
                 ├──→ Bug-to-Model ──→ Constraint Extraction ──→ /nf:debug ──→ Model-Aware Fix
Code/Test/Docs ──┤
Requirements ────┘

New layer: B→F (wave 7, post per_model_gates)
  "Which bugs does formal model M explain?"

New solve layer in solve cycle (after per_model_gates):
  wave 7: b_to_f  (bug→formal coverage tracking)

New /nf:debug integration points:
  1. Inject model-lookup results into debug bundle
  2. Extract constraints from matched models
  3. Pre-verify fix against neighbor models
```

## Component Overview

| Component | Purpose | Status | Where |
|-----------|---------|--------|-------|
| **bug-to-model lookup** | Find models matching bug context | NEW | bin/formal-scope-scan.cjs (extend) |
| **constraint-extraction** | Parse specs → English constraints | NEW | bin/model-constrained-fix.cjs |
| **model-aware debug dispatch** | Inject formal intelligence into debug | NEW | core/workflows/model-driven-fix.md |
| **B→F layer handler** | Track unexplained bugs | NEW | bin/solve-handlers/b_to_f.cjs |
| **bug-model-gaps.json** | Persistence file for bug→model links | NEW | .planning/formal/bug-model-gaps.json |
| **formal-scope-scan.cjs** | Extended with `--bug-mode` flag | MODIFIED | bin/formal-scope-scan.cjs |
| **nf-solve.cjs** | Add B→F layer to cycle, post-h_to_m | MODIFIED | bin/nf-solve.cjs |
| **solve-remediate.md** | Add 3o. B→F Gaps section | MODIFIED | core/workflows/solve-remediate.md |
| **solve-wave-dag.cjs** | Add B→F to wave dependencies | MODIFIED | bin/solve-wave-dag.cjs |
| **/nf:debug** | Inject model context into bundle | MODIFIED | commands/nf/debug.md |

## Integration Points

### 1. Bug-to-Model Discovery (Lookup Layer)

**Entry point:** `/nf:debug` failure context → model-lookup

**Mechanism:**
```bash
# Existing scope-scan (file/concept matching)
node bin/formal-scope-scan.cjs \
  --description "failure description" \
  --files "affected_code.js"

# NEW: Bug-specific lookup
node bin/formal-scope-scan.cjs \
  --description "failure description" \
  --files "affected_code.js" \
  --bug-mode              # NEW FLAG
  --exit-code 1           # NEW: numeric exit code
  --stack-trace "..."     # NEW: error stack
```

**Output:** Ordered list of models with:
- `module` — formal model name
- `matched_by` — lookup strategy (source_file, concept, bug_pattern, proximity_graph)
- `proximity_score` — graph-based confidence (0–1.0)
- `constrain_fields` — which spec sections apply (preconditions, invariants, state bounds)

**Implementation in formal-scope-scan.cjs:**
1. Load existing scope.json index
2. NEW: Load optional `bug-patterns.json` (signatures for common failure types)
3. Match failure description against patterns (Levenshtein distance > 0.75 triggers)
4. If pattern hits, boost proximity_score by 0.2 and tag `matched_by: 'bug_pattern'`
5. Return ranked results as before

**Low risk:** Fails open (empty results) if bug-patterns.json missing. Existing scope-scan test suite unaffected.

### 2. Constraint Extraction (Parser Layer)

**Entry point:** Model lookup results → constraint extraction

**New file:** `bin/model-constrained-fix.cjs`

**Algorithm:**
```
FOR EACH matched model M:
  1. Read M's invariants.md (human-readable)
  2. Parse invariant blocks by structure:
     - Safety constraints: "X must NOT..."
     - Liveness constraints: "X must eventually..."
     - Bounds: "X ∈ [min, max]"
  3. For matched_by='source_file', extract preconditions from @requirement annotations in spec
  4. Generate English constraint list with confidence scores
  5. Return {model, constraints, confidence}
```

**Output schema:**
```json
{
  "model": "QuorumDeliberation.tla",
  "source_section": "Invariants",
  "constraints": [
    {
      "type": "safety",
      "english": "All quorum workers must respond within 30 seconds of dispatch",
      "formal": "~QuorumDeliberation!2143",
      "confidence": "HIGH",
      "applies_to_fix": "timeout handling, worker heartbeat"
    },
    {
      "type": "liveness",
      "english": "Consensus decision is made once 3/4 workers agree",
      "formal": "QuorumConsensus!line2091",
      "confidence": "HIGH",
      "applies_to_fix": "voting logic, consensus threshold"
    }
  ],
  "fix_scope_check": {
    "model_affected_by_fix": true,
    "reason": "Fix modifies timeout constant; model depends on timeout bounds"
  }
}
```

**Implementation details:**
- Parse `.planning/formal/spec/{module}/invariants.md` line by line
- Recognize patterns: `SAFETY:`, `LIVENESS:`, `BOUND:`, `PRECONDITION:` headers
- Extract formal references (filenames, line numbers, variable names)
- Link to @requirement annotations via proximity-index.cjs graph walk
- Fail gracefully if spec is unreadable (return empty constraints array)

### 3. Debug Bundle Injection

**Entry point:** `/nf:debug` command → Step A (collect failure context)

**Current flow (v0.37):**
```
/nf:debug "test timeout issue"
  ├─ Collect test output, error trace
  ├─ Dispatch 4 quorum workers
  └─ Render NEXT STEP table
```

**New flow (v0.38):**
```
/nf:debug "test timeout issue"
  ├─ Collect test output, error trace
  ├─ NEW: Run bug-to-model lookup
  ├─ NEW: Extract constraints from matched models
  ├─ Dispatch 4 quorum workers with EXTENDED BUNDLE
  │   (includes model context + constraints)
  └─ Render NEXT STEP table + MODEL RECOMMENDATIONS
```

**Bundle structure (MODIFIED):**
```
## Failure Context
[existing: test output, exit code, stack trace, arguments]

## Formal Model Intelligence  [NEW]
```
Matched Models (bug-to-model lookup):
  1. QuorumDeliberation.tla
     - Proximity: 0.88
     - Matched by: source_file (bin/hooks/nf-stop.js)
     - Key constraints:
       * Workers must respond within 30s
       * Consensus requires 3/4 agreement
       * Dispatch state must not re-enter RUNNING
```

**Worker prompt injection:**
```
You are a debugging advisor for nForma.

<bundle>
[full bundle with model intelligence]
</bundle>

Given this failure AND the formal models that may explain it:

root_cause: <one-liner>
next_step: <specific debugging action>
model_recommendation: [APPLY | INSPECT | DEFER] — does a model constraint inform this fix?
confidence: HIGH | MEDIUM | LOW
```

**Implementation:** Modify `commands/nf/debug.md` Step C:
1. After Step A (collect failure), insert sub-step: "Run bug-to-model lookup"
2. Call formal-scope-scan.cjs with `--bug-mode` + failure context
3. For top 3 matches, call model-constrained-fix.cjs
4. Fold constraint list into bundle template
5. Inject into all 4 worker prompts

**No risk to existing debug flow:** If lookup/extraction fails, fall through to existing 4-worker dispatch. Tests unaffected.

### 4. Solve Layer B→F (Bug-to-Formal Gap)

**Purpose:** Track bugs that formal models should explain but don't.

**Layer definition:**
```javascript
// bin/layer-constants.cjs — NEW LAYER
const LAYER_KEYS = [
  // ... existing 19 layers ...
  'b_to_f',  // BUG→FORMAL: Bugs not covered by existing models
];
```

**Handler:** `bin/solve-handlers/b_to_f.cjs`

**Residual computation:**
```
RESIDUAL = count of bugs in production git history
           not matched by any formal model's assumptions/invariants

Detail:
  {
    "unflagged_bugs": [
      {
        "git_ref": "fix commit hash",
        "description": "quorum deliberation timeout",
        "matched_models": [],  // Empty if no model reproduces bug
        "fix_sha": "abc123",
        "blame_layer": "quorum-dispatch"
      }
    ]
  }
```

**Remediation dispatcher (solve-remediate.md Section 3o):**

```markdown
### 3o. B→F Gaps

Extract list of unflagged bugs from residual_vector.b_to_f.detail.unflagged_bugs.

For each bug:
1. Run: node bin/formal-scope-scan.cjs --bug-mode --description "{bug_description}"
2. If matched models found: call /nf:close-formal-gaps to strengthen existing specs OR create new model
3. If NO models found: log as "model candidate" for next v0.39 formalization cycle

Log: "B->F: {N} unflagged bugs processed, {M} model candidates identified"

Update .planning/formal/bug-model-gaps.json with:
  - Bugs now covered by models (move to "covered" array)
  - New model candidates (add to "candidates" array)
```

**Data file:** `.planning/formal/bug-model-gaps.json`

```json
{
  "schema_version": "1",
  "last_updated": "2026-03-17T00:00:00Z",
  "covered_bugs": [
    {
      "git_ref": "abc123",
      "description": "quorum timeout race condition",
      "model": "QuorumDeliberation.tla",
      "explanation": "Model reproduces bug via bounded timeout counter + unfair worker scheduling",
      "discovered_version": "v0.38"
    }
  ],
  "unflagged_bugs": [
    {
      "git_ref": "def456",
      "description": "solver oscillation on gate flip-flop",
      "matched_models": [],
      "priority": "high",
      "candidate_model": "SolveConvergence.tla"
    }
  ]
}
```

## Data Flow Changes

### Current Flow (v0.37)

```
residual_vector
  ├─ r_to_f (requirements without models)
  ├─ f_to_t (models without tests)
  ├─ c_to_f (code constants drift)
  ├─ t_to_c (failing tests)
  ├─ f_to_c (verification failures)
  ├─ ... (13 more) ...
  └─ h_to_m (hypothesis→model gaps)
      ↓
  solve-remediate.md routes each to handler
      ↓
  fix generated (code, tests, models, docs)
```

### New Flow (v0.38)

```
bug_report (from /nf:debug)
  ├─ bug-to-model lookup (formal-scope-scan.cjs --bug-mode)
  ├─ constraint extraction (model-constrained-fix.cjs)
  └─ inject into debug bundle
        ↓
    quorum workers see model constraints
        ↓
    next_step includes model_recommendation
        ↓
        fix applied
        ↓
        pre-verify against neighbor models [NEW in solve cycle]
        ↓

Parallel: solve cycle B→F layer
  residual_vector.b_to_f
    ├─ git history scan (find bugs)
    ├─ bug-to-model lookup for EACH
    ├─ identify unflagged bugs
    └─ generate model candidates
        ↓
    Route to close-formal-gaps (if models found)
    or log as v0.39 formalization candidate
```

## Build Order & Dependencies

**Phase 1: Lookup & Extraction (foundational)**
1. `bin/formal-scope-scan.cjs` — Add `--bug-mode` flag, bug-patterns.json support
2. `bin/model-constrained-fix.cjs` — NEW file, constraint parser

**Prerequisite for Phase 1:** None (fail-open design)

**Phase 2: Debug Integration (user-facing)**
3. `commands/nf/debug.md` — Modify Step A to inject model context
4. Test: `/nf:debug "timeout failure"` returns model recommendations

**Prerequisite for Phase 2:** Phase 1 complete

**Phase 3: Solve Layer (autonomous fix)**
5. `bin/layer-constants.cjs` — Add `b_to_f` to LAYER_KEYS (20th layer)
6. `bin/solve-handlers/b_to_f.cjs` — NEW handler for residual computation
7. `bin/solve-wave-dag.cjs` — Add B→F dependencies (after h_to_m, pre-cleanup)
8. `bin/nf-solve.cjs` — Import b_to_f handler, wire into sweep
9. `.planning/formal/bug-model-gaps.json` — NEW tracking file (init empty)
10. `core/workflows/solve-remediate.md` — Add Section 3o (B→F remediation)

**Prerequisite for Phase 3:** Phase 2 complete (debug must work first)

**Phase 4: Testing & Validation (quality gates)**
11. `bin/formal-scope-scan.test.cjs` — Add `--bug-mode` test cases
12. `bin/model-constrained-fix.test.cjs` — NEW test suite
13. `bin/solve-handlers/b_to_f.test.cjs` — NEW test suite
14. E2E: Inject bug via git history, run `nf:solve`, verify B→F layer fires

**Critical path (minimum to ship):**
- Phase 1 (lookup/extraction) + Phase 2 (debug integration) = user can get model recommendations
- Phase 3 adds autonomous solve layer (nice-to-have for v0.38, required for v0.39)

## Dependency Graph

```
formal-scope-scan.cjs (--bug-mode)
  ↓
model-constrained-fix.cjs
  ├─ (reads) .planning/formal/spec/{module}/invariants.md
  └─ (reads) proximity-index.json
  ↓
commands/nf/debug.md (bundle injection)
  ├─ (calls) formal-scope-scan.cjs --bug-mode
  └─ (calls) model-constrained-fix.cjs
  ↓
bin/nf-solve.cjs (solve cycle)
  ├─ (imports) solve-handlers/b_to_f.cjs
  ├─ (calls) formal-scope-scan.cjs --bug-mode (for each bug)
  ├─ (calls) model-constrained-fix.cjs
  └─ (updates) .planning/formal/bug-model-gaps.json
```

**No cycles.** Safe to build in order: Phase 1 → 2 → 3 → 4.

## Interaction with Existing Components

### formal-scope-scan.cjs (2-layer architecture preserved)

**Current:**
```
Layer 1: scope.json matching (file overlap, concept, module name)
Layer 2: proximity-index.json graph walk (BFS from matched modules)
```

**New:**
```
Layer 1: scope.json + NEW bug-patterns.json (Levenshtein matching)
Layer 2: (unchanged)
Layer 3: NEW — For bugs, boost proximity_score if pattern match found
```

**Test impact:** 0. New flag is optional. Existing tests pass unmodified.

### solve-wave-dag.cjs (dependency order)

**Current:**
```
LAYER_DEPS = {
  h_to_m: [],
  per_model_gates: ['l1_to_l3', 'l3_to_tc'],
  ... (others)
}
```

**New:**
```
LAYER_DEPS = {
  h_to_m: [],
  b_to_f: ['h_to_m'],  // Bugs tracked AFTER hypothesis measurement
  per_model_gates: ['l1_to_l3', 'l3_to_tc'],
  ... (others)
}

// NEW wave grouping:
// Wave 7 (sequential): h_to_m → b_to_f → (cleanup if needed)
```

**Impact:** Wave 6 stays same (h_to_m still dispatches in wave 6 if residual > 0). New b_to_f creates wave 7 if bugs found.

### /nf:debug quorum dispatch

**Current:**
- Worker sees: test output, exit code, stack trace
- Worker returns: root_cause, next_step, confidence
- Table shows: 4 models × 3 columns

**New:**
- Worker sees: test output + model constraints + fix recommendations
- Worker returns: root_cause, next_step, model_recommendation (APPLY/INSPECT/DEFER), confidence
- Table shows: 4 models × 4 columns (added model_recommendation)

**Test impact:** Existing debug tests still pass. New bundle enrichment is optional (graceful degradation if lookup fails).

## Risk Analysis

### Low Risk
1. **Bug-patterns.json missing** → Lookup degrades to existing scope-scan behavior (no regression)
2. **Constraint extraction fails** → Bundle stays readable, quorum workers unaffected
3. **B→F layer disabled** → Solve cycle works as-is, no new gaps introduced

### Medium Risk
1. **False positives in bug-pattern matching** → Boost proximity_score for wrong model
   - **Mitigation:** Levenshtein threshold 0.75, manual review of patterns before shipping
2. **Performance: lookup on every debug call** → Adds ~500ms per debug
   - **Mitigation:** Cache lookup results in current-session memory; clear on new failure context

### High Risk
1. (None identified) — Design is fail-open and backward-compatible

## Scalability

**Lookup scalability:**
- scope.json matching: O(models × concepts) = O(201 × ~10 avg) = O(2K) fast
- proximity-index BFS: O(nodes + edges) in index, already used by existing scope-scan
- bug-patterns matching: O(bugs × patterns) = O(50 bugs × ~20 patterns) = O(1K)

**Constraint extraction:**
- Per-model invariant parsing: O(invariant_count) = O(10–50 per model)
- Annotation link: O(requirements matched) = already done by proximity-index

**Solve B→F layer:**
- Iterate git history: O(commits) = handled by existing git heatmap layer
- Per-bug lookup: O(bugs × scan) = ~O(100) worst case, batched in wave
- Fits within existing solve iteration cycle

## Testing Strategy

**Unit tests (isolated components):**
- formal-scope-scan.cjs: Add `--bug-mode` flag test cases (5 new tests)
- model-constrained-fix.cjs: Parser test suite (10 new tests)
- b_to_f handler: Residual computation (5 new tests)

**Integration tests:**
- `/nf:debug` with model injection: Bundle structure validated (3 new tests)
- solve cycle B→F layer: Wave computation includes B→F, residual flows to handler (2 new tests)
- E2E: Inject test failure → debug returns model recommendation → solve fires B→F layer (1 E2E test)

**Compatibility:**
- All existing tests pass unmodified (19 layers still work as-is)
- New components fail-open (no regressions)

## Migration Path

**v0.38 MVP (minimum viable product):**
1. Phase 1 + 2: Lookup + debug integration
2. Users get model recommendations in `/nf:debug` output
3. Manual routing: User sees "Model suggests: check timeout constant" → applies fix manually
4. Phase 3 (solve B→F layer) ships in v0.38 but as opt-in (`--enable-b-to-f` flag) or soft gate

**v0.39 (full autonomous):**
1. B→F layer mandatory in solve cycle
2. Automatic model refinement: Close-formal-gaps auto-triggers for unflagged bugs
3. Regression prevention: All fixes pre-verified against neighbor models before merge

## Sources

- `/Users/jonathanborduas/code/QGSD/bin/formal-scope-scan.cjs` — Current lookup implementation
- `/Users/jonathanborduas/code/QGSD/bin/layer-constants.cjs` — Layer definitions
- `/Users/jonathanborduas/code/QGSD/bin/solve-wave-dag.cjs` — Wave dependency DAG
- `/Users/jonathanborduas/code/QGSD/commands/nf/debug.md` — Current debug workflow
- `/Users/jonathanborduas/code/QGSD/.planning/formal/model-registry.json` — 201 models
- `/Users/jonathanborduas/code/QGSD/.planning/formal/requirements.json` — 371 requirements
- `.planning/PROJECT.md` — v0.38 milestone charter
