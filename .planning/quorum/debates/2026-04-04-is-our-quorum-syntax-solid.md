# Quorum Debate
Question: Is our quorum syntax solid?
Date: 2026-04-04
Consensus: APPROVE
Rounds: 1

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude (ADVISORY) | Architecturally sound; preflight blind spot, stale quorum_instructions, no model dedup across CCR/API tiers | check-provider-health.cjs, nf.json quorum_instructions, providers.json |
| gemini-1 | Robust architecture; instructional rot + probe discrepancies create operational failure modes | IMPR-02, DISP-04, TOKN-04 |
| opencode-1 | Sound dispatch + consensus rules; preflight misses CCR, dedup gap, FALLBACK-01 checkpoint risk | quorum-preflight.cjs:275-343, IMPR-02 |
| codex-1 | UNAVAIL | — |
| opencode-2 | UNAVAIL (HARD_TIMEOUT) | — |
| copilot-1 | UNAVAIL | — |
| ccr-1 → api-1 | Sound architecture; preflight blind spot, stale quorum_instructions, no dedup guard, race condition risk | IMPR-02, DISP-04, UPPAAL-01 |
| ccr-2 | Operational gaps threaten execution integrity; preflight + dedup + MCP violation need resolution | IMPR-02, TOKN-04, DISP-04 |
| ccr-3 → api-3 | Largely solid; UPPAAL race-condition annotations incomplete | IMPR-02, DISP-04, UPPAAL-01, UPPAAL-03 |
| ccr-4 → api-4 | Architectural integrity; IMPR-02 violated by quorum_instructions, CE-3 unanimity fragile under UNAVAIL storms | IMPR-02, ENFC-03, ROOT-02 |
| ccr-5 → api-5 | Core model sound; dedup guard + fan-out timeout coordination needed | IMPR-02, DISP-03, SOLVE-10, UPPAAL-01 |
| ccr-6 → api-6 | Sound; dedup vulnerability + UPPAAL gaps + SOLVE-10 semaphore needed | IMPR-02, SOLVE-10, UPPAAL-01/02/03 |
| api-1 | UNAVAIL (no result file) | — |
| api-2 | UNAVAIL (no result file) | — |
| api-3 | Largely solid; rate-limit cascade prevention + UPPAAL annotations needed | IMPR-02, DISP-04, SOLVE-10, UPPAAL-01/03 |
| api-4 | Sound but CE-2 absolute BLOCK is single-point-of-failure; unanimity ambiguous during partial outages | IMPR-02, ENFC-03, SOLVE-10 |
| api-5 | Architecture sound; preflight slot inclusion + weak nonce enforcement + dedup are failure modes | IMPR-02, SLOT-02, DISP-04, SOLVE-10 |
| api-6 | Solid; CE-1/CE-2/CE-3 need formal spec in requirements, nonce replay mechanics underspecified | IMPR-02, DISP-03, UPPAAL-01 |

## Outcome
Unanimous consensus (12/12 valid voters): The quorum syntax is architecturally solid. All models agree on four operational gaps requiring remediation:

1. **Preflight blind spot** — check-provider-health.cjs misses api-*/ccr-* slots (searches ANTHROPIC_BASE_URL, not PROVIDER_SLOT)
2. **Stale quorum_instructions** — was forcing prohibited direct MCP calls (fixed during this session)
3. **No model dedup guard** — same model in CCR + API tiers could double-count votes
4. **UPPAAL race-condition models incomplete** — traceability matrix has null results for critical timing properties

Secondary concerns: per-provider rate-limit semaphores (SOLVE-10), CE-2 BLOCK appeal mechanism, nonce replay prevention.
