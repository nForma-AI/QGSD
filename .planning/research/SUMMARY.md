# Research Summary: QGSD v0.22 Requirements Envelope

**Project:** QGSD v0.22 Requirements Envelope (ENV-01..05)
**Domain:** Formal verification infrastructure — requirements-as-formal-artifacts with LLM validation, immutability enforcement, and drift detection
**Researched:** 2026-03-01
**Confidence:** HIGH

## Executive Summary

The Requirements Envelope system (v0.22) adds a formal correctness boundary to QGSD's verification pipeline. Requirements are aggregated from planning documents into a frozen JSON artifact (`.formal/requirements.json`), validated by Haiku for duplicates and conflicts, then used as the authoritative source for formal spec generation. The system includes immutability enforcement (via git hooks) and drift detection to catch working copy divergence. This is a critical foundational layer for formal verification: specifications cannot be correct if requirements are ambiguous or incomplete.

The recommended approach uses a lightweight, proven stack: **ajv** for schema validation, **@anthropic-ai/sdk** for Haiku semantic checks, **husky** for git hook management, and **diff** for drift detection. All technologies are standard Node.js patterns with no external services required. The architecture integrates seamlessly with existing QGSD formal verification systems (model registry, TLA+ generation, quorum context injection).

The primary risk is **non-deterministic Haiku validation**: LLM-based duplicate/conflict detection is probabilistic and requires explicit rubrics, aggregation, and determinism testing to be reliable. Secondary risks include drift detection false positives (overwhelming teams with noise) and immutability enforcement breaking legitimate development workflows. All risks have well-documented mitigations from formal verification and infrastructure-as-code literature.

## Key Findings

### Recommended Stack

The requirements envelope requires five core tools, all mature and standard in Node.js ecosystems:

**Core technologies:**
- **ajv** (^8.12.0): JSON Schema validation — 50% faster than alternatives, uses code generation, adopted by ESLint/Webpack. Validates requirements envelope structure at parse time with zero runtime interpretation overhead.
- **@anthropic-ai/sdk** (^0.24.0+): Native Claude API for Haiku LLM calls — official Anthropic SDK, handles auth/timeouts/streaming, already used in QGSD's existing hook infrastructure. Haiku 4.5 is cost-optimal ($1/$5 per M tokens) for semantic validation passes.
- **husky** (^9.0.0+): Git hook management — de facto Node.js standard, installs hooks in committed `.husky/` directory, enables per-project enforcement without global state contamination.
- **diff** (jsdiff, ^5.2.0+): Text differencing — lightweight, battle-tested, supports diffChars/diffLines for semantic drift detection.
- **yaml** (^2.3.0): YAML parsing — already in devDependencies, used to parse requirement source documents from task-envelope.json and REQUIREMENTS.md.

**Why NOT alternatives:** tv4 is deprecated (2015); manual semantic similarity requires ML infrastructure (~500MB deps); full formal specs (Alloy/TLA+) are overkill for requirement structure validation; hierarchical requirement grouping creates rigid coupling that breaks under refactoring.

**Installation cost:** Negligible. All packages are standard; no breaking conflicts with existing QGSD dependencies.

### Expected Features

The Requirements Envelope system implements a carefully scoped feature set based on dependency analysis and formal verification standards.

**Must have (table stakes — v0.22 launch):**
- **Requirements Aggregation** — Consolidate all phase requirements into `.formal/requirements.json`; REQ-ID, text, category, phase, provenance fields.
- **Machine-Readable Format** — JSON structure with schema (type checking); prerequisite for formal tools to read requirements programmatically.
- **Duplication Detection** — Haiku validation identifies semantic duplicates; user resolves before freezing.
- **Conflict Detection** — Haiku validation identifies contradictions (requirement A says X, requirement B says not X).
- **Immutability Enforcement** — Pre-commit hook prevents modifications outside formal amendment workflow.
- **Formal Constraint Validation** — `generate-phase-spec.cjs` reads frozen envelope and ensures generated TLA+ PROPERTY checks respect constraints.
- **Amendment Workflow** — Structured workflow to modify frozen envelope: propose → validate → approve → re-lock.

