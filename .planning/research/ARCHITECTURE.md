# Architecture Research: Three-Layer Formal Verification

**Domain:** Formal verification pipeline integration (Evidence / Semantics / Reasoning)
**Researched:** 2026-03-06
**Confidence:** HIGH (based on deep analysis of existing codebase; no external dependencies to verify)

## System Overview

```
                          v0.29 Three-Layer Architecture
                          ==============================

   ┌──────────────────────────────────────────────────────────────────────┐
   │                    Layer 3: REASONING                               │
   │  ┌────────────┐ ┌──────────────┐ ┌────────────┐ ┌───────────────┐  │
   │  │  Hazard    │ │ Failure Mode │ │   Risk     │ │  Test Gen     │  │
   │  │  Model     │ │   Catalog    │ │  Rankings  │ │   Rules       │  │
   │  └─────┬──────┘ └──────┬───────┘ └─────┬──────┘ └──────┬────────┘  │
   │        │               │               │               │           │
   ├────────┴───────────────┴───────────────┴───────────────┴───────────┤
   │                         GATE B: Abstraction                        │
   │             (every L3 entity traces to L2 evidence)                │
   ├────────────────────────────────────────────────────────────────────┤
   │                    Layer 2: SEMANTICS                              │
   │  ┌────────────┐ ┌──────────────┐ ┌────────────┐ ┌───────────────┐  │
   │  │ Operational│ │  Invariant   │ │  Mismatch  │ │  Assumption   │  │
   │  │ State Mach │ │   Catalog    │ │  Register  │ │   Register    │  │
   │  └─────┬──────┘ └──────┬───────┘ └─────┬──────┘ └──────┬────────┘  │
   │        │               │               │               │           │
   ├────────┴───────────────┴───────────────┴───────────────┴───────────┤
   │                         GATE A: Grounding                          │
   │           (L2 must explain real traces; unexplained -> queue)      │
   ├────────────────────────────────────────────────────────────────────┤
   │                    Layer 1: EVIDENCE                               │
   │  ┌────────────┐ ┌──────────────┐ ┌────────────┐ ┌───────────────┐  │
   │  │ Instru-    │ │   Trace      │ │  Failure   │ │  State        │  │
   │  │ ment. Map  │ │   Corpus     │ │  Taxonomy  │ │  Candidates   │  │
   │  └────────────┘ └──────────────┘ └────────────┘ └───────────────┘  │
   └────────────────────────────────────────────────────────────────────┘
                              │
                     GATE C: Validation
          (L3 outputs map back to concrete test scenarios)
                              │
                     ┌────────┴────────┐
                     │ Existing Code   │
                     │ & Test Suite    │
                     └─────────────────┘
```

### How It Maps to Existing nForma Components

The three-layer architecture is NOT a replacement of existing FV infrastructure. It is a **categorization and enrichment layer** that organizes existing and new artifacts into a grounded chain. Most existing components slot into one or more layers:

