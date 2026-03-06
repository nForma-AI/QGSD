# Stack Research: Three-Layer Formal Verification Architecture

**Domain:** Formal verification pipeline extension — Evidence, Semantics, Reasoning layers
**Researched:** 2026-03-06
**Confidence:** MEDIUM (novel architecture; individual components HIGH, integration patterns MEDIUM)

## Foundational Constraint: Existing FV Pipeline

nForma already has a mature formal verification stack. The three-layer architecture **extends** it, not replaces it.

**Already validated (DO NOT add):**
- TLA+ / TLC model checker (bin/run-tlc.cjs, bin/run-formal-verify.cjs)
- Alloy analyzer (60+ .als models in .planning/formal/alloy/)
- PRISM probabilistic model checker (auto-calibration from scoreboard)
- UPPAAL timed automata
- XState v5.28.0 (conformance tracing, state machine definitions)
- Ajv (JSON Schema validation, draft-07)
- Traceability matrix (requirements.json <-> formal models)
- Model registry (model-registry.json, check-result.schema.json v2.1)
- Conformance event logging (.planning/conformance-events.jsonl)
- Trace validation (bin/validate-traces.cjs, trace.schema.json)
- Debt ledger (debt.json, debt.schema.json)

**Runtime:** Node.js >= 18.19.0 (align with OpenTelemetry SDK 2.x requirement; current engines field says >=16.7.0 but should bump for this milestone). Dev environment: Node 25.6.1.

---

## Recommended Stack

### Layer 1: Evidence Collection (Instrumentation + Trace + Failure Taxonomy)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom JSONL trace format (extend existing) | v3.0 (new schema) | Structured trace collection | nForma already emits conformance-events.jsonl with trace.schema.json. Extending this schema is far cheaper than adopting OpenTelemetry's full SDK. The existing validate-traces.cjs pipeline, Ajv validation, and XState replay infrastructure all consume this format. Adding new event types (failure_observed, invariant_violated, hazard_triggered) to the existing schema preserves all downstream tooling. |
| `node:crypto` (sha256) | Built-in | Failure fingerprinting for taxonomy | Already used throughout codebase (fingerprint-issue.cjs, nf-circuit-breaker.js). Fingerprints deduplicate failure modes into a taxonomy keyed by deterministic hashes. |
| `node:perf_hooks` | Built-in | High-resolution timing for trace events | Built-in performance.now() provides sub-millisecond timestamps without external deps. Already compatible with existing runtime_ms field in check-result.schema.json. |

**Why NOT OpenTelemetry:**
OpenTelemetry SDK 2.x (@opentelemetry/sdk-node >=2.0.0, @opentelemetry/api >=1.9.0) is the industry standard for distributed tracing. However, nForma is NOT a distributed system — it is a CLI tool that orchestrates quorum calls. The overhead is unjustified:
- OTel SDK 2.x requires Node.js >=18.19.0 and adds ~15 packages to the dependency tree
- nForma hooks are zero-dependency CJS scripts; OTel cannot run in hooks
- The existing JSONL conformance trace format already captures what matters: actions, timestamps, phases, outcomes, MCP metadata
- OTel's value (distributed correlation, backend exporters, auto-instrumentation) is irrelevant for a CLI planning tool
- Extending trace.schema.json to v3.0 with failure taxonomy fields gets 90% of the value at 0% dependency cost

**Trace Schema v3.0 additions:**
```json
{
  "failure_mode": { "type": "string", "description": "Taxonomy category: timeout|crash|wrong_answer|drift|invariant_violation" },
  "severity": { "type": "integer", "minimum": 1, "maximum": 10 },
  "detection_method": { "type": "string", "enum": ["automated", "manual", "model_check", "runtime_assert"] },
  "evidence_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
  "layer": { "type": "string", "enum": ["evidence", "semantics", "reasoning"] }
}
```

