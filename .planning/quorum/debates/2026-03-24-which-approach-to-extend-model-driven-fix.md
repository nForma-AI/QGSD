# Quorum Debate
Question: Which approach should we use to extend model-driven-fix into regular task execution to keep formal models in sync with code changes?
Date: 2026-03-24
Consensus: APPROVE
Rounds: 1

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude (ADVISORY) | Option A as starting point, upgrade to A+C hybrid later | core/workflows/quick.md, core/workflows/execute-phase.md, core/workflows/model-driven-fix.md |
| codex-1 | Hybrid A+B: keep formal_artifacts as planner's explicit contract + auto-detect when touched files intersect formal coverage as safety net. Before each task's atomic commit: compute touched files → map to formal coverage → if declared OR intersection detected → run --sync → include in same commit | plan-phase.md:306, plan-phase.md:571, quick.md:253, quick.md:560, quick.md:627, execute-phase.md:427, model-driven-fix.md:388 |
| gemini-1 | UNAVAIL (hook error) | — |
| opencode-1 (T1 fallback) | UNAVAIL (hung response) | — |
| copilot-1 (T1 fallback) | UNAVAIL (off-topic response) | — |
| claude-1 (T2 fallback) | UNAVAIL (dispatch error) | — |
| claude-2 (T2 fallback) | UNAVAIL (dispatch error) | — |

## Outcome
Consensus on hybrid A+B approach: maintain the existing `formal_artifacts: update` planner declaration as the explicit opt-in path, but add an executor-side safety net that automatically detects when touched files intersect formal model coverage (via model-registry.json mapping) and triggers `model-driven-fix --sync` even when the planner omits the declaration. Model updates are included in the same atomic commit as code changes, preserving the single-commit invariant. This avoids Option B's universal latency overhead by only triggering on tasks that actually touch formally-covered code, while closing Option A's drift gap when planners forget to declare formal_artifacts.