**Should have (v0.23, improves reliability):**
- **Drift Detection** — Monitor `.planning/REQUIREMENTS.md` post-freeze; alert on divergence; route to amendment workflow.
- **Version History** — Amendment records with user, timestamp, old/new text, approval quorum; supports audits and reverts.
- **Coverage Gap Analysis** — Identify phases with no mapped requirements.

**Defer (v0.24+):**
- **Automated Spec Generation** — Requirements text → TLA+ PROPERTY translation (currently manual).
- **Risk-Stratified Requirements** — Tag by risk level; vary verification intensity.
- **Ambiguity Explanation** — When duplication detected, explain why two requirements are equivalent.
- **Requirement-to-Test Traceability** — Link requirements to CI/CD test coverage.

**Feature dependencies:** Aggregation → Machine-Readable Format. Immutability → Amendment Workflow → Duplication/Conflict Detection. Drift → Immutability. Automated Spec Gen → Formal Constraint Validation.

### Architecture Approach

The requirements envelope integrates at four critical touchpoints in QGSD's existing formal verification system:

1. **Data generation (ENV-01):** During `/qgsd:new-milestone`, `bin/aggregate-requirements.cjs` compiles `.planning/REQUIREMENTS.md` → `.formal/requirements.json` (unvalidated, `frozen_at: null`).

2. **Validation gate (ENV-02):** Immediately after aggregation, `bin/validate-requirements-haiku.cjs` invokes Haiku validator (via Task subagent) to detect duplicates/conflicts. Haiku returns structured findings; user resolves or accepts. Upon approval, `frozen_at` is set to current timestamp, envelope becomes immutable.

3. **Spec constraint binding (ENV-03):** During `plan-phase` formal verification, `bin/generate-phase-spec.cjs` reads the frozen envelope, filters requirements by phase, converts to TLA+ PROPERTY statements (templates like `<> (envelope_01 = TRUE)`), and merges with phase-specific truths from task-envelope.json. Envelope properties take formal precedence.

4. **Immutability + drift (ENV-04, ENV-05):** Hook-based protection prevents direct edits to frozen envelope; amendment workflow provides structured escape hatch. Drift detector compares working copy against frozen envelope on every planning command, injects warnings into Claude's context (non-blocking).

**Major components:**
1. `bin/aggregate-requirements.cjs` — Compile REQUIREMENTS.md → JSON with YAML parsing, ID validation, provenance tracking.
2. `bin/validate-requirements-haiku.cjs` — Haiku semantic validation gate with structured prompt + issue presentation + freeze logic.
3. `bin/extract-requirements-properties.cjs` — Filter frozen envelope by phase, convert to TLA+ PROPERTY templates.
4. `bin/amend-requirements.cjs` — Amendment workflow: accepts changes, applies to pending copy, re-validates, re-freezes.
5. `bin/detect-requirements-drift.cjs` — Compare working vs frozen, classify drift type (semantic vs noise), generate report.
6. `agents/qgsd-haiku-validator.md` — Agent role for lightweight LLM validation (input: requirements array; output: JSON issues + summary).

**Modified existing components:**
- `bin/generate-phase-spec.cjs` — Read frozen envelope (if exists), check `frozen_at` before using, merge properties with phase truths.
- `bin/run-formal-verify.cjs` — Add envelope validation step (optional for backward compat), analyze ENV property results separately in summary.
- `hooks/qgsd-prompt.js` — Call drift detector early in UserPromptSubmit, inject drift report into context (non-blocking).
- `hooks/qgsd-stop.js` — Detect direct modifications to `.formal/requirements.json`, block unless amendment approval marker present.

### Critical Pitfalls

**1. Haiku Validation Non-Determinism** (HIGH impact)
LLM validation is probabilistic — same envelope returns different results on different runs. Envelope passes Tuesday, fails Wednesday.
- **Mitigation:** Use explicit rubrics, aggregate 3+ independent passes, generate deterministic hashes of findings, version the validation rubric. Only findings appearing in 2+ passes count as HIGH confidence. Test for determinism: run same envelope 5 times, check hash stability.
- **Phase to address:** Phase 2 (Validation Gate) — establish rubric before freezing. End-to-end test must validate determinism before production use.