| Layer | Existing Component | Current Location | Role in Three-Layer |
|-------|-------------------|-----------------|---------------------|
| L1 Evidence | `conformance-events.jsonl` | `.planning/` | Primary trace corpus |
| L1 Evidence | `validate-traces.cjs` | `bin/` | Trace replay & deviation scoring |
| L1 Evidence | `xstate-trace-walker.cjs` | `bin/` | Guard evaluation on real traces |
| L1 Evidence | Observe handlers (GitHub, Prometheus, etc.) | `bin/observe-handler-*.cjs` | Production signal collection |
| L1 Evidence | `debt.json` | `.planning/formal/` | Production debt entries |
| L2 Semantics | `nf-workflow.machine.js` | `dist/machines/` | Operational state machine |
| L2 Semantics | `spec/*/invariants.md` | `.planning/formal/spec/` | Invariant catalog (fairness + liveness) |
| L2 Semantics | `analyze-assumptions.cjs` | `bin/` | Assumption extraction from models |
| L2 Semantics | `assumption-gaps.md` | `.planning/formal/` | Assumption register (output) |
| L2 Semantics | `check-spec-sync.cjs` | `bin/` | XState-to-spec drift detection |
| L3 Reasoning | TLA+ models (`tla/*.tla`) | `.planning/formal/tla/` | Analytical models for model checking |
| L3 Reasoning | Alloy models (`alloy/*.als`) | `.planning/formal/alloy/` | Structural reasoning |
| L3 Reasoning | PRISM models (`prism/*.pm`) | `.planning/formal/prism/` | Probabilistic reasoning |
| L3 Reasoning | `sensitivity-report.cjs` | `bin/` | Parameter impact ranking |
| L3 Reasoning | `state-space-report.json` | `.planning/formal/` | Risk classification per model |
| Cross-layer | `traceability-matrix.json` | `.planning/formal/` | Requirement-property links (Gate B-like) |
| Cross-layer | `nf-solve.cjs` | `bin/` | R->F->T->C->D consistency solver |
| Cross-layer | `model-registry.json` | `.planning/formal/` | Model inventory with requirement links |
| Cross-layer | `run-formal-verify.cjs` | `bin/` | 34-step master verification runner |
| Cross-layer | `check-results.ndjson` | `.planning/formal/` | Unified check results store |

## Component Responsibilities

### New Components (must build)

| Component | Responsibility | Layer | Implementation |
|-----------|---------------|-------|----------------|
| `layer-manifest.json` | Central registry mapping every artifact to its layer (L1/L2/L3) and gate relationships | Cross-layer | JSON file in `.planning/formal/` |
| `instrumentation-map.cjs` | Scans codebase for hook emit points, trace emit points, observe handler registrations; outputs which code paths are instrumented vs dark | L1 | `bin/` script |
| `trace-corpus-stats.cjs` | Analyzes `conformance-events.jsonl` to produce coverage stats: which states visited, which transitions exercised, which never seen | L1 | `bin/` script |
| `failure-taxonomy.cjs` | Classifies observed failures from check-results, debt entries, and observe data into a structured taxonomy | L1 | `bin/` script |
| `state-candidates.cjs` | Extracts state candidates from trace data that are not yet represented in formal models | L1 | `bin/` script |
| `mismatch-register.cjs` | Compares L2 operational model against L1 traces; registers every unexplained behavior | L2 (Gate A) | `bin/` script |
| `invariant-catalog.cjs` | Aggregates invariants from all `spec/*/invariants.md` files plus TLA+ INVARIANT declarations into unified catalog with grounding status | L2 | `bin/` script |
| `gate-a-dashboard.cjs` | Gate A alignment report: % of traces explained by L2, unexplained behavior queue | Gate A | `bin/` script |
| `hazard-model.cjs` | Derives hazard scenarios from L2 state machine + invariant catalog: what can go wrong at each state | L3 | `bin/` script |
| `failure-mode-catalog.cjs` | Maps hazards to concrete failure modes with severity, probability, and detectability rankings | L3 | `bin/` script |
| `risk-heatmap.cjs` | Produces ranked risk list per state/transition from failure mode analysis | L3 | `bin/` script |
| `test-gen-rules.cjs` | Generates test scenarios from failure modes and hazards: counterexample-to-code translation | L3 (Gate C) | `bin/` script |
| `gate-b-check.cjs` | Gate B validator: every L3 hazard/failure-mode traces to L2 invariant or state; no hidden hazards | Gate B | `bin/` script |
| `gate-c-check.cjs` | Gate C validator: every L3 test-gen output maps to concrete runnable test scenario | Gate C | `bin/` script |

### Extended Components (modify existing)

