# Requirements: QGSD v0.22 Requirements Envelope

**Defined:** 2026-03-01
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.22 Requirements

### Requirements Envelope — ENV

All phase requirements from `new-milestone` are aggregated into a machine-readable canonical document inside `formal/`. A lightweight model validates the set for duplicates and conflicts. The validated set becomes the correctness envelope that formal specs must respect. Modifications require explicit user consent.

- [ ] **ENV-01**: Requirements are aggregated into `formal/requirements.json` — during `new-milestone`, after roadmap creation, all phase requirements are compiled into a single structured JSON document in `formal/` with REQ-ID, text, category, phase assignment, and provenance; this is the canonical requirements envelope
- [ ] **ENV-02**: A Haiku validation pass detects duplicates and conflicts — before the envelope is frozen, a lightweight model (claude-haiku-4-5) reviews the full requirement set for semantic duplicates (different IDs, same intent), contradictions (requirements that cannot both be satisfied), and ambiguity (requirements that admit multiple incompatible interpretations); results are presented to the user for resolution
- [ ] **ENV-03**: The validated envelope constrains formal specs — formal methods (TLA+, Alloy, PRISM) must prove they respect the envelope; `generate-phase-spec.cjs` reads `formal/requirements.json` as its source of truth for PROPERTY generation; any formal spec that contradicts a frozen requirement is flagged as a violation
- [ ] **ENV-04**: The envelope is immutable without user consent — `formal/requirements.json` cannot be modified by any automated workflow; modifications require explicit user approval through an amendment workflow that re-runs ENV-02 validation on the updated set; a hook or pre-commit guard enforces this
- [ ] **ENV-05**: Drift detection flags divergence — when `.planning/REQUIREMENTS.md` is modified after the envelope is frozen, a checker compares the working copy against `formal/requirements.json` and warns if they diverge; legitimate changes must go through the amendment workflow (ENV-04)

## Future Requirements (deferred)

### Future Planning Integration

- **PLAN-FUTURE-01**: Mind map generation — PLAN.md → Mermaid mind map saved to `.planning/phases/<phase>/MINDMAP.md`, injected into quorum slot-worker context
- **PLAN-FUTURE-02**: General-purpose code → spec — expose the QGSD code-to-spec pipeline as a reusable tool for any project using QGSD (hybrid AST + JSDoc annotations)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Continuous Bayesian prior update | Cold-start → steady-state threshold (policy.yaml) is the right model; continuous Bayes adds complexity without proportional benefit |
| UPPAAL expansion beyond quorum races | Timed automata modelling is covered; additional UPPAAL models require tool expertise investment disproportionate to value |
| General-purpose JSDoc annotation spec extraction | Deferred to future milestone |
| Real-time collaborative requirement editing | Undermines formal correctness guarantees; amendments require explicit workflow |
| Automated requirement merging | Auto-merge conflicts with immutability contract; always require user approval |
| Requirement dependency graph | Adds complexity; phase ordering from roadmap is sufficient for v0.22 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | TBD | Pending |
| ENV-02 | TBD | Pending |
| ENV-03 | TBD | Pending |
| ENV-04 | TBD | Pending |
| ENV-05 | TBD | Pending |

**Coverage:**
- v0.22 requirements: 5 total
- Mapped to phases: 0
- Unmapped: 5 ⚠️

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 after v0.22 milestone start*
