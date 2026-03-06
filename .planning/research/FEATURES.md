# Feature Research

**Domain:** Three-layer formal verification architecture (Evidence / Semantics / Reasoning) for CLI-based agent orchestration tool
**Researched:** 2026-03-06
**Confidence:** MEDIUM — domain patterns synthesized from formal methods literature, FMEA standards, model-based testing research, and existing nForma FV infrastructure; no single canonical "three-layer FV" framework exists so the architecture is novel synthesis

## Feature Landscape

### Table Stakes (Users Expect These)

Features that a three-layer FV system must have to be considered functional. Missing any of these means the layer boundaries are decorative rather than structural.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Instrumentation Map** (L1) | Without a map of what is instrumented vs. not, you cannot know where evidence is absent vs. where the system is healthy. Coverage blind spots create false confidence. | MEDIUM | Builds on existing `conformance-events.jsonl` and trace schema. Must catalog every hook/handler emission point and map to state variables. Output: `instrumentation-map.json` listing source files, event types, and mapped state variables. |
| **Trace Corpus with Structured Metadata** (L1) | Raw traces are useless without structured indexing. Every formal methods paper on trace-to-model derivation assumes a queryable corpus, not flat log files. | MEDIUM | Extend existing JSONL traces with corpus management: indexing by session, action type, state transition. Depends on existing trace schema (`trace.schema.json`). |
| **Failure Taxonomy** (L1) | Distinguishing failure classes (timeout vs. crash vs. logic error vs. degradation) is prerequisite for any failure mode analysis at L3. FMEA requires classified failure modes as input. | LOW | Parse existing check-results.ndjson and telemetry JSONL to classify failures. Taxonomy: crash, timeout, logic-violation, drift, degradation. |
| **Operational State Machine** (L2) | The core of L2 — a state machine derived from observed traces, not hand-written specs. Must be comparable to hand-written TLA+/XState models. Without this, L2 has no formal object. | HIGH | State machine inference from traces is a well-studied problem (EFSM inference). But nForma already has hand-written XState + TLA+ models. The real work is deriving an observed-behavior state machine and comparing it to the specified one. |
| **Invariant Catalog** (L2) | List of invariants discovered from traces (via mining) merged with declared invariants from specs. L3 hazard analysis needs this as input. | MEDIUM | Extend existing `invariants.md` files (15 spec dirs) with observed-invariant mining. Leverage existing debug-discovered invariant pipeline from v0.21. |
| **Grounding Gate (Gate A)** | L2 must explain real traces. Without measurable alignment between L2 model and L1 evidence, the three-layer architecture collapses to the same "hand-written specs with no evidence" problem nForma already has. | HIGH | This is the hardest table-stakes feature. Requires: (1) replay traces against L2 model, (2) measure explanation rate, (3) queue unexplained behaviors. Existing conformance trace validation (`validate-traces.cjs`) is a starting point but currently has 0% coverage per `coverage-gaps.md`. |
| **Abstraction Gate (Gate B)** | L3 must be traceable to L2. Without this, hazard models are disconnected speculation. | MEDIUM | Build an abstraction map: every L3 hazard/failure-mode links to L2 states/transitions. Structural check: no L3 element without L2 backing. |
| **Validation Gate (Gate C)** | L3 outputs must map back to testable code scenarios. Without this, the analysis produces untestable claims. | MEDIUM | Counterexample-to-code translation. Extends existing `attribute-trace-divergence.cjs` pattern. Each L3 finding must produce a concrete test scenario. |
| **Mismatch Register** (L2) | When L2 model disagrees with L1 traces, the disagreements must be tracked, not silently ignored. This is the "unexplained behavior queue" from the v0.29 description. | LOW | Simple JSONL ledger of (trace_id, expected_state, observed_state, resolution_status). Pattern mirrors existing debt ledger (`debt.json`). |
| **Hazard Model** (L3) | Enumeration of what can go wrong, derived from L2 state machine analysis. This is software FMEA applied to the operational model. | HIGH | For each L2 state and transition: what failure modes exist? What are their effects? What is their severity? Standard FMEA methodology (Severity x Occurrence x Detection = RPN) applied to formal model states. |