| Component | Current State | Extension Needed |
|-----------|--------------|-----------------|
| `model-registry.json` | Has `models` with `requirements[]` | Add `layer` field (L1/L2/L3), `grounding_status` field |
| `check-result.schema.json` | Has formalism enum `[tla, alloy, prism, trace, redaction, uppaal]` | Add `layer` field, `gate` field (A/B/C/null) |
| `nf-solve.cjs` | 8 forward + 3 reverse layer transitions | Add three new gate-check layers: Gate-A, Gate-B, Gate-C as solve layers |
| `run-formal-verify.cjs` | 34+ verification steps | Add gate-check steps (gate-a-dashboard, gate-b-check, gate-c-check) |
| `formal-core.cjs` | Data loaders for TUI browsing | Add layer-manifest loader, gate status loaders |
| `nForma.cjs` (TUI) | Browse models, requirements, traceability | Add layer view, gate alignment dashboard |
| `generate-triage-bundle.cjs` | Produces diff-report.md + suspects.md | Include layer attribution in triage output |
| `analyze-assumptions.cjs` | Extracts assumptions from formal models | Feed assumption register as L2 artifact, cross-reference with L1 traces |

### Unchanged Components (consumed as-is)

| Component | Why Unchanged |
|-----------|--------------|
| `validate-traces.cjs` | Already produces L1 evidence; consumed by new L1 components |
| `xstate-trace-walker.cjs` | Trace replay library; used by mismatch-register |
| `observe-handler-*.cjs` | Production signal handlers; already produce L1 data |
| `xstate-to-tla.cjs` | XState-to-TLA+ generator; L2-to-L3 bridge already exists |
| `generate-formal-specs.cjs` | Alloy/PRISM generation; L2-to-L3 bridge already exists |
| `export-prism-constants.cjs` | Scoreboard-to-PRISM calibration; existing L1-to-L3 link |
| Hook files (`nf-*.js`) | Emit conformance events; already L1 producers |
| `debt-ledger.cjs`, `debt-dedup.cjs` | Debt management; L1 evidence producers |
| `requirements.json`, `requirements.schema.json` | Requirement definitions; orthogonal to layers |

## Recommended Project Structure

```
.planning/formal/
├── layer-manifest.json          # NEW: artifact-to-layer registry
├── gates/                       # NEW: gate check artifacts
│   ├── gate-a-report.json       #   L1-L2 grounding alignment
│   ├── gate-b-report.json       #   L2-L3 abstraction traceability
│   ├── gate-c-report.json       #   L3-code validation mapping
│   └── unexplained-queue.json   #   Gate A unexplained behaviors
├── evidence/                    # NEW: L1 curated artifacts
│   ├── instrumentation-map.json #   code instrumentation coverage
│   ├── trace-corpus-stats.json  #   trace coverage statistics
│   ├── failure-taxonomy.json    #   classified failure catalog
│   └── state-candidates.json    #   states seen but not modeled
├── semantics/                   # NEW: L2 curated artifacts
│   ├── invariant-catalog.json   #   unified invariant registry
│   └── mismatch-register.json   #   L1 vs L2 divergences
├── reasoning/                   # NEW: L3 curated artifacts
│   ├── hazard-model.json        #   derived hazard scenarios
│   ├── failure-mode-catalog.json#   FMEA-style failure analysis
│   ├── risk-heatmap.json        #   ranked risk per transition
│   └── test-gen-rules.json      #   generated test scenarios
├── model-registry.json          # EXTENDED: +layer, +grounding_status
├── check-result.schema.json     # EXTENDED: +layer, +gate fields
├── check-results.ndjson         # UNCHANGED: unified check results
├── traceability-matrix.json     # UNCHANGED: req-property links
├── assumption-gaps.md           # RECLASSIFIED: becomes L2 artifact
├── spec/                        # UNCHANGED: invariant declarations
├── tla/                         # UNCHANGED: TLA+ models (L3)
├── alloy/                       # UNCHANGED: Alloy models (L3)
├── prism/                       # UNCHANGED: PRISM models (L3)
└── ...
```

### Structure Rationale

