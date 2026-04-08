---
phase: quick-384
plan: 01
subsystem: commands/nf
tags: [mcp-repair, orchestrator, direct-calls, task-sub-agent]
dependency_graph:
  requires: []
  provides: [nf:mcp-repair direct MCP tool calls]
  affects: [commands/nf/mcp-repair.md]
tech_stack:
  added: []
  patterns: [direct orchestrator MCP tool calls instead of Task() sub-agent delegation]
key_files:
  created: []
  modified:
    - commands/nf/mcp-repair.md
decisions:
  - MCP identity/health_check/deep_health_check calls must be issued directly in the orchestrator — never inside Task() sub-agents which lack access to the parent session's MCP servers
metrics:
  duration: ~5m
  completed: 2026-04-08
---

# Quick Task 384: Fix nf:mcp-repair to call MCP tools directly instead of via sub-agents

## One-liner

Replaced all three Task() sub-agent MCP call sites in nf:mcp-repair with sequential direct orchestrator tool calls, removed Task from allowed-tools, and corrected the success_criteria to reflect the direct-call pattern.

## What Changed

### Site 1 — Step 1 (Initial before-state collection)

Removed the entire `Task(subagent_type: "general-purpose", model: "claude-haiku-4-5", ...)` block that collected identity/health_check/deep_health_check results for all 10 slots. Replaced with explicit inline instructions to call all 30 MCP tools directly in the orchestrator, one at a time sequentially, assembling `$BEFORE_STATE` as they complete.

### Site 2 — Step 4 (Service auto-start deep_health_check re-verify)

Removed the Task() block used to call `mcp__<slot>__deep_health_check({})` after service restart. Replaced with: "Call mcp__<slot>__deep_health_check({}) directly and record the result."

### Site 3 — Step 6 (Post-repair after-state collection)

Replaced "using a Task() sub-agent (same pattern as Step 1)" with "call identity, health_check, and deep_health_check directly on ONLY the repaired slots (same sequential direct-call pattern as Step 1)."

### Frontmatter change

Removed `- Task` from `allowed-tools:` list — Task is no longer needed for MCP data collection.

### success_criteria correction

Removed: `- Task() sub-agent pattern used for MCP tool calls (keeps raw output out of conversation)`
Added: `- MCP tool calls issued directly in the orchestrator (not via Task() sub-agents, which lack MCP server access)`

## Root Cause

Sub-agents spawned via the Agent/Task tool do not inherit the parent session's MCP servers. Every `mcp__*__identity`, `mcp__*__health_check`, and `mcp__*__deep_health_check` call issued inside a Task() silently fails or throws "tool not found". The fix is to issue all MCP calls directly in the main conversation where MCP servers are accessible.

## Verification Results

```
grep -n "Task(" commands/nf/mcp-repair.md
→ Line 434 only: "- MCP tool calls issued directly in the orchestrator (not via Task() sub-agents...)"
  (Explanatory text only — no Task() invocation blocks remain)

grep -n "subagent_type" commands/nf/mcp-repair.md
→ (empty — all sub-agent blocks removed)

grep -c "mcp__.*__identity" commands/nf/mcp-repair.md
→ 21 (>= 10 required — all direct call references present)

grep -n "^  - Task$" commands/nf/mcp-repair.md
→ (empty — Task removed from allowed-tools)

Step headings: Step 1 through Step 7 all present, step numbering unchanged
```

## Formal Coverage

No formal model intersections detected (exit 2 — not in scope).

## Commit

758b4b32 — fix(quick-384): replace Task() sub-agent MCP calls with direct orchestrator calls in nf:mcp-repair

## Self-Check

- [x] commands/nf/mcp-repair.md modified — confirmed
- [x] Commit 758b4b32 — confirmed
- [x] No Task() invocation blocks in file — confirmed
- [x] 21 direct identity call references — confirmed
- [x] Task removed from allowed-tools — confirmed
