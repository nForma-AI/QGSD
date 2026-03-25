# Quick Task 355: Auto-invoke nf:resolve after solve finishes iterating

## What Changed

Added Phase 6 (Auto-Resolve) to `commands/nf/solve.md` — a post-process handoff that invokes `/nf:resolve` after solve's autonomous phases complete.

## Changes

### commands/nf/solve.md
- Added `Skill` to `allowed-tools` frontmatter
- Updated objective to mention Phase 6 handoff
- Added "POST-PROCESS HANDOFF" section to execution_context clarifying that Phase 6 is interactive but doesn't violate solve's autonomy contract
- Inserted Phase 6 between Phase 5 (Auto-Commit) and Important Constraints:
  - Skip conditions: `--report-only`, `--plan-only`, zero post_residual, zero baseline
  - Invokes `Skill(nf:resolve, args="--source solve --limit 20")`
  - Fail-open: errors logged, not fatal
  - Log messages for both invoke and skip paths

### Install sync
- Copied updated solve.md to `~/.claude/commands/nf/solve.md`

## Design Decisions

- **Skill tool (not Agent)** — resolve is conversational (uses AskUserQuestion), so it must run in the main conversation context via Skill, not in an Agent subprocess
- **Post-process handoff pattern** — Phases 1-5 run fully autonomously per solve's contract; Phase 6 transitions to interactive mode only after all autonomous work is done
- **--source solve --limit 20** — focuses resolve on solve items only (not pairings/orphans) with a reasonable batch size
- **Codex-1 feedback incorporated** — REJECT noted autonomy contract concern; addressed by clearly separating Phase 6 as post-process handoff with explicit documentation in execution_context

## Commit
- `72a9a6d8` — feat(quick-355): auto-invoke nf:resolve after solve finishes iterating