- **`evidence/`, `semantics/`, `reasoning/`:** Separate directories for curated per-layer artifacts. These are outputs of analysis scripts, not raw data. The raw data stays where it is (conformance-events.jsonl, check-results.ndjson, etc.).
- **`gates/`:** Gate check results get their own directory because gates are cross-layer concerns. They need to be queryable independently ("show me all grounding gaps").
- **`layer-manifest.json`:** Single source of truth for which artifact belongs to which layer. Enables the TUI layer view and gate-check scripts to auto-discover artifacts without hardcoding paths.
- **Existing directories unchanged:** `tla/`, `alloy/`, `prism/`, `spec/` stay in place. No migration needed. The layer-manifest classifies them without moving them.

## Architectural Patterns

### Pattern 1: Layer Manifest as Registry

**What:** A single `layer-manifest.json` file maps every formal artifact to its layer, gate relationships, and grounding status. All new scripts read this manifest to discover artifacts rather than hardcoding paths.

**When to use:** Every new three-layer script should read the manifest rather than scanning directories directly.

**Trade-offs:** Adds one more registry file to maintain (alongside model-registry.json). But prevents the alternative: N scripts each hardcoding their own artifact discovery logic.

**Example:**
```json
{
  "schema_version": "1",
  "artifacts": {
    ".planning/conformance-events.jsonl": {
      "layer": "L1",
      "type": "trace_corpus",
      "producer": "hooks/nf-prompt.js",
      "consumers": ["mismatch-register.cjs", "trace-corpus-stats.cjs"]
    },
    ".planning/formal/tla/QGSDQuorum.tla": {
      "layer": "L3",
      "type": "analytical_model",
      "grounded_via": "gate-b",
      "l2_sources": ["nf-workflow.machine.js", "spec/quorum/invariants.md"],
      "requirements": ["R3.1", "R3.2"]
    }
  }
}
```

### Pattern 2: Gate Checks as nf-solve Layers

**What:** Gate A, B, and C are implemented as additional layer transitions in `nf-solve.cjs`, following the existing R->F->T->C->D pattern. Each gate produces a residual vector (list of gaps) and optionally auto-closes gaps.

**When to use:** Always. The solve loop is the right place because gates are consistency checks (just like R->F checks "do requirements have formal models?"). Gate A checks "do traces have semantic explanations?". Gate B checks "do analytical models trace to semantic entities?". Gate C checks "do analytical outputs map to tests?".

**Trade-offs:** Makes nf-solve larger (currently 8+3 layers, adding 3 more). But keeps all consistency checking in one place with one convergence loop.

**New solve layer transitions:**
```
Existing:  R->F  F->T  C->F  T->C  F->C  R->D  D->C  P->F  (forward)
           C->R  T->R  D->R                               (reverse)

New:       L1->L2 (Gate A): Evidence without semantic explanation
           L2->L3 (Gate B): Semantics without analytical backing
           L3->TC (Gate C): Reasoning outputs without test coverage
```

### Pattern 3: Progressive Maturity per Model

**What:** Not every formal model needs all three layers immediately. Each model progresses through maturity levels: Level 0 (L3 only, no grounding), Level 1 (L3 + L2 semantics), Level 2 (L3 + L2 + L1 evidence), Level 3 (all three layers + all gates pass).

**When to use:** For the rollout plan. Existing models start at Level 0 (they have L3 TLA+/Alloy/PRISM but most lack explicit L1/L2 artifacts). The milestone should prioritize getting a few models to Level 3 as exemplars, then progressively mature the rest.

**Trade-offs:** Adds a maturity field to track per-model. But prevents the "boil the ocean" anti-pattern where all 43 model files need full three-layer treatment before anything ships.

**Example maturity levels:**
```
Level 0: L3 only           -> 43 models (current state)
Level 1: L3 + L2 invariants -> ~17 models (those with spec/*/invariants.md)
Level 2: L3 + L2 + L1 trace -> ~5 models (those with conformance event coverage)
Level 3: All layers + gates  -> 0 models (target for v0.29)
```

