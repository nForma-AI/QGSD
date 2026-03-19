# Research Index: v0.39 Dual-Cycle Formal Reasoning

**Quick reference for understanding dual-cycle architecture and integration points**

## Files in this Research

| File | Purpose | Audience |
|------|---------|----------|
| **SUMMARY_v0.39_DUAL_CYCLES.md** | Executive overview + roadmap implications | Roadmap planner, project lead |
| **ARCHITECTURE_v0.39_DUAL_CYCLES.md** | Detailed technical architecture + component specs | Implementer, architect |
| **This file (INDEX_v0.39_DUAL_CYCLES.md)** | Navigation guide | Anyone jumping in |

## Core Concepts

### Cycle 1: Diagnostic (Model Validation)

**What:** When a discovered/created model fails to reproduce a known bug, generate diagnostic feedback.

**Output:** "Model assumes X but bug shows Y" markdown report

**Example:**
```
Model assumes: timeout=5000ms
Bug shows: timeout=10000ms
Suggestion: Change TIMEOUT constant from 5000 to 10000
```

**Where it runs:** Phase 2 (Reproduction), after existing models fail to reproduce

**Key file:** cycle1-diagnostic-diff.cjs

**Integration point:** `/Users/jonathanborduas/code/QGSD/commands/nf/model-driven-fix.md` Phase 2, "not reproduced" branch

### Cycle 2: Solution Simulation (Fix Validation)

**What:** Before touching code, test fix ideas (natural language, constraints, code sketches) in model space.

**Flow:** Propose fix → Normalize → Generate consequence model → Run 3 gates → PASS | ITERATE | BLOCKED

**Gates:**
1. Invariant gate: Original invariants still hold
2. Bug gate: Bug no longer triggered
3. Regression gate: No violations in 2-hop neighbor models

**Where it runs:** Phase 4.5 (NEW), between constraint extraction and code fix

**Key files:**
- normalize-fix-idea.cjs (type detection + normalization)
- generate-consequence-model.cjs (model mutation)
- convergence-gate.cjs (automated gate checking)

**Integration point:** `/Users/jonathanborduas/code/QGSD/commands/nf/model-driven-fix.md` Phase 4.5 (new phase)

## Phase Integration

### Current v0.38 (6 phases)
```
Phase 1: Discovery         → Find existing models
Phase 2: Reproduction      → Run checkers
Phase 3: Refinement        → Create/refine model
Phase 4: Constraint        → Extract constraints
Phase 5: Constrained Fix   → Apply constraints + verify neighbors
Phase 6: Pre-Verification  → Verify fix works
```

### Enhanced v0.39 (6 phases + 2 cycles)
```
Phase 1: Discovery
Phase 2: Reproduction
         ├─ (NEW Cycle 1) Generate diagnostic if no reproduction
         └─ Guides Phase 3 refinement
Phase 3: Refinement
Phase 4: Constraint Extraction
Phase 4.5: (NEW Cycle 2) Solution Simulation
         ├─ Normalize fix idea
         ├─ Generate consequence model
         ├─ Run convergence gates
         └─ PASS → continue | ITERATE → retry | BLOCKED → error
Phase 5: Constrained Fix
Phase 6: Pre-Verification
```

## New Modules

| Module | Purpose | Tests | Dependencies |
|--------|---------|-------|---|
| **cycle1-diagnostic-diff.cjs** | Generate "model assumes X but bug shows Y" | 8 | None |
| **normalize-fix-idea.cjs** | Detect & normalize 3 input types (NL, constraint, code) | 12 | None |
| **generate-consequence-model.cjs** | Apply fix idea to model, preserve invariants | 10 | File system |
| **convergence-gate.cjs** | Run 3 gates: invariant, bug, regression | 15 | run-formal-verify.cjs |
| model-driven-fix.md enhancement | Phase 2 + Phase 4.5 orchestration | 5 | Above modules |
| Persistence layer | Save Cycle 2 simulation results | 2 | File system |
| CLI flags + prompts | User interaction + flags | 4 | Standard I/O |

**Total: 7 modules, 62 tests**