### Layer 2: Operational State Machine Derivation + Invariant Catalogs

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| XState graph utilities (`xstate/graph`) | 5.28.0 (bundled with xstate) | Path enumeration, reachability analysis, test generation | Already a devDependency. `getShortestPaths()` and `getSimplePaths()` enumerate all reachable states from traces. Use these to derive operational state machines from observed behavior and compare against designed machines. |
| Custom FSM inference (bin/infer-operational-fsm.cjs) | New | Derive state machines from trace logs | Build a lightweight Angluin-style L* learner that reads conformance-events.jsonl and produces an XState-compatible machine definition. This is a ~300-line implementation: partition traces into sessions, extract state-event-state triples, merge compatible states, output JSON. No external library needed — academic FSM inference tools (SCRAM, MINT) are C++/Java and don't integrate with the Node.js pipeline. |
| Invariant catalog (JSON schema) | New | Structured invariant storage with evidence links | Extend the existing pattern from acknowledged-false-positives.json and archived-non-invariants.json. Each invariant entry links to: source (TLA+/Alloy/observed), confidence tier (low/medium/high using existing thresholds from validate-traces.cjs), violation count, last verified timestamp. |

**Why custom FSM inference instead of academic tools:**
- SCRAM (v0.16.2, last release 2018) is a C++ fault tree tool, not an FSM inference tool
- MINT/LearnLib are Java-based and would require JVM orchestration
- LLM-based inference (ProtocolGPT) is interesting but nondeterministic — unsuitable for formal verification
- The conformance trace format is simple enough that L*-style inference is a straightforward implementation
- Output must be XState-compatible JSON for integration with existing xstate-to-tla.cjs pipeline

### Layer 3: Hazard Models, Failure Mode Analysis, Risk Ranking, Test Generation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom FMEA engine (bin/fmea-analyze.cjs) | New | Failure Mode and Effects Analysis with RPN scoring | No viable npm FMEA library exists. FMEA is a structured methodology, not a complex algorithm: enumerate failure modes, score Severity x Occurrence x Detection = RPN. Build a ~200-line CJS script that reads the failure taxonomy from Layer 1, computes RPNs, and outputs a ranked JSON report. Integrates with existing check-result.schema.json for formal verification results. |
| SCRAM (Open-PSA) | 0.16.2 | Fault tree analysis, minimal cut sets, importance analysis | Despite its age, SCRAM remains the only open-source CLI fault tree analyzer supporting the Open-PSA standard. Use it as an optional external tool (like TLC/Alloy) for fault tree quantification. Input: Open-PSA MEF XML. Output: minimal cut sets + failure probabilities. Install via source build or Docker. LOW confidence — verify it builds on macOS ARM before committing to this. |
| XState test generation (`xstate/graph`) | 5.28.0 | Automated test path generation from hazard models | `getShortestPaths()` generates test cases covering all reachable states. Combine with hazard-annotated state machines to prioritize tests that exercise high-RPN failure modes. Already available, no new dependency. |
| Alloy (existing) | Already integrated | Hazard model constraints | Express hazard relationships as Alloy predicates. Already have 60+ Alloy models; add hazard-specific models (e.g., `hazard-quorum-timeout.als`) following existing patterns. |

**RPN Calculation:**
```
RPN = Severity (1-10) x Occurrence (1-10) x Detection (1-10)
```
- Severity: derived from failure taxonomy impact classification
- Occurrence: computed from conformance-events.jsonl frequency data
- Detection: based on which layer catches the failure (Layer 1 automated = low detection score = good; Layer 3 only = high detection score = concerning)

### Cross-Layer: Alignment Measurement + Drift Detection

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom alignment monitor (bin/alignment-monitor.cjs) | New | Measure cross-layer consistency | Implements the Henzinger et al. (RV 2025) alignment monitoring pattern: compare predicted next-state (from Layer 2 operational FSM) against actual observed state (from Layer 1 traces). Compute alignment score as ratio of matching predictions. Drift = alignment score dropping below threshold over a sliding window. |
| Population Stability Index (PSI) | Built-in (math) | Distribution drift detection | PSI is a single formula: PSI = SUM((actual% - expected%) * ln(actual%/expected%)). Compute in pure JS. Compare current failure mode distributions against baseline. PSI > 0.2 = significant drift. No library needed — it's 10 lines of arithmetic. |
| Kolmogorov-Smirnov test | Built-in (math) | Statistical drift significance | KS test compares two distributions. Implementation is ~50 lines of sorted-array comparison. Used to detect whether observed state transition probabilities have drifted from PRISM model predictions. |
| Existing traceability matrix | Already integrated | Cross-layer requirement tracing | Extend traceability-matrix.json to track which layer each verification result comes from. Add `layer` field to check-result.schema.json (already proposed above). |

