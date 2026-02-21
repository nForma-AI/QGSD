---
phase: quick-37
plan: 37
subsystem: workflow-orchestration
tags: [quorum, refactor, workflow, orchestration, thin-orchestrator]
dependency_graph:
  requires: [qgsd-quorum-orchestrator agent (quick-20)]
  provides: [thin orchestrators across all 6 quorum sites]
  affects: [quick.md, execute-phase.md, plan-phase.md, discuss-phase.md, map-codebase.md]
tech_stack:
  added: []
  patterns: [Task(subagent_type=qgsd-quorum-orchestrator), claude_vote+artifact prompt structure, quorum_result routing]
key_files:
  modified:
    - get-shit-done/workflows/quick.md
    - get-shit-done/workflows/execute-phase.md
    - get-shit-done/workflows/plan-phase.md
    - get-shit-done/workflows/discuss-phase.md
    - get-shit-done/workflows/map-codebase.md
decisions:
  - "APPROVE/BLOCK framing standardized across all sites (replaces RESOLVED/UNRESOLVABLE in execute-phase and quick human_needed loops)"
  - "discuss-phase r4_pre_filter spawns one sub-agent per question sequentially — preserves R3.2 sequential constraint at the orchestrator level"
  - "plan-phase.md Step 8.5 activity-set locked to round 1 (quorum_round counter no longer applicable since sub-agent handles rounds internally)"
  - "Installed files at ~/.claude/qgsd/workflows/ kept in sync with repo source files"
metrics:
  duration: "6 min"
  completed: "2026-02-21"
  tasks: 3
  files: 5
---

# Phase quick-37: Refactor Inline Quorum Model Loops in 6 Workflow Sites — Summary

**One-liner:** Replaced all 6 inline Codex/Gemini/OpenCode/Copilot loops across 5 workflow files with Task(qgsd-quorum-orchestrator) sub-agent spawns, keeping orchestrators thin per GSD's core design principle.

## What Was Built

All 6 quorum enforcement sites across the QGSD workflow orchestrators now delegate quorum mechanics to the `qgsd-quorum-orchestrator` sub-agent instead of running model calls inline. Each site:

1. Forms Claude's vote first (claude_vote)
2. Spawns `Task(subagent_type="qgsd-quorum-orchestrator")` with the vote + artifact
3. Reads `quorum_result` (APPROVED/BLOCKED/ESCALATED)
4. Routes and writes `<!-- GSD_DECISION -->` itself on APPROVED

This moves sequential model calls, deliberation rounds, R3.6 improvement iterations, and scoreboard updates into the sub-agent's isolated context — not the orchestrator's.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Replace Step 5.7 and Step 6.5 in quick.md | fd44b28 |
| 2 | Replace verify_phase_goal in execute-phase.md + Step 8.5 in plan-phase.md | 98dfc47 |
| 3 | Replace r4_pre_filter in discuss-phase.md + quorum_validate in map-codebase.md | 4200c40 |

## Sites Replaced (6 total across 5 files)

| File | Site | Old Pattern | New Pattern |
|------|------|-------------|-------------|
| quick.md | Step 5.7 | Sequential mcp__ calls with APPROVE/BLOCK | Task(qgsd-quorum-orchestrator) |
| quick.md | Step 6.5 human_needed | Sequential mcp__ calls with RESOLVED/UNRESOLVABLE | Task(qgsd-quorum-orchestrator) with APPROVE/BLOCK |
| execute-phase.md | verify_phase_goal human_needed | Sequential mcp__ calls with RESOLVED/UNRESOLVABLE | Task(qgsd-quorum-orchestrator) with APPROVE/BLOCK |
| plan-phase.md | Step 8.5 | Inline R3.2-R3.3 loop with rounds counter | Task(qgsd-quorum-orchestrator) |
| discuss-phase.md | r4_pre_filter | Sequential mcp__ per question with CONSENSUS-READY/USER-INPUT-NEEDED | Task per question with APPROVE/BLOCK |
| map-codebase.md | quorum_validate | Sequential mcp__ calls with APPROVED/ISSUES | Task(qgsd-quorum-orchestrator) with APPROVE/BLOCK |

## Deviations from Plan

None — plan executed exactly as written. The only implementation note: workflow source files are in `get-shit-done/workflows/` (the git-tracked location) with installed copies at `~/.claude/qgsd/workflows/` kept in sync manually, consistent with project convention.

## Decisions Made

- **APPROVE/BLOCK framing unified** — the execute-phase and quick human_needed loops used RESOLVED/UNRESOLVABLE; these were updated to APPROVE/BLOCK to match the quorum-orchestrator's expected vocabulary.
- **discuss-phase: one sub-agent spawn per question** — preserves the sequential constraint from R3.2 at the orchestrator level. The sub-agent handles its own deliberation rounds internally.
- **plan-phase activity-set** — `quorum_round` counter hardcoded to 1 since the sub-agent manages rounds; the orchestrator no longer tracks round state.

## Self-Check: PASSED

Files verified on disk:
- get-shit-done/workflows/quick.md: contains 2x `subagent_type="qgsd-quorum-orchestrator"`, 2x `claude_vote:`, 2x `quorum_result`, 1x `GSD_DECISION`, 0x inline mcp__ calls
- get-shit-done/workflows/execute-phase.md: contains 1x sub-agent spawn, 1x `quorum_result`, 0x inline mcp__ calls
- get-shit-done/workflows/plan-phase.md: contains 1x sub-agent spawn, 1x `GSD_DECISION`, 1x `quorum_result`, 0x inline mcp__ calls
- get-shit-done/workflows/discuss-phase.md: contains 1x sub-agent spawn (per question pattern), 1x `quorum_result`, 0x inline mcp__ calls
- get-shit-done/workflows/map-codebase.md: contains 1x sub-agent spawn, 1x `quorum_result`, 1x `Fail-open`, 0x inline mcp__ calls

Commits verified:
- fd44b28, 98dfc47, 4200c40 all present in git log
