# Project Research Summary

**Project:** nForma v0.29 -- Three-Layer Formal Verification Architecture
**Domain:** Formal verification pipeline extension for CLI-based agent orchestration tool
**Researched:** 2026-03-06
**Confidence:** MEDIUM (novel architecture layered on top of mature existing pipeline; individual components HIGH, integration patterns MEDIUM)

## Executive Summary

nForma v0.29 adds a three-layer formal verification architecture (Evidence, Semantics, Reasoning) with three inter-layer gates (Grounding, Abstraction, Validation) on top of an already mature FV pipeline containing 22+ TLA+ models, 60+ Alloy models, PRISM probabilistic checking, and XState conformance tracing. The key insight from research is that this is NOT a greenfield build -- it is a categorization and enrichment layer that organizes existing artifacts into a grounded evidence chain and fills the gaps between them. The stack requires zero new npm dependencies; everything builds on Node.js built-ins, existing XState/Ajv dependencies, and extended JSON schemas.

The recommended approach is strictly bottom-up: build Layer 1 (Evidence) first to establish what is actually observed, then Layer 2 (Semantics) with Gate A to ground the operational model in real traces, then Layer 3 (Reasoning) with Gates B and C to connect hazard analysis back to evidence and code. This ordering is non-negotiable -- research from both architecture and pitfalls analysis converges on the same conclusion: building L3 before L1 produces ungrounded speculation. The existing 567 uncovered assumptions in assumption-gaps.md and 6,369 trace divergences in 35,627 traces are the concrete integration backlog that the three-layer architecture must address.

The dominant risks are: (1) trace explosion overwhelming Layer 1 before Layer 2 can consume it (already at 35K traces with 17.9% divergence), (2) Layer 2 becoming a duplicate XState machine instead of an invariant catalog, and (3) Gate A passing vacuously because "explains" is never formally defined. All three are preventable with upfront design decisions in Phases 1-2, but all three become expensive to recover from if missed. The SCRAM fault tree analyzer (Layer 3, optional) has LOW confidence for macOS ARM builds and should be treated as optional with a fallback JS implementation.

## Key Findings

### Recommended Stack

The stack extends nForma's existing pipeline with zero new npm dependencies. Layer 1 extends the existing JSONL trace format (trace.schema.json v3.0) with failure taxonomy fields. Layer 2 uses XState graph utilities (already installed) for path enumeration and a custom ~300-line L*-style FSM inference script. Layer 3 adds a custom FMEA engine (~200 lines) for Risk Priority Number scoring. Cross-layer alignment uses pure-JS implementations of Population Stability Index and Kolmogorov-Smirnov tests for drift detection.

**Core technologies:**
- Extended JSONL trace format (v3.0): structured evidence collection -- zero-dependency extension of existing conformance-events.jsonl
- Custom FSM inference (bin/infer-operational-fsm.cjs): L*-style state machine derivation from traces -- deterministic, XState-compatible output
- Custom FMEA engine (bin/fmea-analyze.cjs): Severity x Occurrence x Detection = RPN scoring -- no viable npm FMEA library exists
- PSI + KS drift detection (pure JS math): cross-layer alignment monitoring -- 60 lines total, no external libraries
- SCRAM 0.16.2 (optional): Open-PSA fault tree analysis -- LOW confidence on macOS ARM build; fallback to ~150-line JS solver

**Critical version requirement:** Node.js >= 18.19.0 (engines field bump from current >=16.7.0).

### Expected Features

**Must have (table stakes):**
- Instrumentation Map (L1) -- catalog all hook/handler emission points and map to state variables
- Trace Corpus with Structured Metadata (L1) -- indexed, queryable conformance events
- Failure Taxonomy (L1) -- classified failure modes as FMEA input
- Operational State Machine (L2) -- derived from observed traces, comparable to hand-written specs
- Invariant Catalog (L2) -- declared + mined invariants in unified catalog
- Grounding Gate (Gate A) -- quantitative alignment: L2 must explain L1 traces
- Abstraction Gate (Gate B) -- every L3 artifact traces to L2 source
- Validation Gate (Gate C) -- every L3 output maps to concrete test scenario
- Mismatch Register (L2) -- tracked divergences, not silent ignoring
- Hazard Model (L3) -- FMEA applied to operational model states/transitions

**Should have (differentiators):**
- Risk Heatmap with Ranked Transitions -- actionable risk visualization
- Model-Driven Test Generation -- automated test recipes from failure modes
- Cross-Layer Alignment Dashboard -- single-view gate health report
- Design Impact Analysis -- git diff to three-layer impact report

**Defer (v2+):**
- Real-time Streaming Dashboard -- CLI tool, batch reporting is natural fit
- Full Automated State Machine Inference -- supplement hand-written specs, do not replace
- Probabilistic Risk Quantification -- qualitative ranking with quantitative backing, not false precision
- Universal Code Instrumentation -- targeted instrumentation only

### Architecture Approach