**Alignment Score:**
```
alignment_score = matching_predictions / total_predictions
drift_detected = alignment_score < threshold over window_size observations
```

Threshold calibration: start at 0.85 (15% mismatch tolerance), calibrate from observed data using the same confidence tier system already in validate-traces.cjs (low/medium/high based on observation count and window duration).

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ajv` | Already installed | Schema validation for extended trace format | Validate all Layer 1 trace events, invariant catalog entries, FMEA reports against JSON schemas |
| `xstate` | 5.28.0 (already installed) | State machine definitions, graph analysis, test generation | Layer 2 operational FSM representation, Layer 3 test path generation |
| `node:fs` | Built-in | JSONL append, JSON read/write | All layers — trace logging, report output, catalog storage |
| `node:child_process` | Built-in | SCRAM CLI invocation (optional) | Layer 3 fault tree analysis when SCRAM is available |

---

## Installation

```bash
# No new npm dependencies required for Layers 1-2 and cross-layer alignment.
# All implementations use Node.js built-ins + existing devDependencies.

# Layer 3 optional: SCRAM for fault tree analysis
# macOS (build from source — no Homebrew formula available):
git clone https://github.com/rakhimov/scram.git
cd scram && mkdir build && cd build
cmake .. -DCMAKE_INSTALL_PREFIX=/usr/local
make && make install

# Verify SCRAM installation (optional, gracefully degrade if absent):
scram --version || echo "SCRAM not available, fault tree analysis disabled"
```

**Node.js engine bump required:**
```json
{
  "engines": {
    "node": ">=18.19.0"
  }
}
```
This aligns with the broader Node.js ecosystem (OTel SDK 2.x, current LTS) even though we're not using OTel. Node 16 EOL was September 2023.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Extend JSONL trace format | OpenTelemetry SDK 2.x (@opentelemetry/sdk-node >=2.0.0) | Only if nForma becomes a distributed service with multiple processes needing correlation. Currently a CLI tool — OTel overhead is not justified. |
| Custom FSM inference (~300 LOC) | LearnLib (Java) or MINT | If trace complexity grows beyond what simple L* handles (>1000 unique states, non-deterministic traces). Would require JVM sidecar. |
| Custom FMEA engine (~200 LOC) | Siemens Teamcenter / Sphera FMEA-Pro | Enterprise tools for regulated industries (medical devices, automotive). Massive overkill for a developer tool's internal FV pipeline. |
| PSI + KS test (pure JS math) | scipy.stats (Python) or drift-detection npm packages | If statistical rigor needs to increase. For now, PSI and KS are sufficient and keep the stack pure Node.js. |
| SCRAM (C++ CLI, Open-PSA) | Custom fault tree solver | If SCRAM proves too hard to build/maintain on macOS ARM. A basic AND/OR gate solver with minimal cut set enumeration is ~150 LOC in JS and handles 90% of cases. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| OpenTelemetry SDK for trace collection | 15+ packages, distributed-system overhead for a CLI tool | Extend existing JSONL trace.schema.json |
| Python-based tools (SFTA, PyFTA) for fault tree analysis | Adds Python runtime dependency to a Node.js project | SCRAM (C++ CLI) or custom JS fault tree solver |
| LLM-based FSM inference (ProtocolGPT) | Nondeterministic output, requires API calls, unsuitable for formal verification | Deterministic L*-style inference from traces |
| Heavy drift detection frameworks (Evidently, NannyML) | Python ML ecosystem, designed for ML model monitoring not FV | Custom PSI/KS implementation in pure JS |
| @xstate/inspect for production trace collection | Designed for dev-time debugging, generates high data volume, not for production | Existing conformance-events.jsonl with extended schema |

---

## New Files to Create

| File | Layer | Purpose |
|------|-------|---------|
| `.planning/formal/trace/trace.schema.v3.json` | 1 | Extended trace schema with failure taxonomy fields |
| `.planning/formal/failure-taxonomy.json` | 1 | Canonical failure mode catalog |
| `.planning/formal/invariant-catalog.json` | 2 | Discovered invariants with evidence links |
| `.planning/formal/fmea-report.json` | 3 | FMEA results with RPN scores |
| `.planning/formal/alignment-baseline.json` | Cross | Baseline alignment scores for drift detection |
| `bin/infer-operational-fsm.cjs` | 2 | FSM inference from traces |
| `bin/fmea-analyze.cjs` | 3 | FMEA/RPN computation |
| `bin/alignment-monitor.cjs` | Cross | Cross-layer alignment and drift detection |
| `bin/fault-tree-runner.cjs` | 3 | SCRAM CLI wrapper (optional, graceful degradation) |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| xstate@5.28.0 | Node.js >=18.19.0 | Already installed as devDependency. Graph utilities available via `xstate/graph` import. |
| ajv@8.x | Node.js >=18.19.0 | Verify current installed version; draft-07 schemas (existing) compatible. |
| SCRAM 0.16.2 | C++17 compiler | Last release 2018. Builds with CMake. Test on macOS ARM (M-series) before relying on it. LOW confidence on build success. |
| check-result.schema.json v2.1 | New `layer` field | Backward compatible — `layer` field is optional, existing results remain valid. |
| trace.schema.json v3.0 | Existing conformance-events.jsonl | Backward compatible — new fields use `additionalProperties: true` (already set in current schema). |

---

## Integration Points with Existing Pipeline

```
Layer 1 (Evidence)
  conformance-events.jsonl ──→ validate-traces.cjs (existing, extend)
  failure-taxonomy.json ──→ debt.json (existing, cross-reference)

