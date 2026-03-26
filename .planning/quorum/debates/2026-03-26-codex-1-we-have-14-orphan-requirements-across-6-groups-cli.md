---
date: 2026-03-26
question: "We have 14 orphan requirements across 6 groups (CLINK-01/02, FPTUNE-01/02/03, GPROMO-01/02/03, TLINK-01/03, HTARGET-02, ROOT-02) that exist in requirements.json but have no formal model coverage. All describe implementation-level behavior: scanner suppression thresholds, FP rate tracking, gate promotion state transitions, test annotation parsing, DAG ordering, and workflow steps. Should these be: (a) acknowledged as not-required for formal modeling (implementation structure covered by unit tests), (b) linked to existing models where possible (e.g., GPROMO → NFSolveConvergence.tla), or (c) new formal models created? Consider: these are code behavior requirements, not system invariants. Most are testable by grep/unit test, not TLA+/Alloy."
slot: codex-1
round: 1
mode: "A"
verdict: Verdict: mostly **(a)**, not **(c)**, and only very limited **(b)** if you explicitly downgrade the claim to “adjacent/derived support,” not direct formal coverage. In this repo, all of these IDs are absent from the model registry and formal annotations, while the current formal specs cover broader invariants instead: `NFSolveConvergence.tla` models bounded sessions, oscillation, and monotonic gate transitions, not FP-rate windows, annotation regexes, changelog snapshots, DAG priority heuristics
matched_requirement_ids: [TEST-02, FV-04, SENS-03, TLINK-03, UPPAAL-01, ANNOT-04, FPTUNE-01, DIAG-02, FPTUNE-02, FPTUNE-03, GATE-03, ROOT-02, SENS-01, STATE-03, TLINK-01, UPPAAL-03, ACT-01, ANNOT-05, BML-01, BML-03]
artifact_path: ""
---

# Debate Trace: codex-1 on round 1

## Reasoning
Verdict: mostly **(a)**, not **(c)**, and only very limited **(b)** if you explicitly downgrade the claim to “adjacent/derived support,” not direct formal coverage. In this repo, all of these IDs are absent from the model registry and formal annotations, while the current formal specs cover broader invariants instead: `NFSolveConvergence.tla` models bounded sessions, oscillation, and monotonic gat

## Citations
(none)
