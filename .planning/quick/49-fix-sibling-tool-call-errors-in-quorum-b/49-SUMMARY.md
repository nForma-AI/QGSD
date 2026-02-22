---
phase: quick-49
plan: "01"
subsystem: quorum-command
tags: [quorum, sequential, sibling-calls, mcp, task-dispatch]
dependency_graph:
  requires: []
  provides: [sibling-call-safe quorum command]
  affects: [commands/qgsd/quorum.md]
tech_stack:
  added: []
  patterns: [sequential MCP tool calls, sequential Task dispatch]
key_files:
  created: []
  modified:
    - commands/qgsd/quorum.md
decisions:
  - "Task subagents must be dispatched sequentially (one per message turn) — sibling Task calls produce Sibling tool call errored propagation even though Tasks are isolated processes"
  - "Top-level enforcement block added before Provider pre-flight so the rule applies to ALL sections (identity, health_check, inference, and Task dispatch)"
metrics:
  duration: "50s"
  completed_date: "2026-02-22"
---

# Quick Task 49: Fix Sibling Tool Call Errors in Quorum — SUMMARY

**One-liner:** Eliminated all parallel/sibling dispatch instructions from quorum.md — added top-level sequential enforcement block, rewrote Mode B Task dispatch heading and rationale from parallel to sequential, relabeled dispatch trigger line.

## Objective

Fix sibling tool call errors in the quorum command by making all model calls explicitly sequential. When Claude Code executes multiple MCP tool calls or Task spawns as siblings (in the same message), a failure in one propagates "Sibling tool call errored" to all co-submitted calls. The quorum command must eliminate every instruction that could cause parallel/sibling dispatch.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Add top-level sequential enforcement rule and fix Mode B parallel dispatch | 81f3d02 | Done |

## Changes Made

### Task 1: commands/qgsd/quorum.md

**Change 1 — Sequential enforcement block added**

Inserted after `</mode_detection>` and before `### Provider pre-flight`:

```
> **SEQUENTIAL CALLS ONLY — NO SIBLING TOOL CALLS**
> Every MCP tool call and every Task spawn in this command MUST be issued as a
> separate, standalone message turn — never batched or co-submitted as sibling
> calls. This applies to identity checks, health checks, inference calls, and
> Task subagent dispatches.
```

**Change 2 — Mode B dispatch heading rewritten**

Old: `### Dispatch parallel quorum workers via Task`
New: `### Dispatch quorum workers via Task (sequential — one at a time)`

Old rationale: "Task subagents are isolated subprocesses — parallel dispatch is safe..."
New rationale: "Task subagents must be dispatched sequentially, one per message turn. Do NOT co-submit multiple Task calls in the same message..."

**Change 3 — Dispatch trigger label fixed**

Old: `Dispatch (single parallel message):`
New: `Dispatch (sequential — one Task per message turn):`

**Change 4 — Mode A verified**

Mode A "Query models (sequential)" section at line 142 already contained:
> each call MUST be a **separate, sequential tool call** (not sibling calls in the same message, per R3.2)

No change needed.

## Verification Results

```
parallel occurrences: (none)
SEQUENTIAL CALLS ONLY: line 35 ✓
sequential.*one Task: line 348 ✓
separate, sequential tool call: line 142 ✓
total sequential count: 9 (required >= 5) ✓
```

All "sibling", "co-submit", and "batched" references appear only in prohibition/warning context — no affirmative instructions to batch model calls remain.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `/Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md` modified and verified
- [x] Commit 81f3d02 exists and contains the quorum.md changes
- [x] All 4 grep checks pass
