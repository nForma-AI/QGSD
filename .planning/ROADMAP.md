# Roadmap: nForma v0.41 — Unified Autoresearch Execution Pipeline

**Created:** 2026-03-25
**Milestone:** v0.41
**Profile:** cli
**Depth:** standard
**Global phase range:** 50-53

## Overview

4 phases, 16 requirements. This milestone wires autoresearch-style iteration (Loop 1: bug reproduction, Loop 2: solution simulation) into the standard execution pipeline. The dependency chain is: debug absorbs model-driven-fix internals (Phase 50) -> task classification routes bug fixes to the new debug pipeline (Phase 51) -> pre-commit simulation gate adds Loop 2 to executors (Phase 52) -> deprecation cleans up old model-driven-fix after all consumers are rewired (Phase 53).

---

## Phases

- [ ] **Phase 50: Debug Integration** - /nf:debug absorbs model-driven-fix Phases 1-4 and runs Loop 1 natively for bug reproduction
- [ ] **Phase 51: Task Classification** - Haiku subagent classifies tasks and routes bug fixes through the debug pipeline
- [ ] **Phase 52: Pre-Commit Simulation Gate** - Loop 2 fires as a universal pre-commit quality gate in executor workflows
- [ ] **Phase 53: Skill Deprecation** - Deprecate /nf:model-driven-fix and rewire all consumers to new integration points

## Phase Details

### Phase 50: Debug Integration
**Goal**: /nf:debug becomes the single entry point for formal-model-driven bug investigation, absorbing model-driven-fix discovery/reproduction/refinement/constraint-extraction and running autoresearch Loop 1 natively
**Depends on**: Nothing (foundation phase)
**Requirements**: DBUG-01, DBUG-02, DBUG-03, DBUG-04
**Success Criteria** (what must be TRUE):
  1. Running `/nf:debug` on a bug executes the full discovery-reproduction-refinement-constraint cycle that previously required `/nf:model-driven-fix`
  2. Loop 1 (autoresearch-refine.cjs) runs within the debug flow, producing a TSV trace of one-tweak-per-iteration refinement attempts
  3. Constraints extracted by Loop 1 appear in the debug fix guidance and are injected into quorum worker prompts
  4. Debug produces a reproducing formal model artifact (not just a code fix) as a tracked deliverable
**Plans**: 2 plans

Plans:
- [ ] 50-01-PLAN.md — Rewrite debug.md Steps A.5-A.8 to absorb model-driven-fix Phases 1-4 (discovery, reproduction, refinement, constraint extraction)
- [ ] 50-02-PLAN.md — Wire constraint injection into quorum worker prompts and formal model artifact tracking

### Phase 51: Task Classification
**Goal**: quick.md automatically classifies tasks and routes bug fixes through the debug pipeline while sending features/refactors to normal execution
**Depends on**: Phase 50 (debug pipeline must exist before routing can target it)
**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04
**Success Criteria** (what must be TRUE):
  1. Running `/nf:quick` on a bug report triggers a Haiku subagent at Step 2.7 that classifies the task as bug_fix, feature, or refactor
  2. Tasks classified as bug_fix are routed through the `/nf:debug` pipeline before code execution begins
  3. Tasks classified as feature or refactor proceed directly to the normal execution path with no debug detour
  4. The classification result is persisted in scope-contract.json and available to downstream consumers (executor, verifier)
**Plans**: TBD

Plans:
- [ ] 51-01: TBD
- [ ] 51-02: TBD

### Phase 52: Pre-Commit Simulation Gate
**Goal**: Every code change in milestone executor workflows passes through Loop 2 (solution simulation) as a pre-commit quality gate, with graceful skip when no formal models are in scope
**Depends on**: Phase 50 (Loop 2 uses the same formal model infrastructure that debug integration establishes)
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04, GATE-05
**Success Criteria** (what must be TRUE):
  1. In quick.md --full executor, Loop 2 (simulateSolutionLoop with onTweakFix) fires before the commit step and blocks commit on convergence failure
  2. In execute-plan.md executor, the same Loop 2 gate fires before the commit step
  3. When no formal models match the changed files, the gate completes silently without error or user prompt
  4. By default the gate warns but does not block commit (fail-open); with --strict flag it blocks commit on convergence failure (fail-closed)
  5. When convergence gates fail, the onTweakFix callback fires and the executor refines its approach before retrying
**Plans**: TBD

Plans:
- [ ] 52-01: TBD
- [ ] 52-02: TBD

### Phase 53: Skill Deprecation
**Goal**: /nf:model-driven-fix is fully deprecated with all consumers rewired to the new debug integration points
**Depends on**: Phase 50, Phase 51, Phase 52 (all consumers must be rewired before deprecation is safe)
**Requirements**: DEPR-01, DEPR-02, DEPR-03
**Success Criteria** (what must be TRUE):
  1. Invoking `/nf:model-driven-fix` prints a deprecation notice that directs the user to `/nf:debug` instead of executing
  2. The solve-remediate b_to_f layer dispatches through debug instead of model-driven-fix
  3. A grep for model-driven-fix across all workflow/skill files returns only the deprecation shim and changelog references (no active dispatch paths remain)
**Plans**: TBD

Plans:
- [ ] 53-01: TBD

## Progress

**Execution Order:** Phase 50 -> Phase 51 -> Phase 52 -> Phase 53

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 50. Debug Integration | 0/2 | Planning complete | - |
| 51. Task Classification | 0/TBD | Not started | - |
| 52. Pre-Commit Simulation Gate | 0/TBD | Not started | - |
| 53. Skill Deprecation | 0/TBD | Not started | - |