### Pattern 4: Gate Alignment Dashboard (Quantitative)

**What:** Each gate produces a numeric alignment score (0-100%) that feeds into the nForma TUI and solve reports. Gate A: % of traces explained. Gate B: % of L3 entities with L2 traceability. Gate C: % of failure modes with test coverage.

**When to use:** As the primary progress metric for the milestone. "Gate A at 85% explained" is more useful than "Gate A implemented."

**Trade-offs:** Requires defining "explained" precisely for Gate A (is a trace explained if the state machine accepts it? or if every guard evaluation matches expectation?). Recommend using the existing deviation score from `validate-traces.cjs` as the base metric: % of events that are valid XState transitions = Gate A alignment.

## Data Flow

### Evidence Collection (L1)

```
Hook emit -> conformance-events.jsonl -> trace-corpus-stats.cjs -> trace-corpus-stats.json
                                      -> failure-taxonomy.cjs    -> failure-taxonomy.json
                                      -> state-candidates.cjs    -> state-candidates.json

Observe handlers -> debt.json         -> failure-taxonomy.cjs    -> failure-taxonomy.json
                 -> issues/drifts     -> failure-taxonomy.cjs    -> failure-taxonomy.json

Code scan        -> instrumentation-map.cjs -> instrumentation-map.json
```

### Grounding Gate (L1 -> L2)

```
conformance-events.jsonl ---+
                            +-> mismatch-register.cjs -> mismatch-register.json
nf-workflow.machine.js -----+                         -> gate-a-report.json
                                                      -> unexplained-queue.json
```

### Semantic Derivation (L2)

```
spec/*/invariants.md -------+
TLA+ INVARIANT decls -------+-> invariant-catalog.cjs -> invariant-catalog.json
                            |
analyze-assumptions.cjs ----+-> assumption-register (already exists as assumption-gaps.md)
```

### Abstraction Gate (L2 -> L3)

```
invariant-catalog.json -----+
                            +-> gate-b-check.cjs -> gate-b-report.json
model-registry.json --------+   (checks: every TLA+/Alloy property traces to L2 invariant)
```

### Reasoning Derivation (L3)

```
TLA+ models ----------------+
Alloy models ---------------+-> hazard-model.cjs    -> hazard-model.json
PRISM models ---------------+-> failure-mode-catalog -> failure-mode-catalog.json
state-space-report.json ----+-> risk-heatmap.cjs    -> risk-heatmap.json
```

### Validation Gate (L3 -> Code)

```
failure-mode-catalog.json --+
                            +-> test-gen-rules.cjs -> test-gen-rules.json
hazard-model.json ----------+                     -> gate-c-report.json
                                                  -> (feeds into plan-phase test recommendations)
```

### Integration with Existing Pipelines

```
                    run-formal-verify.cjs (34+ steps)
                              |
                    +---------+---------+
                    | existing steps    |
                    | (tla, alloy,      |
                    |  prism, ci, ...)  |
                    +---------+---------+
                              |
                    +---------+------------------+
                    | NEW gate-check steps       |
                    | gate-a-dashboard.cjs       |
                    | gate-b-check.cjs           |
                    | gate-c-check.cjs           |
                    +---------+------------------+
                              |
                    check-results.ndjson (all results unified)
                              |
                    nf-solve.cjs (convergence loop)
                    +---------+------------------+
                    | existing: R->F, F->T, etc. |
                    | NEW: L1->L2, L2->L3, L3->TC|
                    +----------------------------+
```

## Integration Points

### With Existing Hooks (L1 Producers)

| Hook | What It Produces | Layer Role |
|------|-----------------|------------|
| `nf-prompt.js` (UserPromptSubmit) | Quorum instructions injection, conformance events | L1: trace corpus entries |
| `nf-stop.js` (Stop) | Quorum verification events | L1: verification outcome traces |
| `nf-circuit-breaker.js` (PreToolUse) | Oscillation detection events | L1: failure evidence |

