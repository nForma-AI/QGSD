# Quorum Debate
Question: Should the GATE-02 requirement state "observable evidence" or "observable signals at the confidence level the scoring system already accepts" — and what should the exact text be?
Date: 2026-03-09
Consensus: APPROVE
Rounds: 1

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude | Use "signals" — matches scoring vocabulary, honest about confidence level | bin/compute-per-model-gates.cjs, bin/promote-gate-maturity.cjs:inferSourceLayer |
| opencode-1 (T1 fallback) | APPROVE — text clear and correct, "signals" appropriate | — |
| claude-1 (T2 fallback) | APPROVE with refinements: add "e.g." for extensibility, "accumulated" over "legitimate" | evaluateGateA/B/C interfaces, inferSourceLayer heuristic |
| codex-1 | UNAVAIL (timeout) | — |
| gemini-1 | UNAVAIL (auth error) | — |
| copilot-1 | UNAVAIL (timeout) | — |

## Outcome
Consensus on "observable signals" with two accepted refinements: (1) "e.g." before parenthetical to make signal types extensible, (2) "accumulated" replaces "legitimate" to capture threshold-based promotion model. Final text: "AutoClose remediation steps SHALL produce observable signals (e.g., source_layer classification, semantic declaration detection) at the confidence level the scoring system already accepts. AutoClose SHALL NOT write gate_maturity directly; promotion follows from scoring functions independently evaluating accumulated signals."
