# Research Index: Model-Driven Debugging (v0.38)

**Date:** 2026-03-17
**Milestone:** v0.38 — Model-Driven Debugging
**Status:** Complete, ready for planning phase

---

## Files in This Research

| File | Purpose | Key Content |
|------|---------|------------|
| **SUMMARY.md** | Executive summary with implications for roadmap | Bug → Model → Constraints → Fix Guidance; 2 new npm packages; 6 features in 3 phases |
| **STACK.md** | Technology stack recommendations with rationale | fast-xml-parser (Alloy parsing), acorn (code-scope analysis), custom parsers for traces/constraints |
| **FEATURES.md** | Feature landscape and dependencies | 6 features with table stakes/differentiators; MVP prioritization; anti-features to avoid |
| **ARCHITECTURE.md** | Component boundaries and data flow | Bug-to-Model → Counterexample → Constraint → English → Fix guidance; integration with existing TLC/Alloy runners |
| **PITFALLS.md** | Domain pitfalls and mitigation strategies | Cascade confusion in traces, constraint extraction edge cases, Haiku latency, bug-to-model false positives |

---

## Quick Reference

### MVP (v0.38)
1. **Bug-to-Model Lookup** — Find models matching buggy code files
2. **Counterexample Extraction** — Parse TLC/Alloy output into readable traces
3. **Constraint Extraction** — Pull formal rules from specs (INVARIANT, PROPERTY)
4. **Constraint-to-English** — Translate via Haiku LLM
5. **Constraint-Guided Fix** — Inject constraints into `/nf:debug` quorum phase

### Defer to v0.39
6. **Cross-Model Regression** — Run fix against neighboring models

---

## Key Decisions

### Stack Choices
- ✓ **fast-xml-parser@5.4.1** — Alloy SAT solver outputs XML; battle-tested library
- ✓ **acorn@8.11.0** — JavaScript AST parser for code-file-to-model mapping
- ✓ **NO parser combinators** — Regex-based extraction is 95% sufficient, lighter than libraries
- ✓ **NO new TLC/Alloy runners** — Attach parsers downstream after existing runners

### Architecture
- ✓ **Independent parsers** — Each step (trace → constraint → English) is a separate script
- ✓ **Reuse proximity graph** — Bug-to-model lookup built on existing formal-proximity.cjs
- ✓ **Reuse quorum dispatch** — Constraint-to-English via existing Haiku slot
- ✓ **No breaking changes** — Existing TLC/Alloy runners unchanged

### Feature Priority
1. Bug-to-Model Lookup (enables everything)
2. Counterexample Extraction (critical path)
3. Constraint Extraction (critical path)
4. Constraint-to-English (low complexity, high value)
5. Constraint-Guided Fix (integrates with existing `/nf:debug`)
6. Cross-Model Regression (deferred, nice-to-have)

---

## Critical Risks

| Risk | Mitigation | Phase |
|------|-----------|-------|
| Cascade confusion in traces | Define oscillation carefully; test on known cascades | Phase 2 |
| Constraint extraction edge cases | Start with INVARIANT+PROPERTY; test on 10 real specs | Phase 2 |
| Haiku translation latency | Batch constraints; cache translations | Phase 3 |
| Bug-to-model false positives | Score by code file match first; test on 10 real bugs | Phase 1 |

---

## Integration Points

### Existing Files (No Changes)
- `bin/run-tlc.cjs` — Invoke as-is; attach parsers to output
- `bin/run-alloy.cjs` — Invoke as-is; attach parsers to output
- `bin/formal-proximity.cjs` — Reuse for semantic similarity scoring
- `bin/call-quorum-slot.cjs` — Reuse for Haiku constraint translation
- `/nf:debug` phase — Inject extracted constraints as additional context

### New Files to Create
- `bin/itf-trace-parser.cjs` — Parse TLC trace.txt to ITF JSON
- `bin/alloy-instance-extractor.cjs` — Parse Alloy XML output (uses fast-xml-parser)
- `bin/invariant-constraint-extractor.cjs` — Regex-based constraint extraction from specs
- `bin/constraint-naturalizer.cjs` — Call Haiku to translate constraints to English
- `bin/bug-to-model-resolver.cjs` — Map code files to models (uses acorn + proximity graph)

---

## Data Structures

### Input: Bug Report
```json
{
  "stackTrace": ["bin/quorum-slot-worker.cjs:45", "bin/call-quorum-slot.cjs:120"],
  "description": "Quorum votes not unanimous"
}
```

### Processing: Model Lookup
```json
{
  "models": [
    { "path": "NFQuorum.tla", "relevance": 0.95, "reason": "@requirement R3.1" },
    { "path": "NFQuorumComposition.als", "relevance": 0.72, "reason": "@requirement R4.5" }
  ]
}
```

### Output: Constraints (English)
```json
[
  "Quorum votes must all match",
  "No message duplication allowed",
  "Maximum of 3 voting rounds"
]
```

---

## Confidence Levels

| Area | Confidence | Rationale |
|------|-----------|-----------|
| Stack | HIGH | Libraries battle-tested; custom parsers are lightweight |
| Features | MEDIUM | Novel combination, but all techniques well-documented |
| Architecture | HIGH | Integration points verified against existing code |
| Pitfalls | HIGH | Cascade risk validated by Gauss-Seidel theory; other pitfalls confirmed in existing data |

---

## Next Steps

1. **Planning Phase:** Flesh out Phase 1 (Bug-to-Model Lookup) requirements
2. **Phase 1 Implementation:** Extend `formal-scope-scan.cjs` with file-matching logic
3. **Phase 2 Implementation:** Write trace and constraint parsers; test on real counterexamples
4. **Phase 3 Implementation:** Wire Haiku calls; integrate with `/nf:debug` phase
5. **Validation:** User testing on 10 real bugs; measure `/nf:debug` time reduction

---

**Research completed:** 2026-03-17
**Ready for:** Planning phase (Phase 1 scoping)
**Ownership:** Model-driven debugging feature team