### Differentiators (Competitive Advantage)

Features that go beyond the structural minimum and make the three-layer architecture genuinely powerful. These are where nForma's FV pipeline becomes more than a compliance checkbox.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Risk Heatmap with Ranked Transitions** | Visual risk ranking across the entire state space — immediately shows where to focus testing and review. No existing CLI FV tool produces this. Combines FMEA severity/occurrence data with state-space coverage data to produce actionable ranked lists. | MEDIUM | Input: L3 hazard model + L1 coverage data. Output: ranked transition list (highest-risk-first) and optional terminal-rendered heatmap. Risk = (failure severity) x (1 - coverage). |
| **Model-Driven Test Generation** | Automatically generate test scenarios from L3 failure mode analysis. Each identified hazard produces a concrete test case targeting the uncovered failure path. Closes the loop: formal analysis produces tests, not just reports. | HIGH | Extends existing TLC counterexample handling. For each L3 failure mode: generate a test recipe (input sequence + expected outcome + oracle). Output format: test recipe JSON compatible with existing `generated-stubs/` pattern. Requires Gate C (validation gate) as prerequisite. |
| **Design Impact Analysis** | When a code change is proposed, trace through all three layers to show: what evidence changes (L1), what model transitions are affected (L2), what hazards shift (L3). No manual "what might break?" — the layers answer it structurally. | HIGH | Requires: file-to-instrumentation mapping (L1), instrumentation-to-state mapping (L2), state-to-hazard mapping (L3). Given a `git diff`, walk the chain and produce an impact report. |
| **Cross-Layer Alignment Dashboard** | Single-view report showing: L1 coverage %, L2 grounding rate (Gate A score), L3 abstraction completeness (Gate B score), validation rate (Gate C score). Makes three-layer health visible at a glance. | MEDIUM | Aggregation report from gate scores. Terminal-renderable table. JSON backing for programmatic consumption. Pattern: similar to existing `diff-report.md` and `sensitivity-report.cjs`. |
| **Progressive Model Maturity Tracking** | Per-model rollout: track which of the 92 registered models have L1 evidence, L2 grounding, L3 analysis. Shows FV maturity as a percentage, not binary. Enables incremental adoption without blocking on full coverage. | LOW | Extend `model-registry.json` with `layer_maturity: { L1: bool, L2: bool, L3: bool }` fields. Dashboard consumes this. |
| **Assumption Register** (L2) | Explicit catalog of assumptions made when deriving L2 from L1. Makes hidden modeling decisions visible and auditable. When assumptions are violated by new evidence, triggers re-analysis. | LOW | Structured JSON register. Each entry: assumption text, source (which trace gap motivated it), validation status, linked L2 states. |
| **Automated State Candidate Extraction** (L1) | Mine traces to suggest state variables and transitions that the hand-written models may have missed. Reduces the "you only verify what you already knew" problem. | MEDIUM | Trace clustering + transition pattern detection. Output: suggested state candidates with evidence counts. Human reviews before L2 promotion. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time Streaming Dashboard** | "Show me verification results as they happen." Sounds modern and responsive. | nForma runs in CLI sessions, not as a long-running service. Real-time dashboards require a persistent server, WebSocket infrastructure, and continuous monitoring — none of which exist or are needed. The session-based execution model makes batch reporting the natural fit. | Batch alignment report generated at milestone boundaries. `--watch` flag on the dashboard command for iterative sessions. |
| **Full Automated State Machine Inference** | "Derive the complete state machine from traces alone, no hand-written specs needed." Sounds like the ultimate automation. | State machine inference from traces is fundamentally incomplete — you can only infer what you've observed. nForma already has 22 TLA+ models and 15 spec directories hand-written by domain experts. Replacing them with inferred models would lose intentional design constraints. | Use inference as a _supplement_: mine traces for state candidates, compare against existing specs, surface discrepancies. The hand-written model is the source of truth; the inferred model is the challenger. |
| **Probabilistic Risk Quantification** | "Give me exact failure probabilities for every hazard." Sounds rigorous and scientific. | PRISM already provides probabilistic model checking, but the underlying probability estimates are calibrated from limited empirical data (scoreboard). Presenting these as precise risk numbers creates false confidence. The sample sizes are too small for actuarial-grade quantification. | Use qualitative risk ranking (High/Medium/Low) with quantitative backing where available. Show confidence intervals, not point estimates. Flag when sample size is below threshold. |
| **Universal Code Instrumentation** | "Instrument every function and branch for complete evidence." Sounds like it solves the coverage problem. | Instrumentation overhead in hooks is performance-critical (hooks run on every tool call). Over-instrumentation would slow every Claude Code interaction. Most code paths are irrelevant to formal properties. | Targeted instrumentation: only instrument state-changing code paths that map to formal model variables. Use the instrumentation map to identify gaps, not blanket coverage. |
| **Cross-Project Model Reuse** | "Make the three-layer models portable across different projects." Sounds like good engineering. | nForma's formal models are deeply specific to its own agent orchestration semantics. The quorum state machine, circuit breaker, and hook lifecycle are not generalizable patterns. Abstracting them would dilute the models without adding value. | Keep models project-specific. If a second project adopts nForma, it builds its own three-layer stack using the same tooling but different models. |

