---
task_id: 362
description: "Wire debug routing (Loop 1 + task classification + autoresearch-refine + debug_context injection) into execute-phase.md"
formal_artifacts: none
---

# Plan: Wire Debug Routing into execute-phase.md

## Objective

Add per-plan task classification and debug routing to `execute-phase.md` so that bug-fix plans get routed through `/nf:debug` (Loop 1 autoresearch-refine) before execution, with constraints injected into executor prompts — matching the `quick.md` Step 5.8 pattern.

## Must-Haves

1. Per-plan Haiku task classification (bug_fix/feature/refactor) in the execute_waves step, before spawning each executor
2. Debug routing: bug_fix plans (confidence >= 0.7) dispatched through `/nf:debug` before executor spawn
3. Debug context injection: `<debug_context>` block conditionally injected into executor prompt with constraints, verdict, and reproducing model
4. Fail-open: all new logic skips silently on Haiku unavailability, debug errors, or missing modules
5. Sync repo source → installed copy after edit

## Tasks

### Task 1: Add per-plan task classification to execute_waves step

In `core/workflows/execute-phase.md`, inside `<step name="execute_waves">`, add a classification sub-step BEFORE spawning executor agents (before item 2 "Spawn executor agents"). For each plan in the wave:

1. Read the plan's `<objective>` text
2. Spawn Haiku subagent to classify the plan objective as bug_fix/feature/refactor (same prompt as quick.md Step 2.7 sub-step 1.5)
3. Store `$PLAN_CLASSIFICATION` per plan
4. Fail-open: default to `{ type: "feature", confidence: 0.0 }` if Haiku unavailable

### Task 2: Add debug routing step between classification and executor spawn

Add a new sub-step after classification, before executor spawn:

1. **Skip if:** `$PLAN_CLASSIFICATION.type` is NOT `bug_fix`, OR confidence < 0.7
2. **If routing:** Spawn `/nf:debug` as Task subagent with the plan objective as failure context (same pattern as quick.md Step 5.8 item 2)
3. Parse debug output → extract `$DEBUG_CONSTRAINTS`, `$DEBUG_FORMAL_VERDICT`, `$DEBUG_REPRODUCING_MODEL`
4. Fail-open: on error, set all debug vars to null and continue

### Task 3: Inject debug_context block into executor prompt

Modify the executor Task spawn (item 2 in execute_waves) to conditionally include a `<debug_context>` block after the `</formal_coverage_auto_detection>` section:

```
${DEBUG_CONSTRAINTS || DEBUG_FORMAL_VERDICT || DEBUG_REPRODUCING_MODEL ?
`<debug_context>
This plan was routed through /nf:debug before execution...
</debug_context>` : ''}
```

Same template as quick.md lines 877-886.

### Task 4: Sync to installed copy

```bash
cp core/workflows/execute-phase.md ~/.claude/nf/workflows/execute-phase.md
```
