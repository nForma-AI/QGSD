# Quorum Debate
Question: Which approach should nForma use to ensure users run nf:sync-baselines before workflows that depend on requirements.json? Option A (solve only), B (shared script), or C (solve + progress nudge)? Blocking or advisory?
Date: 2026-04-03
Consensus: APPROVE
Rounds: 3

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude | Option C, advisory. Solve warning + progress nudge. | bin/nf-solve.cjs:748, :1666-1670, :2182-2184 |
| codex-1 | Option B, advisory. Shared pre-flight across all consumers. Progress nudge secondary. | bin/nf-solve.cjs:748, bin/formal-test-sync.cjs:106, commands/nf/progress.md:2, core/workflows/new-project.md:1002, core/workflows/new-milestone.md:281 |
| gemini-1 | UNAVAIL | — |
| opencode-1 (T1 fallback) | UNAVAIL (truncated) | — |
| copilot-1 (T1 fallback) | Option B, blocking by default with --force override. Shared check-baselines.cjs. | — |

## Round 2
| Model | Position | Citations |
|---|---|---|
| Claude | Option C, advisory (unchanged) | — |
| codex-1 | Revised to Option C, advisory. Shared script less compelling — close-formal-gaps and resolve are .md workflow docs, not script surfaces. | bin/nf-solve.cjs:1664, :2181, bin/formal-test-sync.cjs:109, core/workflows/close-formal-gaps.md:14, commands/nf/resolve.md:152 |
| copilot-1 | Holds Option B, revised to advisory. Also proposes residual=-1 for DIAG-02, optional --require-baselines for CI. | .planning/STATE.md:52-55, DIAG-02 requirement |

## Round 3
| Model | Position | Citations |
|---|---|---|
| Claude | Option C, advisory (unchanged) | — |
| codex-1 | Maintains Option C, advisory. Shared script only hookable for .cjs surfaces; .md workflows can't cleanly call it. | bin/nf-solve.cjs:1664, :2181, commands/nf/progress.md:1, core/workflows/close-formal-gaps.md:14 |
| copilot-1 | Revised to Option C, advisory. Deploy solve+progress nudges first; shared .cjs for script surfaces later. Fix residual=-1 for DIAG-02. Optional --require-baselines for CI. | .planning/STATE.md:52-55, DIAG-02 |

## Outcome
Consensus on **Option C, advisory** after 3 rounds. Key evolution:
- Round 1: Split between B and C, with blocking vs advisory also unresolved
- Round 2: Blocking/advisory resolved (both advisory), but B vs C still split
- Round 3: copilot-1 revised to C after codex-1's argument that .md workflow docs aren't clean script surfaces

Consensus answer includes these refinements from copilot-1:
1. Make nf-solve emit residual=-1 (not silently skip) when baselines missing — fixes DIAG-02 false convergence
2. Provide optional --require-baselines flag for CI pipelines that want blocking behavior
3. Shared check-baselines.cjs can be added later for .cjs command surfaces (formal-test-sync, nf-solve) as a follow-up
