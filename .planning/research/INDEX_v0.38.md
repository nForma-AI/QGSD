# Research Index: nForma v0.38 Model-Driven Debugging

**Created:** 2026-03-17
**Phase:** Research (Phase 6)
**Milestone:** v0.38 — Model-Driven Debugging

---

## Research Files Created

### 1. SUMMARY_v0.38_MODEL_DRIVEN_DEBUG.md
**Purpose:** Executive overview, roadmap implications, phase structure
**For:** Roadmap creators, milestone planners, stakeholders
**Key sections:**
- Executive summary of 7 critical pitfalls
- Phase structure (4 phases recommended)
- Confidence assessment
- Research gaps for each phase

**Start here** for understanding what v0.38 needs and why.

---

### 2. PITFALLS_v0.38_MODEL_DRIVEN_DEBUG.md
**Purpose:** Detailed pitfall analysis with examples, prevention strategies, detection methods
**For:** Phase designers, architects, quality assurance
**Key sections:**
- 10 pitfalls (7 critical, 3 integration-level)
- Why each pitfall happens
- Prevention strategies with design points
- Detection warning signs
- Phase-specific assignments

**Read after SUMMARY.** For each phase design, consult relevant pitfall sections.

---

## How to Use This Research

### For Roadmap Creation
1. Read SUMMARY_v0.38_MODEL_DRIVEN_DEBUG.md (15 min)
2. Note the 4-phase structure and critical pitfalls
3. For each phase, consult PITFALLS section on that phase's topics
4. Use prevention strategies as acceptance criteria for phase designs

### For Phase Design
1. Identify which pitfalls your phase addresses
2. For each pitfall, read full description in PITFALLS file
3. Include prevention strategies in phase design doc
4. Add detection warning signs as test cases

### For Quality Assurance
1. Before phase completion, check PITFALLS for warning signs
2. Run tests that specifically prevent pitfall occurrence
3. Log metrics that would indicate pitfall (latency, model regression count, etc.)

---

## Quick Reference: Pitfalls by Phase

| Phase | Critical Pitfalls | Moderate Pitfalls |
|-------|------------------|-------------------|
| **Phase 1: Debug Integration** | #2 State explosion, #1 False confidence | #7 Performance |
| **Phase 2: Constraint Extraction** | #3 Over-specification, #4 Non-convergence | #1 False confidence |
| **Phase 3: Solve Integration** | #5 Cascades, #6 B→F noise | — |
| **Phase 4: Performance & Docs** | — | #7 Performance, #8 Precision communication |

---

## Key Findings Summary

### Highest Risk
1. **False confidence from model reproduction** — Models may explain symptoms, not causes
2. **State space explosion on-demand** — Large models timeout; 60s constraint is real
3. **Constraint over-specification** — Extracted constraints may block valid fixes

### Highest Impact
- All three "highest risk" items can cause shipped fixes that don't solve root problems
- Without state-space management, /nf:debug will be slow and unreliable
- Without constraint validation, fixes will be overly complex or ineffective

### Mitigation Strategy
- Implement structural gates (mechanism-verification, pre-flight estimation, regression mapping)
- Build gates at design time; cannot patch after deployment
- Phase approach prioritizes risk reduction before broader integration

---

## Next Steps for Milestone Planning

1. **Validate phase structure** — Does 4-phase approach match available resources?
2. **Assign phase owners** — Each phase needs architect + QA lead
3. **Create phase design docs** — Use PITFALLS as reference for prevention strategies
4. **Define metrics** — What will you measure to detect each pitfall?
5. **Plan research tasks** — See "Pitfalls Requiring Research" section in PITFALLS_v0.38 file

---

## Document Metadata

- Research date: 2026-03-17
- Project: nForma (fork/extension of GSD)
- Milestone: v0.38
- Milestone goal: Evolve formal models from descriptive (validation) to prescriptive (debugging guide)
- Confidence: MEDIUM (academic research + infrastructure analysis; needs production validation)

---

## Questions?

Key uncertainties documented in PITFALLS file's "Gaps to Address" section.

