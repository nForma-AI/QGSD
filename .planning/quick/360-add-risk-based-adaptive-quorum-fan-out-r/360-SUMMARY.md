# Quick Task 360: Risk-Based Adaptive Quorum Fan-Out

## What Changed

Added risk-based adaptive quorum fan-out to the quick workflow. A Haiku risk classifier in Step 2.7 categorizes tasks as low/medium/high risk, and Step 5.7 uses the risk level to determine quorum fan-out count.

## Fan-Out Mapping

| Risk Level | Fan-out | Slots | When |
|---|---|---|---|
| low | 1 | self only (no quorum) | Single-file, config, typo, rename |
| medium | 3 | 2 external + self | Most quick tasks, moderate changes |
| high | 5 | 4 external + self | Architecture, formal models, hooks, multi-file |

## Files Modified

- `core/workflows/quick.md` — Added `--force-quorum` flag parsing (Step 1), risk classifier Haiku subagent (Step 2.7 sub-step 1.7), risk_level in scope-contract.json, adaptive fan-out logic (Step 5.7), audit logging
- `core/references/quorum-dispatch.md` — Updated Section 3 fan-out mapping (low=1, medium=3, high=5), removed stale `routine`/`absent` risk levels, added skip-quorum documentation

## Key Design Decisions

1. **Caution bias**: Classifier biased toward higher risk — false-high is acceptable, false-low is dangerous
2. **Fail-open defaults to medium**: If Haiku is unavailable, risk defaults to medium (not low)
3. **Guardrails**: ROADMAP, formal model, hook, and workflow files can never be classified as low risk
4. **--force-quorum override**: Forces medium fan-out even when classifier says low
5. **Audit trail**: Every quorum reduction or skip emits a structured audit log to stdout

## Invariant Safety

- When quorum runs (medium/high): EventualConsensus, ProtocolTerminates, DeliberationMonotone, ImprovementMonotone all preserved
- When quorum skipped (low): no quorum protocol runs — invariants not applicable

## Commit

- `8e27fe35` — feat(quick-360): add risk-based adaptive quorum fan-out with Haiku risk classifier