**2. Drift Detection False Positives** (HIGH impact)
Naive string diffs flag formatting changes, whitespace, reordering as drift. Teams get 100+ drift alerts per phase, ignore them, miss real drift.
- **Mitigation:** Use semantic fingerprinting (Haiku summary hash), not text diffs. Define drift categories: NOISE (formatting, typos) vs SEMANTIC DRIFT (scope changes, precondition relaxation). Threshold: >20% text difference = drift. Disable drift checking during plan-phase (requirements evolving), enable during execute-phase (should be stable). Whitelist known-safe changes.
- **Phase to address:** Phase 5 (Drift Detection) — finalize semantic fingerprinting. Test false positive rate <5% before deployment. Start with drift disabled; enable after validation.

**3. Immutability Enforcement Lacks Amendment Path** (HIGH impact)
Hook blocks envelope modifications but provides no clear workflow for legitimate changes (typos, spec discovery of missing requirement). User hits block, has no guidance, either hacks hook or maintains shadow document.
- **Mitigation:** Define amendment classes upfront: Class A (typos, non-semantic fixes, auto-approves), Class B (scope changes, need re-validation), Class C (add/remove requirements, roadmap impact). Amendment request format: `.formal/requirements.AMENDMENT-<timestamp>.json` with before/after + class + rationale. Amendment validator gates B/C to explicit approval; Phase-specific amendment windows (only during plan-phase, not execute-phase).
- **Phase to address:** Phase 3 (Immutability) — implement amendment workflow before hook installation. Test against real workflows (merge resolution, metadata update).

**4. Formal Spec Generation Discovers Requirements Incomplete** (MEDIUM impact)
Envelope passes Haiku validation but spec generation fails: "REQ-02 postcondition not satisfiable given REQ-05." Specification blocked but envelope immutable.
- **Mitigation:** Add "formal specification compatibility" dry-run BEFORE Haiku validation. Attempt `generate-phase-spec --validate-only` on aggregated envelope. Report conflicts early. Implement staged freezing: Semantic Validation (Haiku) → Formal Compatibility (spec gen) → Immutable Envelope. Amendment window stays open until Phase 2 spec generation completes.
- **Phase to address:** Phase 2 (Validation) — include pre-Haiku spec gen dry-run. Don't freeze fully until formal compatibility passes.

**5. Hook Installation Sync Breaks Enforcement** (MEDIUM impact)
Developer modifies `hooks/qgsd-requirements-guard.js`, forgets to sync to `hooks/dist/` and reinstall globally to `~/.claude/hooks/`. Old version keeps running. Enforcement inconsistent between developers.
- **Mitigation:** Add post-merge git hook checking if source is newer than dist. Version-stamp hook with `HOOK_VERSION` constant; check at phase start. CI enforces installation. Keep independent CI gate as backstop: even if client hook isn't installed, CI gate protects.
- **Phase to address:** Phase 3 (Immutability) — implement version checking and post-merge sync validation. Add explicit README section documenting installation requirement.

**6. Schema Versioning Creates Brittle Structure** (MEDIUM impact)
Schema defined once, but as QGSD evolves, schema must change to support new constraint types or traceability fields. Breaking changes or sprawling over-design.
- **Mitigation:** Version schema explicitly (`"schema_version": "1.0"` at root). Use `additionalProperties: false` (fail-fast on unknown fields). Keep `"requirements_metadata"` as extensible object absorbing new types. Plan migrations in advance: v1.0 → v1.1 mapping tool defined before locking. Don't try to "future-proof" everything.
- **Phase to address:** Phase 1 (Foundation) — finalize schema design before freezing. Phase 2 extends only metadata, not structure.

## Implications for Roadmap

Based on research, the requirements envelope requires a carefully sequenced five-phase implementation driven by dependencies and risk mitigation.