## Unchanged Modules (No changes required)

| Module | Why unchanged |
|--------|---|
| refinement-loop.cjs | Cycle 1 diagnostic runs after refinement, not during |
| model-constrained-fix.cjs | Cycle 2 accepts constraints as input; no logic change needed |
| run-formal-verify.cjs | Cycle 2 uses existing --scope flag for neighbor verification |
| resolve-proximity-neighbors.cjs | Used as-is by Cycle 2 regression gates |
| run-tlc.cjs, run-alloy.cjs | Called by convergence-gate.cjs via subprocess |

## Build Waves

### Wave 1: Cycle 1 Diagnostic (2-3 days)
- cycle1-diagnostic-diff.cjs (8 tests)
- model-driven-fix.md Phase 2 enhancement (2 tests)
- **Deliverable:** Phase 2 shows "Model assumes X but bug shows Y" when reproduction fails

### Wave 2: Cycle 2 Solution Simulation (5-7 days)
- normalize-fix-idea.cjs (12 tests)
- generate-consequence-model.cjs (10 tests)
- convergence-gate.cjs (15 tests)
- model-driven-fix.md Phase 4.5 orchestration (5 tests)
- Persistence layer (2 tests)
- **Deliverable:** Full Phase 4.5 with automated convergence gates

### Wave 3: UX Polish (2-3 days)
- CLI flags (--auto-cycle2, --max-iterations, --no-cycle2, etc.) (4 tests)
- Optional /nf:apply-fix command (3 tests)
- **Deliverable:** User-friendly access to dual cycles

## Key Design Decisions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| **Cycle 1 is diagnostic-only (advisory)** | No enforcement = backward compatible | Phase 2 & 3 unchanged; users see hints but can ignore |
| **Cycle 2 is Phase 4.5, not separate command** | Keeps solution testing in single workflow | Users experience dual-cycle as seamless part of bug fixing |
| **Convergence gates automated** | Objective pass/fail; no user decision fatigue | Users trust model's verdict; gates are formal properties |
| **Fix ideas normalized internally** | Support NL + constraints + code without forcing formal syntax | Accessible to all users; still rigorous |
| **Preserve original invariants in consequence models** | Ensures testing against all constraints | Prevents silent relaxation of properties |
| **No changes to existing v0.38 modules** | Additive design; minimal regression risk | All v0.38 features continue to work unchanged |

## Confidence Levels

| Area | Level | Notes |
|---|---|---|
| Architecture | HIGH | Phase integration points clear; module boundaries well-defined |
| Stack | HIGH | Reuses existing TLA+/Alloy/PRISM runners; no new dependencies |
| Cycle 1 implementation | HIGH | Diagnostic generation is straightforward analysis |
| Cycle 2 gates | MEDIUM | Gate logic sound; formalism-specific implementation needs validation |
| Consequence model generation | MEDIUM | Simple mutations (bounds, guards) straightforward; complex mutations need refinement |
| User experience | MEDIUM | Interaction flow is good; prompt design needs UX validation |

## Research Gaps (for phase-specific research later)

1. **Formalism-specific gate conditions** — How to detect "bug still triggered" in TLA+ vs Alloy vs PRISM?
2. **State space estimation heuristics** — What mutation types cause what state space increase?
3. **Normalization confidence thresholds** — At what confidence auto-accept vs ask user?
4. **Iteration guidance templates** — What suggestions for ITERATE verdict per gate type?
5. **Neighbor scope tradeoff** — Direct neighbors vs 2-hop for regression gate?

## Navigation Tips

**I want to understand...**
- **The big picture:** Start with SUMMARY_v0.39_DUAL_CYCLES.md (1 page executive summary)
- **How phases integrate:** See "Phase Integration" section above, or jump to ARCHITECTURE_v0.39_DUAL_CYCLES.md "Phase Integration Map"
- **Module specs:** Jump to ARCHITECTURE_v0.39_DUAL_CYCLES.md "New Modules Required" section (4 module specifications)
- **Build order:** See ARCHITECTURE_v0.39_DUAL_CYCLES.md "Suggested Build Order" (3 waves, 62 tests total)
- **Dependencies:** See "Unchanged Modules" above or ARCHITECTURE_v0.39_DUAL_CYCLES.md "Existing Module Touch Points"
- **Design rationale:** See "Key Design Decisions" table above
- **Implementation details:** Jump to ARCHITECTURE_v0.39_DUAL_CYCLES.md for module interface specs, data flow diagrams, sample JSON outputs