The architecture introduces three layer-specific directories (evidence/, semantics/, reasoning/) and a gates/ directory under .planning/formal/, plus a layer-manifest.json as the central registry. Existing files stay in place -- no migration. New scripts (14 total) read from and write to these directories. Gates integrate into the existing nf-solve.cjs convergence loop as three new layer transitions (L1->L2, L2->L3, L3->TC) and into run-formal-verify.cjs as three new step groups. Per-model progressive maturity (Level 0-3) prevents the "boil the ocean" anti-pattern.

**Major components:**
1. Layer Manifest (layer-manifest.json) -- single registry mapping every artifact to its layer, gate relationships, and grounding status
2. Gate Check Scripts (gate-a/b/c) -- three separate scripts producing alignment scores and gap reports, wired into nf-solve and run-formal-verify
3. L1 Evidence Scripts (4 new) -- instrumentation-map, trace-corpus-stats, failure-taxonomy, state-candidates
4. L2 Semantics Scripts (2 new) -- invariant-catalog aggregation, mismatch-register comparison
5. L3 Reasoning Scripts (3 new) -- hazard-model derivation, failure-mode-catalog (FMEA), risk-heatmap ranking

### Critical Pitfalls

1. **Trace explosion drowns L1** -- Define strict instrumentation map BEFORE collecting; implement incremental replay with checkpoints; set divergence budget (5% threshold). Already at 35K traces with 17.9% divergence rate.
2. **Layer 2 becomes a second XState machine** -- L2 is an invariant catalog + mismatch register + assumption register, NOT a state machine. Lock this boundary in Phase 2 design.
3. **Gate A passes vacuously** -- Define quantitative grounding_score = traces_explained / total_traces BEFORE building the gate. Target 80%, not 100%. Classify unexplained traces into instrumentation bug / model gap / genuine violation.
4. **Layer 3 loses traceability to code** -- Gate B enforces bidirectional traceability; every L3 artifact must have derived_from links. Extend annotation syntax: @requirement + @layer + @grounded_by.
5. **Existing 22+ TLA+ models become orphaned** -- Classify all existing models into layers in Phase 1. The 567 uncovered assumptions in assumption-gaps.md IS the integration backlog.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Layer Manifest and Evidence Foundation
**Rationale:** Everything depends on knowing which artifact belongs to which layer. L1 is the foundation -- you cannot build gates or higher layers without evidence data. All four research files converge on "build bottom-up."
**Delivers:** layer-manifest.json, instrumentation-map.cjs, trace-corpus-stats.cjs, failure-taxonomy.cjs, state-candidates.cjs, extended model-registry.json and check-result.schema.json schemas.
**Addresses:** Instrumentation Map, Trace Corpus, Failure Taxonomy, State Candidate Extraction (all P1 features from FEATURES.md).
**Avoids:** Pitfall 1 (trace explosion) by defining instrumentation map upfront; Pitfall 5 (orphaned models) by classifying existing models; Pitfall 6 (schema drift) by defining layer boundary schemas.

### Phase 2: Semantics Layer and Gate A (Grounding)
**Rationale:** L2 is the bridge between evidence and reasoning. Gate A is the most important gate -- it answers "does our model match reality?" The existing validate-traces.cjs deviation score provides the core metric.
**Delivers:** invariant-catalog.cjs, mismatch-register.cjs, gate-a-dashboard.cjs, L1->L2 sweep in nf-solve.cjs, gate-a step in run-formal-verify.cjs.
**Addresses:** Operational State Machine, Invariant Catalog, Mismatch Register, Grounding Gate (all P1 features).
**Avoids:** Pitfall 2 (L2 = XState clone) by locking the invariant-catalog design; Pitfall 3 (vacuous Gate A) by defining grounding_score metric before implementation.

### Phase 3: Reasoning Enrichment and Gate B (Abstraction)
**Rationale:** L3 mostly already exists (TLA+/Alloy/PRISM). This phase adds structured hazard/failure analysis and Gate B traceability enforcement. Depends on Phase 2 invariant catalog.
**Delivers:** hazard-model.cjs, failure-mode-catalog.cjs (FMEA engine), risk-heatmap.cjs, gate-b-check.cjs, L2->L3 sweep in nf-solve.cjs.
**Addresses:** Hazard Model, Risk Heatmap, Abstraction Gate, Assumption Register (P2 features).
**Avoids:** Pitfall 4 (traceability lost) by enforcing derived_from links through Gate B.

### Phase 4: Gate C (Validation) and Test Generation
**Rationale:** Gate C closes the loop -- reasoning outputs become actionable test scenarios. Highest user-visible value but requires all prior layers.
**Delivers:** test-gen-rules.cjs, gate-c-check.cjs, L3->TC sweep in nf-solve.cjs, gate alignment context in plan-phase workflow.
**Addresses:** Validation Gate, Model-Driven Test Generation (P2-P3 features).
**Avoids:** Pitfall 7 (gates block pipeline) by implementing graduated maturity levels (ADVISORY -> SOFT_GATE -> HARD_GATE).

