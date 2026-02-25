---
phase: quick-104
plan: "01"
subsystem: quorum-orchestration
tags: [quorum, dispatch, slot-worker, mode-a, mode-b]
dependency-graph:
  requires: [agents/qgsd-quorum-slot-worker.md]
  provides: [commands/qgsd/quorum.md normalized dispatch]
  affects: [quorum execution for both Mode A and Mode B]
tech-stack:
  added: []
  patterns: [parallel Task dispatch via subagent_type=qgsd-quorum-slot-worker, YAML argument blocks]
key-files:
  created: []
  modified:
    - commands/qgsd/quorum.md
decisions:
  - "Both Mode A and Mode B now use qgsd-quorum-slot-worker for all slot dispatch — canonical slot-calling mechanism throughout"
  - "Mode A deliberation rounds use prior_positions field in YAML block, not inline prompt templates"
  - "Worker prompt templates removed from quorum.md — slot-worker builds prompts from YAML arguments"
  - "Sequential call note updated: workers ARE parallel sibling Tasks per round; between-round Bash calls remain sequential"
metrics:
  duration: "1 min"
  completed: "2026-02-25"
  tasks: 2
  files: 1
---

# Quick Task 104: normalize quorum.md dispatch to qgsd-quorum-slot-worker in Mode A and Mode B Summary

Both Mode A and Mode B in quorum.md now dispatch slot workers exclusively via `Task(subagent_type="qgsd-quorum-slot-worker", ...)` with YAML argument blocks, replacing direct sequential MCP calls (Mode A) and `general-purpose` Tasks with inline bundle (Mode B).

## What Was Built

Normalized `commands/qgsd/quorum.md` so both quorum modes use the canonical `qgsd-quorum-slot-worker` agent for slot dispatch:

**Mode A — Pure Question:**
- Replaced "Query models (sequential)" section — was calling `mcp__codex-cli-1__review`, `mcp__gemini-cli-1__gemini`, `mcp__opencode-1__opencode`, `mcp__copilot-1__ask`, and `mcp__<serverName>__claude` directly
- Now: `Task(subagent_type="qgsd-quorum-slot-worker", description="<slotName> quorum R<N>", prompt=<YAML block>)` per active slot, dispatched as parallel sibling Tasks
- YAML block for Mode A: `slot`, `round`, `timeout_ms`, `repo_dir`, `mode: A`, `question`
- Deliberation rounds use same pattern + `prior_positions` field in YAML

**Mode B — Execution + Trace Review:**
- Replaced "Dispatch quorum workers via Task" section — was using `subagent_type="general-purpose"` instructing sub-agents to call MCP tools with full bundle inlined
- Now: `Task(subagent_type="qgsd-quorum-slot-worker", ...)` per active slot, dispatched as parallel sibling Tasks
- YAML block for Mode B: `slot`, `round`, `timeout_ms`, `repo_dir`, `mode: B`, `question`, `traces` (verbatim `$TRACES` content)
- Round 2+ deliberation also appends `prior_positions` field

**Removed:**
- Mode A prompt template block ("QGSD Quorum — Round 1 / You are one of the quorum members...")
- Mode B worker prompt template block ("QGSD Quorum — Execution Review / verdict: APPROVE | REJECT | FLAG...")
- Old "Each model is called sequentially (not as sibling calls)" note in Mode A deliberation section

## Verification

```
grep -c "subagent_type=\"qgsd-quorum-slot-worker\"" commands/qgsd/quorum.md  → 13
grep -c "subagent_type=\"general-purpose\"" commands/qgsd/quorum.md           → 0
grep -c "mcp__codex-cli-1__review|..." commands/qgsd/quorum.md               → 0
```

All success criteria met.

## Tasks Completed

| Task | Name | Commit |
|------|------|--------|
| 1 | Replace Mode A direct MCP calls with qgsd-quorum-slot-worker Tasks | d08e62f |
| 2 | Replace Mode B general-purpose Tasks with qgsd-quorum-slot-worker Tasks | fbf52a0 |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- commands/qgsd/quorum.md: FOUND
- 104-SUMMARY.md: FOUND
- Commit d08e62f (Task 1): FOUND
- Commit fbf52a0 (Task 2): FOUND
