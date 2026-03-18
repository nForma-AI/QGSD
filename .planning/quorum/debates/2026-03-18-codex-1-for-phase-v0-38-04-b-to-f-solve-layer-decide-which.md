---
date: 2026-03-18
question: "For Phase v0.38-04 (B-to-F Solve Layer), decide which of these 4 gray areas can be resolved by quorum consensus (APPROVE) vs genuinely need user input (BLOCK). For each APPROVED item, provide the recommended answer biased toward the long-term solution.

Phase goal: The solve pipeline autonomously identifies bugs that formal models should explain but don't, and routes them to model creation or refinement.

Success criteria:
1. b_to_f exists as 20th layer key in layer-constants.cjs
2. solve-wave-dag.cjs includes b_to_f with dependency on t_to_c
3. nf-solve.cjs diagnostic sweep computes b_to_f residual by classifying failing tests as covered_reproduced (0), covered_not_reproduced (+1), or not_covered (+1)
4. solve-remediate.md dispatches close-formal-gaps for not_covered gaps (max 3/cycle) and model refinement for blind spots (max 2/cycle)

Gray areas:
1. Bug classification thresholds — How should residual scoring work? When does covered_not_reproduced get routed to refinement vs creation? What constitutes \"covered\" vs \"not covered\"?
2. Cycle dispatch limits — Max 3/cycle for not_covered, max 2/cycle for blind spots are in success criteria. Should these be configurable? What happens to overflow items?
3. Solve layer reporting — What does b_to_f layer output look like in solve results? Table format, residual score, or detailed breakdown?
4. Remediation priority ordering — When multiple bugs qualify, which get dispatched first?

Context: nForma solve pipeline has existing layers (19 so far) with established patterns for residual scoring, wave DAGs, and remediation dispatch. Existing layers use configurable limits and table-based reporting.

For each: Vote APPROVE (quorum can decide) or BLOCK (needs user vision). If APPROVE, state the recommended answer."
slot: codex-1
round: 1
mode: "A"
verdict: 1. **Gray 1: APPROVE.** Repo patterns favor deterministic residuals over subjective thresholds: `nf-solve.cjs` uses explicit counts/weighted counts and `-1` for unknown, while `close-formal-gaps` already supports `--bug-context` plus a refinement loop for “model exists but doesn’t reproduce” cases. Recommended answer: `covered` means the failing test maps to at least one formal model through requirement/recipe/annotation lineage and that model was actually checked; classify `covered_reproduced=0
matched_requirement_ids: [SENS-01, QUORUM-01, CONV-03, QUORUM-03, DIAG-01, DISP-04, PERF-01, DIAG-02, META-01, ORES-03, UPS-03, DIAG-06, CALIB-04, CL-01, CONF-03, DISP-03, PRED-02, SENS-03, SIG-01, TRACE-06]
artifact_path: ""
---

# Debate Trace: codex-1 on round 1

## Reasoning
1. **Gray 1: APPROVE.** Repo patterns favor deterministic residuals over subjective thresholds: `nf-solve.cjs` uses explicit counts/weighted counts and `-1` for unknown, while `close-formal-gaps` already supports `--bug-context` plus a refinement loop for “model exists but doesn’t reproduce” cases. Recommended answer: `covered` means the failing test maps to at least one formal model through requi

## Citations
(none)