## Related Context

**For v0.38 (prior milestone):**
- See `.planning/research/ARCHITECTURE.md` (v0.38 model-driven-debug)
- See `.planning/research/SUMMARY.md` (v0.38 roadmap)

**For project vision:**
- `.planning/PROJECT.md` — Full nForma vision and v0.39 requirements

**For State:**
- `.planning/STATE.md` — Current project status (v0.39 started, defining requirements)

**Files to be modified:**
- `commands/nf/model-driven-fix.md` — Add Phase 2 Cycle 1 call + Phase 4.5 orchestration

**Files to be created:**
- `bin/cycle1-diagnostic-diff.cjs`
- `bin/normalize-fix-idea.cjs`
- `bin/generate-consequence-model.cjs`
- `bin/convergence-gate.cjs`
- `.planning/formal/cycle1-diagnostics/` (directory for diagnostic reports)
- `.planning/formal/cycle2-simulations/` (directory for simulation results)
- `.planning/formal/consequence-models/` (directory for generated models)

## Quick Facts

- **Total new modules:** 4 core + 3 supporting = 7
- **Total tests:** 62
- **Estimated duration:** 3 waves, ~12 days
- **Backward compatibility:** 100% (v0.38 features unchanged)
- **Risk level:** LOW (Wave 1) → MEDIUM (Wave 2) → LOW (Wave 3)
- **User value progression:** Diagnostic → Full solution testing → Easy access
- **Dependencies:** All new modules depend only on existing infrastructure; no new external dependencies

## Key Files for Implementation

**Core architecture files (existing, to understand):**
- `/Users/jonathanborduas/code/QGSD/commands/nf/model-driven-fix.md` — Current 6-phase orchestrator
- `/Users/jonathanborduas/code/QGSD/bin/refinement-loop.cjs` — Bug context + inverted verification (MRF-01, MRF-02)
- `/Users/jonathanborduas/code/QGSD/bin/model-constrained-fix.cjs` — Constraint extraction (CEX-01)
- `/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs` — Master verification runner with --scope support
- `/Users/jonathanborduas/code/QGSD/bin/resolve-proximity-neighbors.cjs` — 2-hop BFS neighbor resolution

**Config files (to reference):**
- `.planning/formal/model-registry.json` — Model metadata for scoping
- `.planning/formal/bug-model-gaps.json` — Bug tracking (will reference Cycle 1 diagnostics)
- `.planning/config.json` — Configuration for iteration limits, caching, etc.

**Test infrastructure (to reuse):**
- `test/` directory structure for new unit tests
- Existing test patterns in `bin/*.test.cjs` files

## Checklist for Implementation

- [ ] Read SUMMARY_v0.39_DUAL_CYCLES.md (this research summary)
- [ ] Review existing v0.38 architecture in model-driven-fix.md
- [ ] Understand refinement-loop.cjs (MRF-01/02 patterns)
- [ ] Understand model-constrained-fix.cjs (constraint extraction)
- [ ] Understand run-formal-verify.cjs (verification runner, --scope flag)
- [ ] Design Wave 1 cycle1-diagnostic-diff.cjs (8 test cases)
- [ ] Implement Wave 1 + integration tests
- [ ] Design Wave 2 module specs (normalize, generate, gate) + sample outputs
- [ ] Implement Wave 2 + 45 test cases
- [ ] Design Wave 3 CLI enhancements
- [ ] Implement Wave 3 + polish
- [ ] E2E testing across all 3 waves
- [ ] Document Phase 4.5 changes in model-driven-fix.md
- [ ] Update STATE.md with completion status

---

**Research completed:** 2026-03-18
**Next phase:** Implementation planning (Wave 1: cycle1-diagnostic-diff.cjs)