Hooks are **unchanged**. They already emit to `conformance-events.jsonl`. New L1 scripts read from that file.

### With XState Machine (L2 Bridge)

| Component | Integration |
|-----------|------------|
| `nf-workflow.machine.js` | Read by mismatch-register as the "expected" operational model (L2) |
| `xstate-to-tla.cjs` | Existing L2->L3 bridge (XState to TLA+); unchanged but now explicitly categorized |
| `generate-formal-specs.cjs` | Existing L2->L3 bridge (XState to Alloy/PRISM); unchanged |
| `check-spec-sync.cjs` | Existing L2 drift detector; feeds mismatch-register |

### With nf-solve (Cross-Layer Consistency)

The solve loop gets 3 new layer transitions. Each follows the existing pattern:

```javascript
// In nf-solve.cjs, new layer sweep functions:
function sweepGateA(reportOnly) {
  // Spawn: node bin/gate-a-dashboard.cjs --json
  // Parse: { alignment_pct, unexplained_count, unexplained_behaviors[] }
  // If !reportOnly && auto-closeable: attempt auto-explain via mismatch-register
  // Return: { layer: 'L1->L2', gaps: unexplained_count, closedAutomatically: N }
}

function sweepGateB(reportOnly) {
  // Spawn: node bin/gate-b-check.cjs --json
  // Parse: { coverage_pct, untraced_hazards[], orphan_properties[] }
  // Return: { layer: 'L2->L3', gaps: untraced_count, closedAutomatically: 0 }
}

function sweepGateC(reportOnly) {
  // Spawn: node bin/gate-c-check.cjs --json
  // Parse: { coverage_pct, untested_failure_modes[] }
  // Return: { layer: 'L3->TC', gaps: untested_count, closedAutomatically: 0 }
}
```

### With run-formal-verify (Master Runner)

Three new step groups added to the 34+ step pipeline:

```javascript
// New --only=gates filter
const GATE_STEPS = [
  { name: 'gate-a-dashboard', script: 'gate-a-dashboard.cjs', args: [] },
  { name: 'gate-b-check',     script: 'gate-b-check.cjs',     args: [] },
  { name: 'gate-c-check',     script: 'gate-c-check.cjs',     args: [] },
];
```

Gate checks run AFTER all model-checker steps (they consume check-results.ndjson). They emit to check-results.ndjson with `formalism: "gate"` and `gate: "A"|"B"|"C"`.

### With TUI (formal-core.cjs + nForma.cjs)

New views:
1. **Layer View** -- tree organized by L1/L2/L3 instead of by formalism
2. **Gate Dashboard** -- three-panel view showing alignment percentages
3. **Unexplained Queue** -- list of L1 behaviors not explained by L2

Data loading via `formal-core.cjs`:
```javascript
function loadLayerManifest(basePath) { ... }
function loadGateReport(basePath, gate) { ... }  // gate = 'a'|'b'|'c'
function loadUnexplainedQueue(basePath) { ... }
```

### With Plan-Phase Workflow

Gate results feed into planning as context (like sensitivity sweep results do today):

```markdown
<!-- In plan-phase.md, after step 8.2 (formal verify) -->
8.3 Read gate alignment reports:
    - Gate A alignment: {pct}% (unexplained: {N})
    - Gate B coverage: {pct}% (untraced: {N})
    - Gate C validation: {pct}% (untested: {N})
    Inject into quorum review_context as GATE_ALIGNMENT_CONTEXT.
```

## Suggested Build Order

### Phase 1: Layer Manifest & L1 Evidence Foundation

**Rationale:** Everything depends on knowing which artifact belongs to which layer. L1 is the foundation -- you cannot build gates or higher layers without evidence data.