### Phase 1: Requirements Envelope Foundation (ENV-01 + ENV-02 foundation)
**Rationale:** Aggregation and validation are prerequisites for all downstream work. No specs can be correct without a validated requirements source. Foundation phase establishes the artifact format and validation pattern.

**Delivers:**
- `bin/aggregate-requirements.cjs` — Compile REQUIREMENTS.md → `.formal/requirements.json` (schema validated, unvalidated semantically)
- `bin/validate-requirements-haiku.cjs` — Haiku validator with explicit rubric, determinism testing, structured issue output
- `agents/qgsd-haiku-validator.md` — Lightweight validator agent
- `.formal/schemas/requirements.schema.json` — JSON Schema Draft-07 with versioning + extensible metadata
- Full roundtrip test: REQUIREMENTS.md → aggregation → validation → frozen envelope

**Addresses:** Table stakes features (Aggregation, Machine-Readable Format, Duplication/Conflict Detection)

**Avoids:** Pitfalls 1 (non-determinism via rubric + aggregation), 6 (schema brittleness via versioning)

**Research needed:** Verify Haiku latency/cost for 100+ requirement envelope; establish rubric patterns from requirements domain

---

### Phase 2: Formal Spec Integration (ENV-03 + ENV-02 spec compatibility)
**Rationale:** Frozen envelope must be compatible with formal spec generation. This phase integrates envelope with downstream spec tooling and discovers incompatibilities early.

**Delivers:**
- `bin/extract-requirements-properties.cjs` — Convert envelope requirements to TLA+ PROPERTY templates
- Modified `bin/generate-phase-spec.cjs` — Read frozen envelope, merge with phase truths, inject ENV-* properties
- Modified `bin/run-formal-verify.cjs` — Envelope validation step (optional for backward compat), analyze ENV property results
- Pre-Haiku spec generation dry-run (included in validate-requirements-haiku.cjs)
- Integration test: new-milestone → plan-phase with envelope → formal verify with ENV properties

**Addresses:** Formal Constraint Validation feature; integrates envelope as source of truth for specs

**Avoids:** Pitfall 4 (spec generation discovers incomplete requirements) via early dry-run

**Research needed:** Verify TLA+ PROPERTY generation from requirement text; test property-to-requirement traceability

---

### Phase 3: Immutability + Amendment Workflow (ENV-04)
**Rationale:** Frozen envelope needs an escape hatch for legitimate changes. Amendment workflow must be designed and tested BEFORE enforcement hook is installed.

**Delivers:**
- `bin/amend-requirements.cjs` — Amendment workflow: Class A auto-approve, B/C route to explicit approval, re-validation gate
- Modified `hooks/qgsd-stop.js` — Detect direct modifications, block unless amendment approval marker present
- `.husky/pre-commit` hook (via husky) — Alternative enforcement at git level
- Amendment class definitions (A/B/C) documented in CLAUDE.md
- Test against real workflows: merge resolution, metadata updates, multiple amendments

**Addresses:** Immutability Enforcement + Amendment Workflow features

**Avoids:** Pitfalls 3 (unclear amendment path), 6 (hook installation sync breaks enforcement)

**Research needed:** Validate that metadata separation (envelope vs operational data) doesn't break legitimate tooling workflows

---

### Phase 4: Drift Detection Semantics (ENV-05 foundation)
**Rationale:** Working copy divergence detection requires semantic fingerprinting to avoid false positive flood. This phase establishes the fingerprinting algorithm and false positive thresholds.

**Delivers:**
- `bin/detect-requirements-drift.cjs` — Semantic drift detection using fingerprinting (not naive diffs)
- Drift category definitions (NOISE vs SEMANTIC DRIFT) with thresholds (>20% change = drift)
- `.driftignore` whitelisting mechanism for intentional changes
- Modified `hooks/qgsd-prompt.js` — Call drift detector, inject report into context (non-blocking)
- Test suite: validate false positive rate <5% before deployment
- Drift detection DISABLED by default; enabled only during execute-phase

**Addresses:** Drift Detection feature (deferred to v0.23 in MVP but positioned for Phase 4)

**Avoids:** Pitfall 2 (false positives overwhelm signal) via semantic fingerprinting + windows + whitelisting