### Phase 5: TUI Integration and Progressive Maturity Rollout
**Rationale:** Dashboard and maturity tracking need all gates operational to show useful data. This is the polish phase.
**Delivers:** Layer view and gate dashboard in TUI, per-model maturity tracking (Level 0-3), multi-model rollout.
**Addresses:** Cross-Layer Alignment Dashboard, Progressive Maturity Tracking, Design Impact Analysis (P3 features).

### Phase Ordering Rationale

- Strict bottom-up ordering (L1 -> L2+GateA -> L3+GateB -> GateC -> TUI) is mandated by both the feature dependency graph and the pitfall analysis. Building any layer before its foundation is the single most expensive mistake.
- Gate A comes with L2 (not after) because the grounding metric definition must be locked before L2 implementation to avoid Pitfall 3 (vacuous gate).
- Gate B comes with L3 (not after) because traceability enforcement must be built into L3 from the start to avoid Pitfall 4 (lost traceability).
- TUI is last because it consumes all gates -- building it incrementally alongside the gates creates churn.
- SCRAM (fault tree analysis) is optional in Phase 3 with a JS fallback, avoiding a dependency on an uncertain macOS ARM build.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Gate A metric definition is the hardest design decision. "Explains" must be formally specified. The v0.21 trace divergence regression (69% -> 0% -> back to 17.9%) shows this has been attempted and regressed before.
- **Phase 3:** FMEA methodology adapted to software state machines is a novel synthesis. The RPN scoring formula is standard, but mapping Severity/Occurrence/Detection to formal model concepts needs careful design.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Evidence collection and instrumentation mapping are well-documented patterns. Existing codebase provides all the integration points.
- **Phase 4:** Test generation from counterexamples follows established model-based testing patterns. Existing generated-stubs/ provides the output format.
- **Phase 5:** TUI integration extends existing formal-core.cjs loaders -- standard CRUD pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Zero new dependencies is HIGH confidence; SCRAM macOS ARM build is LOW; custom FSM inference complexity estimate (~300 LOC) is MEDIUM |
| Features | MEDIUM | Table stakes well-defined; feature dependency graph is solid; but novel synthesis (no canonical "three-layer FV" framework exists) |
| Architecture | HIGH | Based on deep analysis of existing codebase; all integration points verified against actual file paths and script signatures |
| Pitfalls | HIGH | Grounded in nForma's own operational data (35K traces, 17.9% divergence, 567 uncovered assumptions, 63.8% traceability) |

**Overall confidence:** MEDIUM -- the individual components are well-understood, but the integration of three layers with three gates on top of an existing 34-step pipeline is novel and has no external precedent to validate against.

### Gaps to Address

- **Gate A metric definition:** No existing framework precisely defines "L2 explains L1 trace." Must be designed from first principles in Phase 2. The validate-traces.cjs deviation score is a starting point but needs formalization.
- **SCRAM build viability:** Last release 2018, no Homebrew formula, untested on macOS ARM. Must verify in Phase 3 or commit to JS fallback early.
- **Incremental trace replay performance:** At 35K traces growing toward 50K, full corpus replay will become a bottleneck. Checkpoint-based incremental replay must be designed in Phase 1, not retrofitted.
- **Existing model grounding plans:** 567 uncovered assumptions need individual triage. The scope of this backlog could affect Phase 2-3 timelines significantly.
- **Layer 2 boundary definition:** The sharp distinction between XState (control flow) and Layer 2 (behavioral semantics/invariants) is clear conceptually but has no existing implementation to reference. Phase 2 design must lock this before coding.

## Sources

### Primary (HIGH confidence)
- Existing codebase: bin/run-formal-verify.cjs, bin/nf-solve.cjs, bin/validate-traces.cjs, bin/xstate-trace-walker.cjs, bin/analyze-assumptions.cjs -- direct inspection
- Existing data: model-registry.json (92 models), traceability-matrix.json (63.8%), check-result.schema.json (v2.1), trace.schema.json -- direct inspection
- Operational data: conformance-events.jsonl (35,627 traces, 6,369 divergences), assumption-gaps.md (567/567 uncovered)
- XState graph docs (stately.ai) -- path enumeration and test generation
- CMU SEI RPN methodology -- risk priority number for software defects
- IEC 60812 FMEA standard -- Severity x Occurrence x Detection methodology

### Secondary (MEDIUM confidence)
- OpenTelemetry JS SDK 2.0 announcement -- version numbers, Node.js requirements (evaluated and rejected)
- Henzinger et al., RV 2025 -- alignment monitoring framework
- FSM Inference from Long Traces (Avellaneda and Petrenko) -- L* learning approach
- Validating Traces Against TLA+ Specs (Pressler, Oracle) -- trace validation framework
- Conformance Checking: Foundations, Milestones and Challenges -- alignment complexity analysis
- Inferring Computational State Machine Models from Program Executions (IEEE)
- Combining Model Learning and Formal Analysis for Protocol Implementation Verification

### Tertiary (LOW confidence)
- SCRAM 0.16.2 (GitHub, last release 2018) -- fault tree analysis tool, macOS ARM build unverified
- PSI/KS drift detection methods -- statistical approaches, implementation straightforward but calibration thresholds need empirical tuning

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
