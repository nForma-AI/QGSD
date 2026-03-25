# Requirements: nForma v0.41 — Unified Autoresearch Execution Pipeline

**Defined:** 2026-03-25
**Core Value:** Planning decisions are multi-model verified by structural enforcement

## Milestone v0.41 Requirements

Requirements for Unified Autoresearch Execution Pipeline. Each maps to roadmap phases.

### Task Classification

- [x] **ROUTE-01**: quick.md Step 2.7 Haiku subagent classifies task as bug_fix | feature | refactor (Plan 51-01)
- [ ] **ROUTE-02**: Bug_fix tasks route through /nf:debug pipeline before execution
- [ ] **ROUTE-03**: Feature/refactor tasks proceed to normal execution path
- [x] **ROUTE-04**: Classification result stored in scope-contract.json for downstream consumers (Plan 51-01)

### Debug Integration

- [ ] **DBUG-01**: /nf:debug absorbs model-driven-fix Phases 1-4 (discovery, reproduction, refinement, constraint extraction)
- [ ] **DBUG-02**: Loop 1 (autoresearch-refine.cjs) runs natively within debug flow for bug reproduction
- [ ] **DBUG-03**: Extracted constraints from Loop 1 feed back into debug fix guidance and quorum worker prompts
- [ ] **DBUG-04**: Debug skill produces a reproducing formal model as a deliverable (not just a fix)

### Pre-Commit Simulation Gate

- [ ] **GATE-01**: Loop 2 (simulateSolutionLoop with onTweakFix) fires as pre-commit gate in quick.md --full executor
- [ ] **GATE-02**: Loop 2 fires as pre-commit gate in execute-plan.md executor
- [ ] **GATE-03**: Gate skips silently when no formal models are in scope for the changed files
- [ ] **GATE-04**: Gate is fail-open by default (warns but doesn't block commit), fail-closed with --strict flag
- [ ] **GATE-05**: onTweakFix callback lets executor refine approach if convergence gates fail

### Skill Deprecation

- [ ] **DEPR-01**: /nf:model-driven-fix deprecated — invocation prints deprecation notice routing to /nf:debug
- [ ] **DEPR-02**: solve-remediate b_to_f layer updated to dispatch through debug instead of model-driven-fix
- [ ] **DEPR-03**: All consumers of model-driven-fix.md rewired to new integration points

## Future Requirements

### Advanced Classification
- **ROUTE-05**: Classification confidence scoring with fallback to user prompt on low confidence
- **ROUTE-06**: Multi-intent detection (task is both a bug fix AND a feature addition)

### Autoresearch Enhancements
- **LOOP-01**: Cross-session TSV history persistence (learn from prior solve sessions)
- **LOOP-02**: Composite quality score for refinement sessions (penalizes vacuous models)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Changes to autoresearch-refine.cjs or solution-simulation-loop.cjs internals | Already shipped in quick-348 and quick-350 |
| New formal model creation | Existing close-formal-gaps handles this |
| Interactive user prompts during loops | Autoresearch loops are autonomous by design |
| Changes to convergence-gate-runner.cjs | Internal to Loop 2, not part of pipeline wiring |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DBUG-01 | Phase 50 | Pending |
| DBUG-02 | Phase 50 | Pending |
| DBUG-03 | Phase 50 | Pending |
| DBUG-04 | Phase 50 | Pending |
| ROUTE-01 | Phase 51 | Complete (51-01) |
| ROUTE-02 | Phase 51 | Pending |
| ROUTE-03 | Phase 51 | Pending |
| ROUTE-04 | Phase 51 | Complete (51-01) |
| GATE-01 | Phase 52 | Pending |
| GATE-02 | Phase 52 | Pending |
| GATE-03 | Phase 52 | Pending |
| GATE-04 | Phase 52 | Pending |
| GATE-05 | Phase 52 | Pending |
| DEPR-01 | Phase 53 | Pending |
| DEPR-02 | Phase 53 | Pending |
| DEPR-03 | Phase 53 | Pending |

**Coverage:**
- v0.41 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation*
