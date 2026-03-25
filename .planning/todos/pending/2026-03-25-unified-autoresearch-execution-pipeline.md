---
created: 2026-03-25T08:43:31.249Z
title: Unified autoresearch execution pipeline
area: tooling
files:
  - commands/nf/model-driven-fix.md
  - commands/nf/solve-remediate.md
  - commands/nf/debug.md
  - core/workflows/quick.md
  - core/workflows/execute-plan.md
  - bin/autoresearch-refine.cjs
  - bin/solution-simulation-loop.cjs
---

## Problem

The two autoresearch loops (bug reproduction + solution simulation) are currently wired through `/nf:model-driven-fix` as a standalone skill. This creates architectural confusion:

- Loop 1 (bug reproduction via autoresearch-refine.cjs) is debugging work — it should live inside `/nf:debug`, not as a separate skill.
- Loop 2 (solution simulation via simulateSolutionLoop) is a pre-commit quality gate — it should fire during ANY code execution (`/nf:quick --full`, `/nf:execute-phase`), not only when model-driven-fix is explicitly invoked.
- `/nf:quick --full` for bug fixes should route through `/nf:debug` automatically, which would include Loop 1. Feature work skips Loop 1 but still gets Loop 2.

Current state: Both loops exist and work (quick-348, quick-350) but are only accessible via `/nf:model-driven-fix`.

## Solution

**Milestone: Unified Autoresearch Execution Pipeline**

### Phase 1: Smart task classification
- In quick.md Step 2.7, extend Haiku approach derivation to classify task as `bug_fix` | `feature` | `refactor`
- Bug fixes route through `/nf:debug` pipeline
- Features/refactors go normal execution path

### Phase 2: Fold model-driven-fix into /nf:debug
- Absorb Phases 1-4 of model-driven-fix into the debug skill
- Loop 1 (autoresearch-refine) becomes part of the debug flow
- Constraint extraction feeds back into the debug fix guidance
- Deprecate `/nf:model-driven-fix` as standalone

### Phase 3: Loop 2 as universal pre-commit gate
- Add solution simulation as a step in executor workflows (quick.md, execute-plan.md)
- Fires before atomic commit when formal models are in scope
- onTweakFix callback lets the executor refine approach if gates fail
- Configurable: always-on in `--full` mode, opt-in otherwise

### Phase 4: End-to-end wiring
- `/nf:quick --full "fix bug X"` → classify → debug (Loop 1) → fix → Loop 2 → commit
- `/nf:quick --full "add feature Y"` → classify → execute → Loop 2 → commit
- `/nf:execute-phase` → each task → Loop 2 pre-commit gate
- `/nf:debug` directly → Loop 1 → constraints → fix guidance

### Key architectural decisions needed:
- How does Loop 2 interact with the existing formal-coverage-intersect step in the executor?
- Should Loop 2 block the commit (fail-closed) or warn (fail-open)?
- What's the fallback when no formal models are in scope? (Skip Loop 2 silently?)
