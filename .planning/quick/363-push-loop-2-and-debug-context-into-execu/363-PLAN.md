---
task_id: 363
description: "Push Loop 2 and debug_context into execute-plan.md Pattern A spawn prompt"
formal_artifacts: none
---

# Plan: Push Loop 2 + debug_context into Pattern A

## Objective

Expand the Pattern A spawn prompt in `execute-plan.md` to include `<formal_coverage_auto_detection>` (Loop 2) and `<debug_context>` blocks, so the nested child nf-executor inherits both verification loops when committing.

## Must-Haves

1. Pattern A spawn prompt includes `<formal_coverage_auto_detection>` block with Loop 2 (solution-simulation-loop)
2. Pattern A spawn prompt includes conditional `<debug_context>` passthrough from parent context
3. Pattern B confirmed safe (orchestrator commits, not subagent) — no changes needed
4. Fail-open preserved on all new blocks
5. Sync repo source → installed copy

## Analysis

- **Pattern A** (line 121): Currently a one-liner prose description. Expand to include formal blocks in the prompt specification.
- **Pattern B** (line 123): Segment subagents do NOT commit — orchestrator (main context) commits. Orchestrator has Loop 2. **No change needed.**
- **Pattern C** (line 125): Executes in main context. Has Loop 2. **No change needed.**
- **Pattern D** (lines 130+): Worktree executors with minimal prompts. Opt-in only (--parallel flag). **Defer to separate task.**

## Tasks

### Task 1: Expand Pattern A spawn description to include formal blocks

Replace the Pattern A one-liner at line 121 with an expanded prompt specification that includes:
1. The existing instructions (execute plan, autonomous, all tasks, SUMMARY, commit, deviation/auth rules)
2. `<formal_coverage_auto_detection>` block (same as execute-phase.md lines 217-251)
3. `<debug_context>` passthrough: `${PARENT_DEBUG_CONTEXT || ''}` — the parent executor passes any debug_context it received from the orchestrator

Note: The parent nf-executor (spawned by execute-phase.md) receives `$DEBUG_CONSTRAINTS`, `$DEBUG_FORMAL_VERDICT`, `$DEBUG_REPRODUCING_MODEL` from the orchestrator's debug routing. When spawning the Pattern A child, the parent must forward these as a `<debug_context>` block in the child's prompt.

### Task 2: Sync to installed copy

```bash
cp core/workflows/execute-plan.md ~/.claude/nf/workflows/execute-plan.md
```
