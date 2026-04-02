---
date: 2026-04-02
question: "Review the implementation of quick task 370 (project-level formal spec discovery). Judge whether it is thorough — check the actual code in bin/formal-scope-scan.cjs, bin/run-formal-check.cjs, bin/run-formal-check.test.cjs, and .planning/formal/specs/formal-checks.json. Consider: security gates, fail-open behavior, test coverage, integration correctness, and edge cases."
slot: copilot-1
round: 1
mode: "A"
verdict: Verdict: run-formal-check is well‑hardened and well‑tested; formal-scope-scan is feature‑rich with fail‑open layers but is under‑tested and contains an integration bug.

run-formal-check enforces an allowlist, dangerous-arg filters and path‑containment checks and has focused unit tests (PRISM delegation, skip/fail‑open, unknown‑module handling). Formal‑scope‑scan provides proximity/semantic/agentic fallbacks and manifest merging, but the merged registry is never used for bug‑mode matching, so pr
matched_requirement_ids: [SENS-01, SCOPE-01, SENS-02, SENS-03, TRIAGE-01, UPPAAL-01, FAIL-01, TEST-01, TEST-02, TRACE-01, VERIFY-01, CLINK-01, FAIL-02, FV-04, PF-01, PLAN-02, PROMO-02, SCOPE-02, SCOPE-03, SPEC-01]
artifact_path: ""
---

# Debate Trace: copilot-1 on round 1

## Reasoning
Verdict: run-formal-check is well‑hardened and well‑tested; formal-scope-scan is feature‑rich with fail‑open layers but is under‑tested and contains an integration bug.

run-formal-check enforces an allowlist, dangerous-arg filters and path‑containment checks and has focused unit tests (PRISM delegation, skip/fail‑open, unknown‑module handling). Formal‑scope‑scan provides proximity/semantic/agenti

## Citations
(none)