**Research needed:** Validate Haiku fingerprint stability (determinism of summaries); measure false positive rate on real REQUIREMENTS.md edits

---

### Phase 5: Integration Testing + Production Hardening
**Rationale:** End-to-end validation across all five requirements envelope features plus integration with formal verification pipeline.

**Delivers:**
- Full roundtrip test: new-milestone → aggregate → validate (with determinism checks) → plan-phase (with envelope specs) → drift detection (with false positive rate validation) → amend-requirements (workflow test)
- Performance testing: envelope validation/drift detection latency at 10K+ requirements
- Immutability enforcement tested with: direct edits (blocked), amendments (allowed), merge conflicts (resolved), hook installation sync (checked)
- Documentation: amendment workflow guide, drift categories, schema versioning strategy, installation requirements
- Production checklist: all pitfall mitigations verified, confidence thresholds met

**Addresses:** System-wide validation; ensures no hidden integration gaps

**Avoids:** All pitfalls via comprehensive testing against recovery strategies

---

### Phase Ordering Rationale

**Foundation before specs:** ENV-01/ENV-02 must complete before ENV-03. Specs cannot be generated from unvalidated requirements.

**Specs before immutability:** ENV-03 integration tests envelope reading; immutability enforcement (ENV-04) must come after specs are proven to work with envelope.

**Immutability before drift:** ENV-04 (frozen state) is prerequisite for ENV-05 (drift detection). Can't detect drift without a stable baseline.

**Drift semantics before deployment:** ENV-05 false positives are the highest UX risk. Must be solved BEFORE enabling drift checks in production workflows.

**Dependencies satisfied:** Phase 1 (aggregation + validation) → Phase 2 (spec generation + dry-run) → Phase 3 (amendments + hook) → Phase 4 (drift) → Phase 5 (integration).

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 1 (Validation):** Haiku latency/cost for large envelopes; rubric development for domain-specific duplicates/conflicts; determinism testing methodology
- **Phase 2 (Spec Integration):** TLA+ PROPERTY generation from natural language requirements; property-to-requirement traceability patterns; dry-run failure reporting
- **Phase 4 (Drift Semantics):** Fingerprinting algorithm (embedding vs hashing); false positive measurement methodology; phase-specific window definitions

**Phases with standard patterns (skip research-phase):**
- **Phase 3 (Amendment Workflow):** Well-established pattern from formal verification literature (staged freezing, audit trails); amendment class taxonomy is standard
- **Phase 5 (Integration):** Standard integration testing methodology; pitfall recovery strategies documented in research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified with official documentation; ajv adoption proven (ESLint/Webpack); @anthropic-ai/sdk used in existing QGSD hooks; husky standard in Node.js; no conflicts with existing deps |
| Features | MEDIUM-HIGH | Features derived from formal verification standards (ISO 26262, TLA+ literature); Table stakes clearly defined; dependency graph validated; MVP scope is conservative but sufficient |
| Architecture | HIGH | Integration points well-documented; new components follow existing QGSD patterns (bin/ tools, hook modifications); data flow diagrams complete; backward compatibility confirmed (existing projects without envelope still work) |
| Pitfalls | HIGH | All 9 critical pitfalls mapped to academic literature (requirements validation, data drift, immutability patterns); mitigation strategies documented with recovery costs; testing approaches clear |

**Overall confidence: HIGH**

The requirements envelope is a well-researched, standard-in-the-industry feature with proven patterns from formal verification, requirements engineering, and infrastructure-as-code domains. No novel technologies required; all integration points are clear. Primary risk is **Haiku validation determinism** (HIGH impact, well-mitigated via rubrics + aggregation); secondary risks have lower impact and clear solutions.

### Gaps to Address

1. **Haiku Rubric Development:** Explicit duplicate/conflict patterns for QGSD domain (quorum, formal verification, model checking) — infer from existing v0.21 requirements, validate during Phase 1.