**Deliverables:**
1. `layer-manifest.json` schema + initial population script
2. `instrumentation-map.cjs` -- scan codebase for emit points
3. `trace-corpus-stats.cjs` -- analyze conformance-events.jsonl coverage
4. `failure-taxonomy.cjs` -- classify failures from check-results + debt
5. `state-candidates.cjs` -- extract unmodeled states from traces
6. Extend `model-registry.json` schema with `layer` field
7. Extend `check-result.schema.json` with `layer` and `gate` fields

**Dependencies:** None. Uses only existing data files.

### Phase 2: L2 Semantics & Gate A (Grounding)

**Rationale:** L2 is the bridge between evidence and reasoning. Gate A is the most important gate because it answers "does our model match reality?" The existing `validate-traces.cjs` deviation score already provides the core metric.

**Deliverables:**
1. `invariant-catalog.cjs` -- aggregate invariants from all sources
2. `mismatch-register.cjs` -- compare L2 operational model against L1 traces
3. `gate-a-dashboard.cjs` -- alignment report with unexplained behavior queue
4. Wire Gate A into `run-formal-verify.cjs` as a step
5. Add `L1->L2` sweep to `nf-solve.cjs`

**Dependencies:** Phase 1 (needs trace-corpus-stats, failure-taxonomy as inputs).

### Phase 3: L3 Reasoning Enrichment & Gate B (Abstraction)

**Rationale:** L3 mostly already exists (TLA+/Alloy/PRISM models). This phase adds structured hazard/failure analysis on top, plus Gate B traceability enforcement.

**Deliverables:**
1. `hazard-model.cjs` -- derive hazards from L2 state machine + invariants
2. `failure-mode-catalog.cjs` -- FMEA-style analysis
3. `risk-heatmap.cjs` -- ranked risk per state/transition
4. `gate-b-check.cjs` -- verify L3-to-L2 traceability
5. Wire Gate B into `run-formal-verify.cjs`
6. Add `L2->L3` sweep to `nf-solve.cjs`

**Dependencies:** Phase 2 (needs invariant-catalog, mismatch-register).

### Phase 4: Gate C (Validation) & Test Generation

**Rationale:** Gate C is the "close the loop" gate -- it ensures reasoning outputs are actionable. Test generation is the highest-value deliverable for end users.

**Deliverables:**
1. `test-gen-rules.cjs` -- generate test scenarios from failure modes
2. `gate-c-check.cjs` -- verify L3 outputs map to tests
3. Wire Gate C into `run-formal-verify.cjs`
4. Add `L3->TC` sweep to `nf-solve.cjs`
5. Wire gate alignment context into `plan-phase.md` (step 8.3)

**Dependencies:** Phase 3 (needs hazard-model, failure-mode-catalog).

### Phase 5: TUI Integration & Progressive Maturity

**Rationale:** User-facing dashboard comes last because it needs all gates operational to show useful data.

**Deliverables:**
1. Extend `formal-core.cjs` with layer/gate data loaders
2. Add layer view to `nForma.cjs` TUI
3. Add gate dashboard to TUI
4. Per-model maturity tracking (Level 0-3)
5. Maturity rollout for top-priority models (target: 3+ models at Level 3)

**Dependencies:** Phases 1-4 (needs all gates producing reports).

## Anti-Patterns

### Anti-Pattern 1: Moving Existing Files into Layer Directories

**What people do:** Move `tla/*.tla` into `reasoning/tla/`, move conformance-events.jsonl into `evidence/`, etc.

**Why it is wrong:** Breaks every existing script that references these paths. The entire bin/ directory has hardcoded paths to `.planning/formal/tla/`, `.planning/formal/alloy/`, etc. Moving files would require updating 150+ scripts and tests.

**Do this instead:** Leave files where they are. The `layer-manifest.json` provides the layer classification without moving anything. New layer-specific curated artifacts go into `evidence/`, `semantics/`, `reasoning/` directories.

### Anti-Pattern 2: Gate Checks That Block CI

**What people do:** Make Gate A/B/C failures block the formal verification pipeline immediately.

