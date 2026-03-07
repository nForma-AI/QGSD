# Quorum Debate
Question: Which approach for keeping TUI screenshots up-to-date: Option A (CI-only staleness check) or Option B (targeted pre-commit hook)?
Date: 2026-03-07
Consensus: APPROVE
Rounds: 3

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude | Option A — CI check is zero friction, catches drift at PR review time, simpler | — |
| codex-1 | UNAVAIL (timeout) | — |
| gemini-1 (T1 fallback) | UNAVAIL (quota exhausted) | — |
| opencode-1 (T1 fallback) | Option B — proactive, matches project's hook-based patterns | — |

## Round 2
| Model | Position | Citations |
|---|---|---|
| Claude | Option A — CI check simpler, pre-commit hooks that auto-stage are fragile | hooks/nf-prompt.js, hooks/nf-circuit-breaker.js |
| opencode-1 | Option B — holds; CI-only introduces friction by failing builds without auto-resolution | .planning/STATE.md:87, bin/nForma.cjs:58-59 |

## Round 3
| Model | Position | Citations |
|---|---|---|
| Claude | Option A — project uses Claude Code hooks not git hooks; git pre-commit would be new pattern | hooks/nf-prompt.js, hooks/nf-circuit-breaker.js, hooks/nf-spec-regen.js |
| opencode-1 | Option A — agrees; git pre-commit breaks established patterns, CI check matches validation approach | .planning/STATE.md:87, bin/nForma.cjs:58-59 |

## Outcome
Consensus on Option A: implement a CI staleness check script (`bin/check-tui-assets-stale.cjs`) that regenerates SVGs to a temp directory, diffs against `docs/assets/`, and exits 1 if stale. Add to `test:ci`. Key insight from deliberation: the project uses Claude Code hooks (PreToolUse, PostToolUse, UserPromptSubmit), not git hooks — adding a git pre-commit hook would introduce a new pattern inconsistent with the codebase.
