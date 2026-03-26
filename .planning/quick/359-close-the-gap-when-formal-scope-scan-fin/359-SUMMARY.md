---
task_id: 359
phase: quick
subsystem: formal-bootstrapping
date_completed: 2026-03-26
duration: ~5 min
status: completed
key_changes:
  - Updated planner prompt to allow formal_artifacts: create when scope-scan is empty
  - Updated checker prompt to validate create declarations from empty context
  - Updated verifier prompt to check created artifacts even when scope-scan was empty
  - Synced installed workflow copy to repo source
tags:
  - formal-modeling
  - workflow-fix
  - gap-closure
tech_stack:
  - modified: core/workflows/quick.md
  - synced: ~/.claude/nf/workflows/quick.md
decisions:
  - "Allow planner to evaluate new formal model candidates when scope-scan is empty"
  - "Checker validates both none and create declarations from empty context"
  - "Verifier performs syntax checks on newly created formal artifacts"
metrics:
  - Files modified: 1 (core/workflows/quick.md)
  - Lines changed: ~30
---

# Quick Task 359: Close Formal Model Bootstrapping Gap — Summary

## Objective

Enable quick workflow to support bootstrapping new formal models when `formal-scope-scan.cjs` finds no matching existing modules. Previously, the workflow unconditionally forced planners to declare `formal_artifacts: none` in this case, preventing tasks from creating genuinely new formal specifications.

## Problem Solved

The quick workflow had three gaps preventing formal model bootstrapping:

1. **Planner gap (line ~313):** When FORMAL_SPEC_CONTEXT was empty, the planner prompt stated: "Declare `formal_artifacts: none`" — forcing the decision rather than guiding evaluation.
2. **Checker gap (line ~388):** When FORMAL_SPEC_CONTEXT was empty, the checker only validated that `formal_artifacts: none` was declared — it couldn't validate `create` declarations.
3. **Verifier gap (line ~891):** When FORMAL_SPEC_CONTEXT was empty, the verifier skipped all formal checks, even if a plan had declared `formal_artifacts: create`.

These gaps prevented tasks like "add state machine X" or "formalize invariant Y" from declaring new formal models in their plans.

## Tasks Completed

### Task 1: Update planner formal_context for empty FORMAL_SPEC_CONTEXT

**File:** `core/workflows/quick.md` (line ~313)

**Change:** Replaced the unconditional directive with evaluation guidance:

```markdown
No existing formal modules matched this task. Evaluate whether this task introduces
logic that warrants a NEW formal model:
- Does it add logic with 3+ distinct states and conditional transitions?
  (state machine candidate)
- Does it introduce invariants or safety properties that should be formally verified?
- Does it add a new subsystem with correctness requirements?

If YES to any: declare `formal_artifacts: create` with specific file paths,
types (tla|alloy|prism), and descriptions.
If NO: declare `formal_artifacts: none`.

The `formal_artifacts:` field is REQUIRED in plan frontmatter regardless
of FORMAL_SPEC_CONTEXT.
```

**Verification:** Planner prompt now guides evaluation rather than forcing `none`.

### Task 2: Update checker formal_context for empty FORMAL_SPEC_CONTEXT

**File:** `core/workflows/quick.md` (line ~388)

**Change:** Replaced the one-way validation with dual-path logic:

```markdown
No formal modules matched. If plan declares formal_artifacts: none, that is valid.
If plan declares formal_artifacts: create, validate that file paths and types
are well-specified.
```

**Verification:** Checker now validates both `none` and `create` declarations.

### Task 3: Update verifier formal_context for empty FORMAL_SPEC_CONTEXT

**File:** `core/workflows/quick.md` (line ~891)

**Change:** Replaced the skip-all directive with conditional checks:

```markdown
No existing formal modules matched. If plan declared formal_artifacts: create,
verify the created .planning/formal/ files are syntactically reasonable for
their type. If plan declared formal_artifacts: none, skip formal invariant checks.
```

**Verification:** Verifier now performs syntax checks on newly created artifacts.

### Task 4: Sync installed workflow copy

**Files:**
- Source: `core/workflows/quick.md`
- Installed: `~/.claude/nf/workflows/quick.md`

**Change:** Copied the updated workflow to the installed location.

**Verification:** `diff core/workflows/quick.md ~/.claude/nf/workflows/quick.md` returns no differences.

## Must-Haves Verification

| Truth | Status | Evidence |
|-------|--------|----------|
| Planner prompt includes evaluation guidance | ✓ | Line 313-325: evaluation questions + decision logic |
| Planner can declare `formal_artifacts: create` | ✓ | Guidance explicitly names `create` as option |
| Checker validates `create` from empty context | ✓ | Line 396: dual-path validation for none and create |
| Verifier checks created artifacts | ✓ | Line 899-900: conditional syntax check for created files |
| Installed copy synced to repo source | ✓ | `diff` verification passed |

## Deviations from Plan

None — plan executed exactly as specified.

## Blockers/Issues

None.

## Impact

The formal model bootstrapping workflow is now fully functional:
- Tasks introducing new logic can now bootstrap formal specifications
- Three-stage validation (planner → checker → verifier) now supports `create` declarations
- Fail-open design preserved: unclear cases can still declare `none`
- No breaking changes to existing workflows

## Files Modified

- `/Users/jonathanborduas/code/QGSD/core/workflows/quick.md` (+30 lines of guidance text)
- `~/.claude/nf/workflows/quick.md` (synced copy)

## Session Notes

Quick task 359 closes a critical gap in the formal modeling infrastructure. The quick workflow now supports the full lifecycle of formal specification declarations: evaluation, validation, and verification — even when no existing modules match.

This enables future quick tasks to declare and implement new formal models for state machines, invariants, and verification properties without architectural resistance from the workflow constraints.