Layer 2 (Semantics)
  infer-operational-fsm.cjs ──→ xstate-to-tla.cjs (existing, feed inferred FSM)
  invariant-catalog.json ──→ requirements.json (existing, link invariants to reqs)

Layer 3 (Reasoning)
  fmea-analyze.cjs ──→ check-result.schema.json (existing, emit as check results)
  fault-tree-runner.cjs ──→ run-formal-verify.cjs (existing, add as formalism type)

Cross-Layer
  alignment-monitor.cjs ──→ traceability-matrix.json (existing, add alignment scores)
  drift detection ──→ debt.json (existing, create debt entries for drift)
```

## Sources

- [OpenTelemetry JS SDK 2.0 announcement](https://opentelemetry.io/blog/2025/otel-js-sdk-2-0/) — version numbers, Node.js requirements (MEDIUM confidence)
- [OpenTelemetry Node.js docs](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/) — capabilities assessment (HIGH confidence)
- [SCRAM GitHub](https://github.com/rakhimov/scram) — fault tree analysis tool, Open-PSA format (LOW confidence on macOS ARM build)
- [XState graph docs](https://stately.ai/docs/graph) — path enumeration, test generation (HIGH confidence)
- [Henzinger et al., RV 2025](https://arxiv.org/abs/2508.00021) — alignment monitoring framework (MEDIUM confidence)
- [PSI/KS drift detection methods](https://www.statsig.com/perspectives/model-drift-detection-methods-metrics) — statistical drift approaches (HIGH confidence)
- [CMU SEI — RPN for Software](https://www.sei.cmu.edu/library/risk-priority-number-rpn-a-method-for-software-defect-report-analysis/) — RPN methodology for software defects (HIGH confidence)
- [FSM Inference from Long Traces](https://www.semanticscholar.org/paper/FSM-Inference-from-Long-Traces-Avellaneda-Petrenko/4bce9409aa4a3e5e8093632bcfeaef2c269502c9) — L* learning approach (MEDIUM confidence)
- Existing codebase: trace.schema.json, check-result.schema.json, validate-traces.cjs, model-registry.json — direct inspection (HIGH confidence)

---
*Stack research for: Three-Layer Formal Verification Architecture*
*Researched: 2026-03-06*