## Feature Dependencies

```
[Instrumentation Map (L1)]
    |
    +--requires--> [Trace Corpus (L1)]
    |                  |
    |                  +--requires--> [Failure Taxonomy (L1)]
    |                  |
    |                  +--feeds--> [State Candidate Extraction (L1)]
    |
    +--feeds--> [Operational State Machine (L2)]
                    |
                    +--requires--> [Invariant Catalog (L2)]
                    |
                    +--requires--> [Mismatch Register (L2)]
                    |
                    +--requires--> [Assumption Register (L2)]
                    |
                    +--validated-by--> [Grounding Gate (Gate A)]
                    |                      |
                    |                      +--requires--> [Trace Corpus (L1)]
                    |
                    +--feeds--> [Hazard Model (L3)]
                                    |
                                    +--validated-by--> [Abstraction Gate (Gate B)]
                                    |
                                    +--feeds--> [Risk Heatmap]
                                    |
                                    +--feeds--> [Test Generation]
                                    |               |
                                    |               +--validated-by--> [Validation Gate (Gate C)]
                                    |
                                    +--feeds--> [Design Impact Analysis]
                                                    |
                                                    +--requires--> [Instrumentation Map (L1)]

[Gate A + Gate B + Gate C] --feeds--> [Cross-Layer Alignment Dashboard]

[Model Registry (existing)] --extended-by--> [Progressive Maturity Tracking]
```

### Dependency Notes

- **Operational State Machine (L2) requires Instrumentation Map (L1):** You cannot derive an observed-behavior model without knowing what is being observed and where the observation gaps are.
- **Grounding Gate (Gate A) requires both L1 Trace Corpus and L2 Operational State Machine:** The gate replays traces against the model — both must exist.
- **Hazard Model (L3) requires L2 Operational State Machine:** FMEA analysis operates on state machine transitions. Without L2, L3 has nothing to analyze.
- **Test Generation requires both L3 Hazard Model and Gate C:** Tests are generated from failure modes (L3) and validated for concrete executability (Gate C).
- **Design Impact Analysis requires all three layers:** It traces a code change through L1 (instrumentation), L2 (state effects), and L3 (hazard shifts).
- **Cross-Layer Alignment Dashboard requires all three gates:** It aggregates gate scores into a single health view.

### Dependencies on Existing FV Pipeline