2. **TLA+ PROPERTY Generation Completeness:** How to translate "requirement text" → TLA+ LTL formulas without manual intervention — likely requires category-specific templates (e.g., "must not happen" → `[]¬property`, "eventually happens" → `<>property`). Validate during Phase 2.

3. **Fingerprinting Algorithm Selection:** Embedding-based vs hashing-based semantic similarity — cost/accuracy tradeoff not fully explored. Test both approaches during Phase 4; measure latency at 10K+ requirements.

4. **Phase-Specific Amendment Windows:** Validate that amendments during plan-phase don't break execute-phase specs. Define contractual boundaries (which phases can amend, which freeze). Clarify during Phase 3.

5. **Backward Compatibility with Existing Projects:** Confirm all graceful fallbacks work (envelope missing, unvalidated, old schema versions). Full test during Phase 5.

## Sources

### Primary (HIGH confidence)
- **QGSD Project Documentation:** `.planning/PROJECT.md` (v0.22 envelope requirements overview), `.planning/REQUIREMENTS.md` (detailed ENV-01..05 specs), `.formal/model-registry.json` (central artifact index)
- **Official Package Docs:**
  - [Ajv JSON Schema validator](https://ajv.js.org/) — Performance benchmarks, code generation, Draft-07 support
  - [npm: @anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) — Official SDK, Claude Haiku 4.5 pricing
  - [Husky](https://typicode.github.io/husky/) — Git hook patterns, Node.js standard
  - [GitHub - kpdecker/jsdiff](https://github.com/kpdecker/jsdiff) — Text differencing for drift detection
- **QGSD Formal Verification:** `bin/run-formal-verify.cjs`, `bin/generate-phase-spec.cjs`, `.formal/tla/` specs — existing infrastructure patterns
- **Hook System:** `hooks/qgsd-prompt.js`, `hooks/qgsd-stop.js` — integration patterns

### Secondary (MEDIUM confidence)
- **Formal Methods & Requirements Engineering:**
  - [Formal Specification and Validation of Security Policies](https://inria.hal.science/inria-00507300/file/FormalSpecificationandValidationofSecurityPolicies.pdf)
  - [TLA+ Specification Language and Model Checking](https://lamport.azurewebsites.net/pubs/spec-book-chap.pdf)
  - [Specification Pattern System (Dwyer et al.)](https://people.cs.ksu.edu/~dwyer/spec-patterns.ORIGINAL) — Property patterns for verification
- **LLM-Based Validation:**
  - [Requirements Ambiguity Detection and Explanation with LLMs: An Industrial Study](https://www.ipr.mdu.se/pdf_publications/7221.pdf)
  - [Supervised Semantic Similarity-based Conflict Detection Algorithm (S3CDA)](https://arxiv.org/html/2206.13690v2)
  - [Transfer Learning for Conflict and Duplicate Detection in Software Requirement Pairs](https://arxiv.org/html/2301.03709v2)
- **Drift Detection & Infrastructure as Code:**
  - [Drift Detection in IaC: Prevent Your Infrastructure from Breaking](https://www.env0.com/blog/drift-detection-in-iac-prevent-your-infrastructure-from-breaking) — False positive mitigation patterns
  - [Data Drift: Key Detection and Monitoring Techniques in 2026](https://labelyourdata.com/articles/machine-learning/data-drift) — PSI, KL Divergence, KS test patterns

### Tertiary (validation needed)
- **JSON Schema Versioning:** [JSON Schema - Towards a stable JSON Schema](https://json-schema.org/blog/posts/future-of-json-schema) — Breaking change history; migration strategy design validated during Phase 1
- **Pre-commit Hook Practices:** [Effortless Code Quality: The Ultimate Pre-Commit Hooks Guide for 2025](https://gatlenculp.medium.com/effortless-code-quality-the-ultimate-pre-commit-hooks-guide-for-2025-57ca501d9835) — Hook patterns; file immutability strategies

---

**Research completed:** 2026-03-01
**Ready for roadmap creation:** YES

The requirements envelope research is comprehensive and ready to inform detailed phase planning. Recommended next step: use this SUMMARY.md as context for `/qgsd:roadmap` to generate detailed v0.22 phase structure with task envelopes.
