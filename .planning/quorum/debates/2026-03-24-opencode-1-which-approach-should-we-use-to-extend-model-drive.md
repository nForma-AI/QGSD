---
date: 2026-03-24
question: "Which approach should we use to extend model-driven-fix into regular task execution to keep formal models in sync with code changes?

Context: nForma has formal models (TLA+, Alloy, PRISM) in .planning/formal/ that specify system invariants. Currently, after code execution (quick, quick --full, phase), the workflow only VERIFIES code against existing models but never UPDATES those models to reflect code changes. This means formal models can drift from reality.

The existing model-driven-fix skill has 6 phases for bug diagnosis. We want to reuse/extend it so formal models stay in sync with code changes during normal task execution.

Three options:

Option A: Lightweight \"--sync\" mode on model-driven-fix — opt-in per task. When a plan declares formal_artifacts: update, the executor invokes model-driven-fix --sync which skips bug diagnosis phases and goes straight to: diff code changes → identify affected formal modules → update specs → run checkers → commit. Smallest change, leverages existing formal_artifacts declarations. Downside: models still drift when planner forgets to declare it.

Option B: Auto-trigger after every task — automatically invoke model-driven-fix --sync after every task that touches code covered by formal modules, regardless of plan declaration. No drift possible. Downside: adds latency to every task, may update models unnecessarily.

Option C: Post-verification reconciliation — keep it in the verification phase. If the verifier detects a mismatch between code and models, it triggers model-driven-fix --sync to reconcile. Only fires when needed. Downside: reactive not proactive, verification must run first.

Which option (A, B, or C) should we implement, and why? You may also propose a hybrid."
slot: opencode-1
round: 1
mode: "A"
verdict: [0m
> build · grok-code-fast-1
[0m
ERROR 2026-03-24T16:09:19 +1636ms service=llm providerID=github-copilot modelID=grok-code-fast-1 sessionID=ses_2df647225ffe2534bXmP73Cq92 small=false agent=build mode=primary error={"error":{"name":"AI_APICallError","url":"https://api.githubcopilot.com/chat/completions","requestBodyValues":{"model":"grok-code-fast-1","messages":[{"role":"system","content":"You are opencode, an interactive CLI tool that helps users with software engineering tasks. Use the inst
matched_requirement_ids: [VERF-04, ACT-02, PLAN-02, DECOMP-03, PLAN-01, SENS-01, SENS-02, SOLVE-04, VERF-02, ANNOT-04, GATE-05, SCHEMA-04, DECOMP-05, PRED-02, RSN-06, SOLVE-07, SYNC-02, SYNC-04, TOKN-02, UPS-05]
artifact_path: ""
---

# Debate Trace: opencode-1 on round 1

## Reasoning
[0m
> build · grok-code-fast-1
[0m
ERROR 2026-03-24T16:09:19 +1636ms service=llm providerID=github-copilot modelID=grok-code-fast-1 sessionID=ses_2df647225ffe2534bXmP73Cq92 small=false agent=build mode=primary error={"error":{"name":"AI_APICallError","url":"https://api.githubcopilot.com/chat/completions","requestBodyValues":{"model":"grok-code-fast-1","messages":[{"role":"system","content":"You 

## Citations
(none)
