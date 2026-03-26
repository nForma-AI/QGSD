---
task_id: 359
description: "Close the gap: when formal-scope-scan finds no matching modules, allow planner to declare formal_artifacts: create"
mode: quick-full
formal_artifacts: none
must_haves:
  truths:
    - "When FORMAL_SPEC_CONTEXT is empty, planner prompt includes guidance to evaluate whether the task warrants a new formal model"
    - "Planner can declare formal_artifacts: create even when no existing modules matched"
    - "Plan checker validates formal_artifacts: create declarations from empty FORMAL_SPEC_CONTEXT"
    - "Verifier does not skip formal artifact syntax checks when plan declared create but FORMAL_SPEC_CONTEXT was empty"
  artifacts:
    - "core/workflows/quick.md — updated planner formal_context for empty FORMAL_SPEC_CONTEXT"
    - "core/workflows/quick.md — updated checker formal_context for empty FORMAL_SPEC_CONTEXT"
    - "core/workflows/quick.md — updated verifier formal_context for empty FORMAL_SPEC_CONTEXT"
  key_links:
    - "core/workflows/quick.md:313 — planner formal_context empty branch"
    - "core/workflows/quick.md:388 — checker formal_context empty branch"
    - "core/workflows/quick.md:891 — verifier formal_context empty branch"
---

# Quick Task 359: Allow formal_artifacts: create when scope-scan returns empty

## Problem

When `formal-scope-scan.cjs` finds no matching modules for a task, the quick workflow unconditionally tells the planner: "Declare `formal_artifacts: none`." This means tasks that introduce genuinely new formal-model-worthy logic (new state machines, new invariants, new verification properties) can never bootstrap a formal model — the planner is forbidden from doing so.

The executor already handles `formal_artifacts: create` correctly (line 731). The gap is only in the planner/checker/verifier prompts.

## Tasks

### Task 1: Update planner formal_context for empty FORMAL_SPEC_CONTEXT

**files:** `core/workflows/quick.md`, `~/.claude/nf/workflows/quick.md`
**action:** Change the empty-branch text at line ~313 from unconditionally declaring `formal_artifacts: none` to guiding the planner to evaluate whether the task warrants a new formal model. The planner should consider: does this task introduce logic with 3+ states and transitions? Does it add invariants or properties that should be formally verified? If yes, declare `formal_artifacts: create`. If no, declare `formal_artifacts: none`.
**verify:** Read the updated workflow and confirm the empty-branch text includes the evaluation guidance and allows `create`.
**done:** The planner prompt no longer forces `none` when scope-scan is empty.

### Task 2: Update checker and verifier formal_context for consistency

**files:** `core/workflows/quick.md`, `~/.claude/nf/workflows/quick.md`
**action:**
- Checker (line ~388): When FORMAL_SPEC_CONTEXT is empty, the checker should validate `formal_artifacts` declarations including `create` (not just enforce `none`). If `create` is declared, check that file paths and types are well-specified.
- Verifier (line ~891): When FORMAL_SPEC_CONTEXT is empty but plan declared `formal_artifacts: create`, the verifier should still check that created formal files are syntactically reasonable — do not skip formal artifact checks just because scope-scan was empty.
- Step 6.3 formal check (line ~809-853): When FORMAL_SPEC_CONTEXT is empty but plan declared `formal_artifacts: create`, run formal check on the newly created modules (extract module names from the plan's create list).
**verify:** Read the updated checker and verifier sections, confirm they handle `create` from empty context.
**done:** Checker validates create declarations; verifier checks created artifacts; formal check runs on new modules.

### Task 3: Sync installed workflow copy

**files:** `~/.claude/nf/workflows/quick.md`
**action:** Copy `core/workflows/quick.md` to `~/.claude/nf/workflows/quick.md` to sync the installed copy.
**verify:** `diff core/workflows/quick.md ~/.claude/nf/workflows/quick.md` returns no differences.
**done:** Installed copy matches repo source.