**Why it is wrong:** All 43 existing models start at Level 0 (no grounding). If Gate A blocks, nothing passes on day one. The pipeline becomes unusable until every model has full three-layer coverage.

**Do this instead:** Gate checks produce `result: "warn"` in check-results.ndjson initially. Add a `--strict-gates` flag to `run-formal-verify.cjs` that promotes warnings to failures, but leave it off by default until alignment scores reach a configurable threshold (e.g., 70%).

### Anti-Pattern 3: Building L3 Before L1

**What people do:** Start with the interesting analytical layer (hazard models, test generation) because it is the most visible feature.

**Why it is wrong:** L3 outputs without L1 grounding are opinions, not facts. A hazard model that is not grounded in observed behavior is speculation. Gate B would have nothing to check against.

**Do this instead:** Build bottom-up: L1 first, then L2 + Gate A, then L3 + Gate B, then Gate C. This ensures every layer has a foundation.

### Anti-Pattern 4: One Monolithic Gate Script

**What people do:** Put all gate logic in a single `check-gates.cjs` script.

**Why it is wrong:** Gates have different data dependencies, different run times, and different failure semantics. Gate A needs trace replay (slow). Gate B needs model registry scan (fast). Gate C needs test file scanning (medium). Combining them prevents `--only=gate-a` filtering and makes debugging harder.

**Do this instead:** Three separate scripts (gate-a-dashboard.cjs, gate-b-check.cjs, gate-c-check.cjs), each emitting to check-results.ndjson with standard schema. The master runner orchestrates them.

## Scaling Considerations

| Concern | Current (43 models) | At 100 models | At 200+ models |
|---------|---------------------|---------------|----------------|
| Layer manifest size | ~5KB JSON | ~15KB JSON | ~30KB JSON, still trivial |
| Gate A runtime | <5s (replay traces) | <10s | Consider caching trace-corpus-stats |
| Gate B runtime | <2s (registry scan) | <5s | Acceptable |
| Gate C runtime | <3s (test file scan) | <8s | Acceptable |
| run-formal-verify total | ~3min (34 steps) | ~5min (37 steps) | Consider --only=gates for quick checks |
| nf-solve convergence | 3 iterations max | May need 4-5 | Monitor iteration count; add gate-specific --fast skip |

### Scaling Priorities

1. **First bottleneck:** Gate A trace replay. The `validate-traces.cjs` already processes the full conformance log sequentially. If the log grows past 50K events, the mismatch-register should use incremental processing (only analyze events since last run, tracked via a watermark).
2. **Second bottleneck:** Layer manifest staleness. If models are added/removed frequently, the manifest needs an auto-update hook (similar to the existing PostToolUse auto-regen for XState specs). Can reuse the same hook mechanism.

## Sources

- Existing codebase analysis: `bin/run-formal-verify.cjs` (34-step pipeline architecture)
- Existing codebase analysis: `bin/nf-solve.cjs` (8+3 layer consistency solver)
- Existing codebase analysis: `bin/validate-traces.cjs` (trace replay with deviation scoring)
- Existing codebase analysis: `bin/xstate-trace-walker.cjs` (guard evaluation library)
- Existing codebase analysis: `bin/analyze-assumptions.cjs` (assumption extraction)
- Existing codebase analysis: `bin/analyze-state-space.cjs` (state-space risk classification)
- Existing codebase analysis: `.planning/formal/model-registry.json` (model inventory)
- Existing codebase analysis: `.planning/formal/check-result.schema.json` (check result format)
- Existing codebase analysis: `.planning/formal/trace/trace.schema.json` (conformance event schema)
- Existing codebase analysis: `.planning/formal/spec/*/invariants.md` (fairness declarations)
- v0.29 milestone description in `.planning/PROJECT.md`

---
*Architecture research for: Three-Layer Formal Verification (Evidence / Semantics / Reasoning)*
*Researched: 2026-03-06*