| Existing Feature | How Three-Layer Uses It |
|-----------------|------------------------|
| `conformance-events.jsonl` + trace schema | L1 trace corpus foundation — extend, don't replace |
| `validate-traces.cjs` | Gate A starting point — extend with replay-against-model logic |
| 22 TLA+ models + XState machine | L2 "specified model" to compare against L2 "observed model" |
| `invariants.md` (15 spec dirs) | L2 invariant catalog baseline — merge with mined invariants |
| `check-results.ndjson` + check-result schema | L1 failure taxonomy input — classify existing results |
| `model-registry.json` (92 models) | Progressive maturity tracking extension point |
| `attribute-trace-divergence.cjs` | Gate C counterexample-to-code starting point |
| `generated-stubs/*.recipe.json` | Test generation output format template |
| `debt.json` + debt schema | Mismatch register pattern — follow same ledger design |
| `traceability-matrix.json` (63.8% coverage) | Gate B abstraction map — extend with L2-to-L3 links |
| `coverage-gaps.md` | Risk heatmap input — states reachable by TLC but unobserved |
| Sensitivity sweep pipeline | Risk ranking input — parameter sensitivity feeds hazard severity |
| PRISM probabilistic checking | Hazard occurrence estimation — calibrate from PRISM priors |
| `diff-report.md` + `suspects.md` | Design impact analysis pattern — extend with three-layer tracing |

## MVP Definition

### Launch With (Phase 1-2: Foundation)

Minimum viable three-layer architecture — the layers exist, one gate works end-to-end for at least one model.

- [ ] **Instrumentation Map** — catalog all emission points in hooks, map to state variables, identify gaps. Without this, no evidence layer exists.
- [ ] **Trace Corpus Management** — index existing conformance events with structured metadata, make queryable by session/action/state.
- [ ] **Failure Taxonomy** — classify existing check-results and telemetry into failure categories.
- [ ] **State Candidate Extraction** — mine traces for state variables and transitions not in current specs.
- [ ] **Operational State Machine (for one model)** — derive observed-behavior FSM from traces for one domain (e.g., quorum lifecycle), compare against existing TLA+ spec.
- [ ] **Mismatch Register** — track divergences between observed and specified behavior.
- [ ] **Grounding Gate (Gate A) for one model** — replay traces against L2 model, measure explanation rate, queue unexplained behaviors.

### Add After Validation (Phase 3: Reasoning Layer)

Once L1 and L2 are proven for one model, build L3 analysis on top.

- [ ] **Invariant Catalog** — merge declared + mined invariants into unified catalog.
- [ ] **Assumption Register** — make hidden L2 assumptions explicit.
- [ ] **Hazard Model (FMEA)** — failure mode enumeration for L2 states/transitions.
- [ ] **Abstraction Gate (Gate B)** — verify every L3 hazard traces to L2 elements.
- [ ] **Validation Gate (Gate C)** — verify every L3 finding maps to a concrete test scenario.
- [ ] **Risk Heatmap** — ranked transitions by risk score.

### Future Consideration (Phase 4+: Integration)

Features that require all three layers to be stable before they add value.

- [ ] **Model-Driven Test Generation** — automated test recipe creation from L3 failure modes. Defer until Gate C is reliable.
- [ ] **Design Impact Analysis** — three-layer change tracing. Defer until all layers are populated for multiple models.
- [ ] **Cross-Layer Alignment Dashboard** — aggregated health view. Defer until all three gates produce stable scores.
- [ ] **Progressive Maturity Tracking** — per-model L1/L2/L3 maturity. Defer until the model registry extension is designed.
- [ ] **Multi-model rollout** — extend three-layer coverage from one model to all 92. Defer until the single-model pipeline is validated.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Layer |
|---------|------------|---------------------|----------|-------|
| Instrumentation Map | HIGH | MEDIUM | P1 | L1 |
| Trace Corpus Management | HIGH | MEDIUM | P1 | L1 |
| Failure Taxonomy | MEDIUM | LOW | P1 | L1 |
| State Candidate Extraction | MEDIUM | MEDIUM | P1 | L1 |
| Operational State Machine | HIGH | HIGH | P1 | L2 |
| Mismatch Register | HIGH | LOW | P1 | L2 |
| Grounding Gate (Gate A) | HIGH | HIGH | P1 | Gate |
| Invariant Catalog | MEDIUM | MEDIUM | P2 | L2 |
| Assumption Register | MEDIUM | LOW | P2 | L2 |
| Hazard Model (FMEA) | HIGH | HIGH | P2 | L3 |
| Abstraction Gate (Gate B) | HIGH | MEDIUM | P2 | Gate |
| Validation Gate (Gate C) | HIGH | MEDIUM | P2 | Gate |
| Risk Heatmap | HIGH | MEDIUM | P2 | L3 |
| Model-Driven Test Generation | HIGH | HIGH | P3 | L3 |
| Design Impact Analysis | HIGH | HIGH | P3 | Cross |
| Cross-Layer Alignment Dashboard | MEDIUM | MEDIUM | P3 | Cross |
| Progressive Maturity Tracking | LOW | LOW | P3 | Cross |

