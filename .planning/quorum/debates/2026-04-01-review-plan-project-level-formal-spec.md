# Quorum Debate
Question: Review the plan at .planning/quick/369-implement-project-level-formal-spec-disc/369-PLAN.md for quality, completeness, and potential issues.
Date: 2026-04-01
Consensus: APPROVE
Rounds: 1

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude (ADVISORY) | APPROVE w/ suggestions: sh in ALLOWED_COMMANDS allows bypass; no concurrent manifest read test; spawnSync array args safe by design | .planning/quick/369-implement-project-level-formal-spec-disc/369-PLAN.md |
| codex-1 (primary) | UNAVAIL (file not written) | — |
| gemini-1 (primary) | UNAVAIL (timed out) | — |
| opencode-1 (T1 fallback) | UNAVAIL (file not written) | — |
| copilot-1 (T1 fallback) | Plan well-scoped but needs tightening: ALLOWED_COMMANDS too permissive, canonicalize spec_path, unify manifest path resolution, add timeout/signal tests | .planning/quick/369-implement-project-level-formal-spec-disc/369-PLAN.md, bin/run-formal-check.cjs, bin/formal-scope-scan.cjs |

## Outcome
Consensus reached in Round 1 with 1 valid external voter (copilot-1). Key revisions needed before execution:
1. Tighten ALLOWED_COMMANDS — remove `sh`, add argument guards for `-c`/`-e` flags
2. Canonicalize spec_path with realpath, enforce containment in PROJECT_SPECS_DIR
3. Unify manifest path resolution (ROOT vs process.cwd())
4. Add missing test cases: path traversal, malformed manifests, timeout/signal errors, registry collision warnings
5. Add key normalization and collision logging in registry merge
