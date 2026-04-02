---
date: 2026-04-01
question: "Does nForma use quorum consensus? One word."
slot: claude-2
round: 1
mode: "A"
verdict: **Yes.**

nForma uses quorum consensus as its core enforcement mechanism. The system requires multi-model agreement before proceeding with planning decisions, gap closures, and diagnostic conclusions.

Key evidence from the codebase:

1. **R3 quorum requirement** — QUORUM-01 mandates that `plan-milestone-gaps` proposed phases are submitted to quorum for approval before ROADMAP.md updates (replaces AskUserQuestion confirmation gate)

2. **Parallel dispatch architecture** — IMPR-02 requires quorum
matched_requirement_ids: [QUORUM-01, QUORUM-03, QUORUM-02, META-01, META-02, IMPR-02, QPREC-02, ROOT-01, ROOT-02, UPS-03, ACT-01, ACT-06, ARCH-10, COMP-01, CONST-01, DISP-04, FAIL-01, GUIDE-01, GUIDE-02, HEAL-02]
artifact_path: ""
---

# Debate Trace: claude-2 on round 1

## Reasoning
**Yes.**

nForma uses quorum consensus as its core enforcement mechanism. The system requires multi-model agreement before proceeding with planning decisions, gap closures, and diagnostic conclusions.

Key evidence from the codebase:

1. **R3 quorum requirement** — QUORUM-01 mandates that `plan-milestone-gaps` proposed phases are submitted to quorum for approval before ROADMAP.md updates (replaces

## Citations
(none)
