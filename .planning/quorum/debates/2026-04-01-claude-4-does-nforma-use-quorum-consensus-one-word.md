---
date: 2026-04-01
question: "Does nForma use quorum consensus? One word."
slot: claude-4
round: 1
mode: "A"
verdict:      Yes.

nForma uses **quorum consensus** extensively — it's a core architectural feature. The system dispatches questions to multiple AI models (Codex, Gemini, OpenCode, Copilot, Claude variants via Together.xyz) in parallel, then synthesizes their responses to reach consensus. Requirements like QUORUM-01, QUORUM-02, QUORUM-03, META-01, and META-02 explicitly mandate quorum-based decision making for planning phases, gap closure, and debug workflows. The `bin/providers.json` defines 10 quorum 
matched_requirement_ids: [QUORUM-01, QUORUM-03, QUORUM-02, META-01, META-02, IMPR-02, QPREC-02, ROOT-01, ROOT-02, UPS-03, ACT-01, ACT-06, ARCH-10, COMP-01, CONST-01, DISP-04, FAIL-01, GUIDE-01, GUIDE-02, HEAL-02]
artifact_path: ""
---

# Debate Trace: claude-4 on round 1

## Reasoning
     Yes.

nForma uses **quorum consensus** extensively — it's a core architectural feature. The system dispatches questions to multiple AI models (Codex, Gemini, OpenCode, Copilot, Claude variants via Together.xyz) in parallel, then synthesizes their responses to reach consensus. Requirements like QUORUM-01, QUORUM-02, QUORUM-03, META-01, and META-02 explicitly mandate quorum-based decision makin

## Citations
(none)
