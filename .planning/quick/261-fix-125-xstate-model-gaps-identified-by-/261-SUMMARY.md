---
phase: quick-261
status: complete
---

# Quick Task 261: Fix XState Model Gaps for Gate A Grounding

## What Changed

1. **Added 11 missing self-loop transitions to the XState machine** (`src/machines/nf-workflow.machine.ts`):
   - IDLE: added DECIDE (self-loop), VOTES_COLLECTED (self-loop)
   - COLLECTING_VOTES: added QUORUM_START (self-loop), CIRCUIT_BREAK (self-loop), DECIDE (self-loop)
   - DELIBERATING: added QUORUM_START (self-loop), CIRCUIT_BREAK (self-loop)
   - DECIDED: added DECIDE, CIRCUIT_BREAK, QUORUM_START, VOTES_COLLECTED (all self-loops) — kept `type: 'final'`

2. **Rebuilt machine bundle** (`dist/machines/nf-workflow.machine.js`)

3. **Regenerated observed-fsm.json** — model comparison now shows:
   - Missing in model: **0** (was 11)
   - Matching transitions: **16** (was 5)
   - Model coverage: **84.2%** (was 62.5%)

## Gate A Impact

The Gate A grounding score improved marginally (0.306 -> 0.317) because Gate A scores across all 180 formal models, not just XState transitions. The 123 remaining model_gap entries represent formal models (Alloy, TLA+, PRISM) that lack L1 conformance trace grounding — a broader structural gap.

## Files Modified

- `src/machines/nf-workflow.machine.ts` — added self-loop transitions
- `dist/machines/nf-workflow.machine.js` — rebuilt bundle
- `.planning/formal/semantics/observed-fsm.json` — regenerated with 0 missing transitions