**Priority key:**
- P1: Must have for launch — establishes L1, L2, and the grounding gate
- P2: Should have — completes L3 and remaining gates
- P3: Nice to have — cross-layer integration and automation

## Comparable Tools & Approaches

| Feature | FMEA (IEC 60812) | TLA+ Toolbox | Alloy Analyzer | nForma v0.29 Approach |
|---------|-------------------|--------------|----------------|----------------------|
| Failure enumeration | Manual expert process | Counterexample discovery | Instance finding | Automated from L2 state machine + FMEA methodology |
| Trace analysis | Not applicable | TLC trace replay | Not applicable | L1 corpus with structured indexing and mining |
| Risk ranking | RPN (Severity x Occurrence x Detection) | Not built-in | Not built-in | Modified RPN: Severity from FMEA, Occurrence from PRISM, Detection from coverage gaps |
| Test generation | Manual from FMEA results | Manual from counterexamples | Manual from instances | Automated: L3 failure mode to test recipe JSON |
| Cross-layer tracing | Not applicable | Not applicable | Not applicable | Three gates (A/B/C) with measurable alignment scores |
| Change impact | Manual re-analysis | Re-run TLC | Re-run Alloy | Automated: git diff to three-layer impact report |

## Sources

- [Inferring Computational State Machine Models from Program Executions](https://ieeexplore.ieee.org/document/7816460/) — state machine inference from traces
- [Inferring Extended Finite State Machine Models from Software Executions](https://dl.acm.org/doi/abs/10.1007/s10664-015-9367-7) — EFSM inference methodology
- [Combining Model Learning and Formal Analysis for Protocol Implementation Verification](https://www.sciencedirect.com/science/article/abs/pii/S2214212625001164) — three-step instrumentation + inference + formalization methodology
- [Automated FMEA Based on High-Level Design Specification with Behavior Trees](https://link.springer.com/chapter/10.1007/11589976_9) — automated failure mode analysis from formal specs
- [FMEA: Failure Mode and Effects Analysis (IEC 60812)](https://en.wikipedia.org/wiki/Failure_mode_and_effects_analysis) — standard FMEA methodology (Severity x Occurrence x Detection = RPN)
- [Fault Model-Driven Test Derivation from Finite State Models](https://link.springer.com/chapter/10.1007/3-540-45510-8_10) — test generation from FSM failure models
- [Model-Based Testing of Asynchronously Communicating Distributed Controllers](https://www.sciencedirect.com/science/article/pii/S0167642325000048) — validated mappings to formal representations for test generation
- [Automatic Generation of Formal Specification and Verification Annotations Using LLMs](https://arxiv.org/html/2601.12845v1) — LLM-assisted specification derivation (2025)
- [Formal Methods in Industry (2024)](https://dl.acm.org/doi/full/10.1145/3689374) — survey of formal methods adoption patterns
- [On the Impact of Formal Verification on Software Development (2025)](https://ranjitjhala.github.io/static/oopsla25-formal.pdf) — practical impact assessment

---
*Feature research for: Three-layer formal verification architecture (Evidence / Semantics / Reasoning)*
*Researched: 2026-03-06*
