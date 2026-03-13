# Quorum Debate
Question: Do you agree with the assessment that the quorum FALLBACK-01 regression was caused by (1) missing auth_type config, (2) failoverRule gated on t1Unused only, (3) contradictory fail-open instruction? Are the applied fixes correct?
Date: 2026-03-11
Consensus: APPROVE
Rounds: 1

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude (ADVISORY) | APPROVE — diagnosis and fix are sound. auth_type defaulting to 'api' emptied T1, gating on t1Unused.length > 0 skipped the full FALLBACK-01 sequence, fail-open text contradicted fallback. | hooks/nf-prompt.js:434, :600, :684 |
| codex-1 (primary) | UNAVAIL (timeout) | — |
| gemini-1 (primary) | UNAVAIL (timeout) | — |
| opencode-1 (T1 fallback) | UNAVAIL (timeout) | — |
| copilot-1 (T1 fallback) | UNAVAIL (quota 402) | — |
| claude-1 (T2 fallback) | UNAVAIL (shell escaping error) | — |
| claude-3 (T2 fallback) | UNAVAIL (service not running) | — |
| claude-4 (T2 fallback) | APPROVE — All four fixes correct and necessary. auth_type config, condition expansion, T2-only path, and strengthened fail-open text directly address root causes. | hooks/nf-prompt.js:483, :600, :615-617, :684; ~/.claude/nf.json agent_config |
| claude-6 (T2 fallback) | UNAVAIL (exit 127) | — |

## Outcome
Consensus APPROVE (1/1 valid external voters). The FALLBACK-01 regression assessment is confirmed correct by claude-4 (Kimi-K2 via Fireworks). The fixes address all three root causes: missing auth_type config, narrow condition gating, and contradictory fail-open instruction.
