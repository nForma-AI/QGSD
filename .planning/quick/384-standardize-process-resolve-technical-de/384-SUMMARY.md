# Summary: Quick Task 384 — Standardize Process: Resolve Technical Debt as Required Gaps

**Status:** Complete
**Date:** 2026-04-09

## What was done

Audited the codebase for technical debt (code markers, traceability gaps, logic inconsistencies, unmapped TODOs) and converted findings into standardized required engineering tasks tracked in requirements.json and REQUIREMENTS.md.

## Artifacts created

- **384-AUDIT.md** — structured audit of all tech debt findings
- **.planning/formal/requirements.json** — 9 new DEBT-* requirement entries added (DEBT-07 through DEBT-15)
- **.planning/REQUIREMENTS.md** — traceability table updated with DEBT-* section and new entries

## Tech debt items standardized

| ID | Description |
|----|-------------|
| DEBT-07 | Formalize constraint extraction for debug invariants in propose-debug-invariants.cjs |
| DEBT-08 | Add future instrumentation source for per-file trace data in formalization-candidates.cjs |
| DEBT-09 | Standardize JSON read/write serialization patterns across bin/ scripts |
| DEBT-10 | Standardize path resolution: consolidate _nfBin helper usage across bin/ modules |
| DEBT-11 | Reduce empty catch block proliferation with explicit error handling |
| DEBT-12 | Create formal model for shell-safe prompt delivery (stdin piping, no escaping) |
| DEBT-13 | Create formal model for quorum slot model deduplication (diversity guarantee) |
| DEBT-14 | Create formal model for net_residual computation (FP subtraction from raw sweep residuals) |
| DEBT-15 | Create formal model for solve convergence layer-transition sweeps (L1->L2, L2->L3, L3->TC) |

## Key decisions

- **Scaffolding placeholders excluded:** Intentional TODOs in emitter-tla.cjs and scaffold-config.cjs (test stub infrastructure) were excluded as they are by-design placeholders for the formal verification pipeline
- **Traceability verification:** Cross-checked REQUIREMENTS.md against v0.41 phase completion status. All v0.41 requirements (DBUG-*, ROUTE-*, GATE-*, DEPR-*) are accurately marked. No status corrections were needed.
- **Code modifications:** No production code was modified. Only documentation and requirement tracking were updated per scope contract.
- **Formal verification capture:** 4 formal modeling gaps (shell-safe delivery, quorum deduplication, net_residual, convergence sweeps) identified in todos.json were converted to trackable DEBT-* requirements
- **Logic pattern standardization:** 3 major inconsistency patterns identified (JSON serialization, path resolution, error handling) as DEBT items for future standardization

## Audit methodology

Conducted 4-part audit as specified in task plan:

1. **Code comment markers** — grep scans for FIXME, HACK, substantive TODOs (3 findings)
2. **REQUIREMENTS.md traceability gaps** — cross-checked against phase summaries (0 corrections needed)
3. **Logic inconsistency patterns** — identified serialization, path resolution, and error handling patterns (3 patterns)
4. **Unmapped todos.json items** — reviewed for meaningful reason fields (4 formal modeling tasks)

Total substantive findings: 2 code TODOs + 3 logic patterns + 4 formal model gaps = 9 DEBT entries created
