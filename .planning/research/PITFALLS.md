# Pitfalls Research

**Domain:** Three-Layer Formal Verification Architecture (Evidence/Semantics/Reasoning) for CLI tool with existing FV pipeline
**Researched:** 2026-03-06
**Confidence:** HIGH (grounded in nForma's own operational data + formal methods literature)

## Critical Pitfalls

### Pitfall 1: Trace Explosion Drowns Layer 1 Before Layer 2 Can Consume It

**What goes wrong:**
Layer 1 (Evidence) collects traces from all instrumentation points. Without aggressive filtering and normalization, the trace corpus grows faster than Layer 2 (Semantics) can process. nForma already has 35,627 conformance traces with 6,369 divergences (17.9% divergence rate). Adding new instrumentation points for the evidence layer will multiply this volume. The system spends all its time replaying traces against models instead of surfacing actionable insights.

**Why it happens:**
The instinct when building an evidence layer is "collect everything, filter later." This works for logging but not for formal verification, where each trace must be replayed against a model. The trace-to-model replay is O(|trace| * |model state space|). nForma's xstate-trace-walker already takes 215ms for conformance checks -- with richer operational models, this becomes seconds per check, and the pipeline blocks on batch replay.

**How to avoid:**
- Define a strict instrumentation map BEFORE collecting traces. The map specifies exactly which code points emit events and what state transitions they should correspond to.
- Layer 1 must normalize traces into a canonical event vocabulary that Layer 2 expects. Do NOT pass raw heterogeneous events upward.
- Implement incremental replay: only check new traces since last checkpoint, not the full corpus every time.
- Set a divergence budget: if divergence rate exceeds a threshold (e.g., 5%), halt trace collection and fix the model or instrumentation before proceeding.

**Warning signs:**
- Conformance check runtime growing super-linearly across runs
- Divergence count increasing faster than trace count
- Layer 2 model changes triggering full corpus re-replay
- Assumption-gap report staying at 0% coverage (as it currently is: 567/567 uncovered)

**Phase to address:**
Phase 1 (Evidence layer foundation). The instrumentation map and canonical event vocabulary must be defined before any trace collection begins.

---

### Pitfall 2: Layer 2 Becomes a Second XState Machine Instead of an Operational Abstraction

**What goes wrong:**
nForma already has an XState machine modeling workflow states. The natural temptation is to make the Layer 2 operational model "XState but bigger" -- adding more states, more transitions, more guards. This creates a duplicate model that drifts from the real XState machine. You end up maintaining two state machines that disagree, and the conformance check between them becomes the main source of divergence rather than a check of code-vs-model alignment.

**Why it happens:**
XState is familiar. The team already thinks in XState terms. When asked "what is the operational semantics of this code?" the answer defaults to "more XState." But Layer 2's purpose is fundamentally different: it must capture behavioral invariants and state relationships that XState's transition graph cannot express (e.g., "this counter is monotonically increasing," "these two fields are never both non-null," "this sequence of operations is atomic"). XState models control flow; Layer 2 models behavioral semantics.

**How to avoid:**
- Layer 2 is NOT a state machine. It is an invariant catalog + mismatch register + assumption register. State machines are a representation choice for Layer 3 TLA+ models.
- Define Layer 2's deliverables explicitly: (1) invariant catalog derived from traces, (2) mismatch register where code violates expected invariants, (3) assumption register documenting what the formal models assume but evidence doesn't confirm.
- Layer 2 reads FROM XState (to know what transitions are expected) but does not duplicate XState's job.
- The existing XState-to-TLA+ spec generation pipeline (spec auto-regen when XState changes) stays in place. Layer 2 enriches what that pipeline produces, not replaces it.

**Warning signs:**
- Layer 2 artifacts contain `states: {}` or `transitions: []` structures mirroring XState
- Conformance checks running XState replay AND Layer 2 replay on the same traces
- Layer 2 model changes requiring XState changes (or vice versa) -- they should be independent
- Team asking "should this guard go in XState or Layer 2?"

**Phase to address:**
Phase 2 (Semantics layer design). The sharp boundary between XState (control flow) and Layer 2 (behavioral semantics) must be a design decision locked before implementation.

---

### Pitfall 3: Gate A (Grounding) Passes Vacuously Because "Explains" Is Under-Specified

**What goes wrong:**
Gate A requires "Layer 2 must explain real traces." But what does "explain" mean? If the criterion is "the model doesn't reject the trace," any sufficiently permissive model passes. If the criterion is "the model predicts the trace," any sufficiently specific model fails on novel but correct behavior. nForma learned this the hard way: v0.21 reduced trace divergence from 69% to 0%, then the current diff-report shows 6,369 divergences in 35,627 traces. The "fix" was too brittle -- it passed at one point in time but broke as the system evolved.

**Why it happens:**
"Grounding" is the hardest gate in any layered verification architecture. The alignment metric is inherently a tradeoff between precision (rejecting invalid traces) and recall (accepting valid traces). Without a formal definition of the alignment score, Gate A becomes a checkbox that passes or fails based on vibes.

**How to avoid:**
- Define a quantitative alignment metric before building Gate A. Proposed: `grounding_score = (traces_explained / total_traces)` where "explained" means the trace can be replayed through the Layer 2 model without encountering an undefined transition, AND the invariant catalog is not violated.
- Maintain an explicit "unexplained behavior queue" -- traces that fail replay go here for triage, not into a generic divergence count.
- Set graduated thresholds: initial target 80% explained, with the 20% in the queue driving model refinement. Do NOT target 100% -- that forces over-fitting.
- Every unexplained trace must be classified: (a) instrumentation bug, (b) model gap, (c) genuine violation. Only (b) triggers model updates.

**Warning signs:**
- Gate A passing at 100% (over-fit or vacuous model)
- Gate A score swinging wildly between runs (instrumentation instability, not model issues)
- Unexplained behavior queue growing monotonically (Layer 2 not being refined in response)
- No classification of WHY traces are unexplained

**Phase to address:**
Phase 2 (Semantics layer) for the metric definition; Phase 3 (Gate implementation) for the enforcement mechanism. The metric MUST be defined before the gate is built.

---

### Pitfall 4: Layer 3 Reasoning Models Lose Traceability Back to Code

**What goes wrong:**
Layer 3 produces hazard models, failure mode catalogs, risk rankings, and test generation rules. These are analytically powerful but abstract. When a hazard is identified ("quorum can deadlock if all providers fail simultaneously"), the path back to which code path, which test, which line is unclear. The hazard becomes a "known risk" that nobody can act on. nForma's existing traceability infrastructure (v0.25: 63.8% coverage, `@requirement` annotations on 43 formal model files) was hard-won and fragile. Adding another layer of abstraction without extending the traceability chain will break it.

**Why it happens:**
Abstraction is seductive. Each layer of abstraction removes detail, which is the point -- but without an explicit "abstraction map" documenting what was removed, the path back is lost. The existing model-registry.json tracks models-to-requirements but not models-to-code-locations. Layer 3 will add models-that-reference-models, creating a chain where the code endpoint is two hops away.

**How to avoid:**
- Gate B (Abstraction) must enforce bidirectional traceability: every Layer 3 artifact must point to its Layer 2 source, and every Layer 2 artifact must point to its Layer 1 evidence.
- Extend model-registry.json to carry `source_layer` and `derived_from` fields. A Layer 3 hazard model entry must reference the Layer 2 invariants it abstracts from.
- Gate C (Validation) is the critical check: every Layer 3 output must produce at least one concrete test scenario. If a hazard cannot be turned into a test, it is not grounded -- move it to an "ungrounded hazards" queue.
- Leverage the existing annotation infrastructure: `@requirement` tags should extend to `@layer2_source` and `@layer1_evidence` tags.

**Warning signs:**
- Layer 3 artifacts with no `derived_from` links
- Test generation producing scenarios that cannot be mapped to specific code paths
- Risk rankings that cannot be verified by running any existing test
- Traceability matrix coverage dropping below current 63.8% baseline after Layer 3 introduction

**Phase to address:**
Phase 3 (Reasoning layer). But the traceability schema extension should happen in Phase 1 so the chain is established from the start.

---

### Pitfall 5: Existing 22 TLA+ Models Become Orphaned by the New Architecture

**What goes wrong:**
nForma has 22+ TLA+ models, 43 formal model files with annotations, Alloy models, PRISM models. The three-layer architecture introduces a new way of deriving formal models (bottom-up from evidence) that conflicts with the existing top-down approach (requirements -> TLA+ specs). If the integration is not planned, the existing models become "legacy" -- still running in CI, still checked, but disconnected from the new layers. You maintain two parallel verification worlds.

**Why it happens:**
The three-layer architecture is philosophically bottom-up (evidence drives semantics drives reasoning). The existing pipeline is philosophically top-down (requirements drive specs drive checks). These are complementary, not competing, but the integration point is non-obvious. Teams typically build the new system alongside the old one, promise to "integrate later," and never do.

**How to avoid:**
- Define the integration point explicitly: existing TLA+ models become Layer 3 artifacts. They are reasoning models. The new pipeline provides grounding for them through Layers 1 and 2.
- For each existing TLA+ model, create a "grounding plan" specifying which Layer 2 invariants justify its assumptions and which Layer 1 evidence supports those invariants.
- The existing assumption-gaps.md (567 uncovered assumptions) IS the integration backlog. Each uncovered assumption is a missing Layer 1/2 link.
- Do NOT create new TLA+ models through the old pipeline once Layer 2 is operational. New models must flow through the layers.

**Warning signs:**
- New TLA+ models being created without Layer 2 justification
- assumption-gaps.md count not decreasing as Layers 1/2 mature
- Two separate "formal verification passed" signals (old pipeline + new pipeline) that can disagree
- Existing models never getting `source_layer` annotations

**Phase to address:**
Phase 1 (Evidence layer) should include an audit of existing models to classify them into the layer architecture. Phase 4 (Integration) should migrate the existing pipeline's outputs into Layer 3.

---

### Pitfall 6: Conformance Trace Schema Drift Between Layers

**What goes wrong:**
Each layer introduces its own event schema. Layer 1 has raw instrumentation events. Layer 2 has normalized semantic events. Layer 3 has abstract model events. When the Layer 1 schema changes (new field, renamed field, different semantics for an existing field), the downstream layers break silently. nForma already has `check-trace-schema-drift.cjs` for the current pipeline, but the three-layer architecture multiplies the number of schema boundaries.

**Why it happens:**
Schema evolution in a pipeline is a classic distributed systems problem. Each layer is developed somewhat independently, and the "contract" between layers is initially informal ("Layer 2 reads the `action` field from Layer 1 events"). As the system evolves, these informal contracts diverge.

**How to avoid:**
- Define explicit schema contracts at each layer boundary with JSON Schema validation.
- Layer boundaries are versioned APIs: Layer 1 emits events conforming to `evidence-event.schema.json` v1; Layer 2 consumes v1 and emits `semantic-event.schema.json` v1.
- Schema drift detection runs at every boundary, not just at the trace-to-model boundary.
- Extend the existing `check-trace-schema-drift.cjs` to cover all three layer boundaries.
- Schema changes require explicit version bumps. Breaking changes require migration scripts.

**Warning signs:**
- Layer 2 silently ignoring fields from Layer 1 events
- `additionalProperties: true` in any inter-layer schema (currently present in trace.schema.json -- this MUST be tightened)
- Conformance checks passing despite schema changes (because the check only validates known fields)
- Different layers using different timestamp formats or event type vocabularies

**Phase to address:**
Phase 1 (Evidence layer). Schema contracts for all three layers should be defined upfront, even if Layers 2 and 3 schemas are initially stubs.

---

### Pitfall 7: Gate Implementation Blocks the Pipeline on Every Run

**What goes wrong:**
Gates A, B, and C are alignment checks. If implemented as hard blockers (like the existing FV gates in v0.23), every pipeline run must pass all three gates. During development of new layers, gates will fail constantly because the layers are incomplete. This creates a choice: disable the gates (defeating the purpose) or spend all time fixing gate failures instead of building features.

**Why it happens:**
nForma's existing FV gates are "hard-block on counterexamples with traceable user override" (v0.23). This is appropriate for mature, stable models. But during the bootstrapping phase of a new layer, models are immature and SHOULD produce failures that drive refinement. Hard-blocking on immature model failures is counterproductive.

**How to avoid:**
- Implement gates with maturity levels: ADVISORY -> SOFT_GATE -> HARD_GATE.
- ADVISORY: gate runs, results logged, never blocks. Used during layer bootstrapping.
- SOFT_GATE: gate runs, failures produce warnings that require acknowledgment but don't block. Used when the layer is stabilizing.
- HARD_GATE: gate runs, failures block. Used for mature layers. This is where existing v0.23 gates operate.
- Each model in model-registry.json gets a `gate_maturity` field. Promotion from ADVISORY to HARD_GATE requires a minimum grounding_score and a minimum number of runs without failure.
- The per-model rollout plan in v0.29's target features aligns with this: progressive maturity across all three layers.

**Warning signs:**
- Gates disabled "temporarily" for more than one phase
- All models at the same maturity level (should be graduated)
- No promotion criteria defined (maturity is manual judgment, not metric-driven)
- Pipeline runtime increasing as gates accumulate (gates should be fast -- under 1s each)

**Phase to address:**
Phase 3 (Gate implementation). But the maturity level schema should be added to model-registry.json in Phase 1.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `additionalProperties: true` in layer schemas | Allows incremental schema development | Silent schema drift between layers; fields consumed but not validated | Phase 1 only, must be tightened to `false` by Phase 2 |
| Replaying full trace corpus on every run | Simple implementation | O(n) growth in CI time as corpus grows; nForma already at 35K traces | Never in production pipeline; use incremental checkpointing from the start |
| Shared mutable state between layer processors | Avoids serialization overhead | Layer coupling; changes in Layer 1 processor break Layer 2 | Never; layers must communicate via serialized schemas |
| Skipping Gate A during Layer 3 development | Faster iteration on reasoning models | Layer 3 models ungrounded; produce hazards with no evidence basis | Phase 3 only; Gate A must be at least SOFT_GATE before Layer 3 goes to HARD_GATE |
| Manual invariant curation instead of trace-derived | Faster to get started | Invariants reflect developer assumptions, not code reality; same gap the architecture is designed to close | Phase 1 seed only; must be replaced by trace-derived invariants in Phase 2 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| XState machine <-> Layer 2 | Making Layer 2 a superset of XState (duplicate control flow modeling) | Layer 2 reads XState transition definitions as inputs; outputs invariant/mismatch/assumption registers that XState cannot express |
| Existing TLA+ models <-> Layer 3 | Treating existing models as "already Layer 3" without grounding | Classify each existing model; create grounding plans; progressively add Layer 1/2 links through assumption-gaps backlog |
| model-registry.json <-> Layer metadata | Adding layer info as ad-hoc fields | Extend schema formally with `source_layer`, `derived_from`, `gate_maturity` fields; validate with JSON Schema |
| conformance-events.jsonl <-> Layer 1 | Treating current conformance events as Layer 1 evidence directly | Current events are quorum-focused; Layer 1 evidence must cover broader code behavior (state candidates, failure taxonomy). Extend, don't reuse as-is |
| PRISM auto-calibration <-> Layer 2 metrics | PRISM reading raw scoreboard data when Layer 2 could provide richer behavioral metrics | Route PRISM calibration through Layer 2's invariant catalog; use behavioral invariant violation rates as PRISM parameters |
| Debt ledger (debt.json) <-> Layer mismatch register | Duplicating the concept of "something is wrong" in two places | Layer 2 mismatch register feeds into debt ledger; mismatches become debt entries when they persist beyond a threshold |
| `@requirement` annotations <-> Layer traceability | Three separate annotation systems (requirements, layers, grounding) | Unified annotation syntax: `@requirement REQ-01 @layer L2 @grounded_by L1:trace:12345` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full corpus replay on model change | CI time grows linearly with trace history | Incremental replay with checkpoint; only replay traces newer than last successful check | At ~50K traces (nForma currently at 35K -- imminent) |
| Layer 2 invariant enumeration over all traces | Quadratic in traces * invariants | Maintain a violation index: only re-check invariants against traces where related state variables changed | At ~100 invariants * 50K traces |
| Gate A/B/C running sequentially | Pipeline blocked for sum of all gate runtimes | Gates A, B, C are independent per-model checks; parallelize across models | At ~30 models (nForma currently at 22 TLA+ models + Alloy + PRISM) |
| Layer 3 test generation producing combinatorial test suites | Test suite too large to run, defeating the purpose | Budget-constrained test generation: rank by risk, select top-N per failure mode | At ~20 failure modes * 10 scenarios each |
| Trace storage as append-only JSONL | Disk usage and parse time grow without bound | Rotation policy: archive traces older than N days; keep summary statistics | At ~100K traces or ~500MB |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Traces containing sensitive runtime data (API keys in event payloads) | Key leakage through trace corpus (nForma already has `check-trace-redaction.cjs` -- must extend to all layers) | Redaction at Layer 1 emission point; never store raw payloads; validate with schema that rejects known-sensitive field patterns |
| Layer 2 invariants exposing internal architecture | Invariant names/descriptions reveal system internals if trace corpus is shared | Invariant IDs are opaque; descriptions are in a separate, non-exported catalog |
| Gate override tokens stored in plain text | Bypass of formal verification gates | Override requires signed acknowledgment (existing traceable user override pattern from v0.23 applies) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Gate failures showing raw divergence counts (e.g., "6369 divergences") | Developer cannot determine action from a number | Categorized failure summary: "3 instrumentation bugs, 12 model gaps, 1 genuine violation" with fix guidance per category |
| Layer maturity invisible to user | Developer does not know if a gate failure is expected (ADVISORY) or blocking (HARD_GATE) | Show maturity badge next to each gate result: `[ADVISORY] Gate A: 78% grounded` vs `[HARD] Gate A: FAIL` |
| Risk heatmap with no actionable next step | Pretty visualization, no action | Each heatmap cell links to the specific test scenario that would validate it, or flags "no test available -- generate?" |
| Unexplained behavior queue with no triage workflow | Queue grows, nobody processes it | Weekly auto-triage: classify top-10 unexplained traces; auto-close traces older than 30 days that match known instrumentation bugs |

## "Looks Done But Isn't" Checklist

- [ ] **Layer 1 (Evidence):** Often missing failure taxonomy -- verify that failure events are classified, not just "success/error" binary
- [ ] **Layer 1 (Evidence):** Often missing state candidate list -- verify that potential state variables are identified from code analysis, not just from existing XState states
- [ ] **Layer 2 (Semantics):** Often missing assumption register -- verify that every TLA+ ASSUME and CONSTANT is tracked with evidence status (confirmed/unconfirmed/contradicted)
- [ ] **Layer 2 (Semantics):** Often missing mismatch register entries -- verify that traces violating invariants produce mismatch entries, not just increment a divergence counter
- [ ] **Gate A (Grounding):** Often missing unexplained behavior queue -- verify that failed replays are triaged, not just counted
- [ ] **Gate B (Abstraction):** Often missing abstraction map -- verify that every Layer 3 hazard has a `derived_from` chain to Layer 2
- [ ] **Gate C (Validation):** Often missing counterexample-to-code translation -- verify that abstract counterexamples produce runnable test code, not just model traces
- [ ] **Integration:** Often missing existing model classification -- verify that all 22+ TLA+ models are assigned to a layer with grounding plans
- [ ] **Schema:** Often missing `additionalProperties: false` at layer boundaries -- verify all inter-layer schemas are strict
- [ ] **Performance:** Often missing incremental replay -- verify trace checking uses checkpoints, not full corpus replay

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Trace explosion (Pitfall 1) | MEDIUM | Implement trace sampling (1-in-N); backfill instrumentation map; add divergence budget circuit breaker |
| Layer 2 duplicates XState (Pitfall 2) | HIGH | Refactor Layer 2 to invariant catalog format; delete state machine structures; update all consumers. This is an architecture mistake that compounds over time |
| Gate A vacuous (Pitfall 3) | LOW | Define quantitative metric; retroactively score existing alignment; set thresholds. Mostly a definition + tooling problem |
| Layer 3 traceability lost (Pitfall 4) | HIGH | Retroactively add `derived_from` links to all Layer 3 artifacts; backfill abstraction map. Gets harder as Layer 3 grows -- do early |
| Existing models orphaned (Pitfall 5) | MEDIUM | Classify models; create grounding plans; progressively link. Can be done incrementally per-model |
| Schema drift (Pitfall 6) | MEDIUM | Lock schemas with `additionalProperties: false`; add migration scripts for existing data; run drift detection in CI |
| Gates block pipeline (Pitfall 7) | LOW | Add maturity levels to model-registry.json; re-classify existing gates. Backward-compatible change |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Trace explosion (1) | Phase 1: Evidence Layer | Trace growth rate < 2x per milestone; divergence rate < 5% |
| Layer 2 = XState clone (2) | Phase 2: Semantics Layer | Layer 2 artifacts contain zero state machine structures; only invariant/mismatch/assumption registers |
| Gate A vacuous (3) | Phase 2-3: Semantics + Gates | Grounding score defined, measured, and between 70-95% (not 100%) |
| Layer 3 traceability lost (4) | Phase 3: Reasoning Layer | Every Layer 3 artifact has `derived_from` links; traceability matrix coverage >= 63.8% baseline |
| Existing models orphaned (5) | Phase 1 (audit) + Phase 4 (migrate) | assumption-gaps.md uncovered count decreasing each phase; all models have `source_layer` |
| Schema drift (6) | Phase 1: Evidence Layer | All inter-layer schemas validated in CI; `additionalProperties: false` everywhere |
| Gates block pipeline (7) | Phase 3: Gate Implementation | Model-registry.json has `gate_maturity` field; promotion criteria documented and automated |

## Sources

- nForma operational data: `.planning/formal/diff-report.md` (6369 divergences in 35627 traces), `.planning/formal/assumption-gaps.md` (567/567 uncovered), `.planning/formal/coverage-gaps.md` (0% state coverage)
- nForma v0.21 trace divergence reduction (69% -> 0% -> regression): PROJECT.md history
- nForma v0.25 traceability infrastructure: 63.8% coverage, 43 annotated model files
- [Validating Traces of Distributed Programs Against TLA+ Specifications](https://link.springer.com/chapter/10.1007/978-3-031-77382-2_8) -- trace validation framework and abstraction gap challenges
- [Verifying Software Traces Against a Formal Specification with TLA+ and TLC](https://pron.github.io/files/Trace.pdf) -- Ron Pressler, Oracle, canonical reference on TLA+ trace checking
- [Model Checking Guided Testing for Distributed Systems](http://muratbuffalo.blogspot.com/2023/08/model-checking-guided-testing-for.html) -- Murat Demirbas on abstraction gap, concurrency mismatches, false abstraction security
- [Conformance Checking: Foundations, Milestones and Challenges](https://link.springer.com/chapter/10.1007/978-3-031-08848-3_5) -- alignment complexity exponential in model/trace size
- [Leveraging LLMs for Formal Software Requirements](https://arxiv.org/html/2507.14330v1) -- semantic ambiguity and lifecycle traceability barriers
- [Formalizing UML State Machines for Automated Verification](https://dl.acm.org/doi/10.1145/3579821) -- operational semantics formalization approaches

---
*Pitfalls research for: Three-Layer Formal Verification Architecture (v0.29)*
*Researched: 2026-03-06*
