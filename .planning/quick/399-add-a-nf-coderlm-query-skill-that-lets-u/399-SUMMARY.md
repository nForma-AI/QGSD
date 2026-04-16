---
phase: 399-coderlm-query-skill
plan: "01"
subsystem: commands
tags: [coderlm, skill, query, symbol-server]
dependency_graph:
  requires: [bin/coderlm-adapter.cjs, bin/coderlm-lifecycle.cjs]
  provides: [commands/nf/coderlm.md query subcommands]
  affects: [nf:coderlm skill]
tech_stack:
  added: []
  patterns: [heredoc-node-invocation, env-var-argument-passing, fail-open-error-handling]
key_files:
  modified: [commands/nf/coderlm.md]
decisions:
  - "Used heredoc form for node invocations (NF_EVAL) to avoid nf-node-eval-guard hook blocking"
  - "Arguments passed via environment variables rather than process.argv to work with heredoc form"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-16"
  tasks_completed: 1
  files_modified: 1
---

# Phase 399 Plan 01: Add /nf:coderlm Query Skill Summary

**One-liner:** Extended coderlm skill with four query subcommands (callers, implementation, tests, peek) using heredoc node invocations and environment variable argument passing.

## What Was Built

`commands/nf/coderlm.md` extended with four new query subcommands that expose the coderlm adapter API through a first-class skill interface:

- **callers** — list all callers of a symbol (optional file scope narrowing)
- **implementation** — show file + line number where a symbol is defined
- **tests** — list test files associated with a source file
- **peek** — display source lines from a file by line range

All query subcommands include:
- An ensure-running preamble that calls `coderlm-lifecycle.cjs --start` before executing
- Node invocations via heredoc form (`node << 'NF_EVAL'`) with arguments passed via env vars
- Formatted output templates for success cases
- Error handling with diagnostic hints (`/nf:coderlm status`) for failures
- Empty result handling with informative messages

Frontmatter updated: `argument-hint` and `description` now reflect all eight subcommands.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add query subcommands to coderlm.md | 3d9a765b |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written, with one planned adaptation.

### Planned Adaptation (per constraints)

The plan specified `node -e "..."` one-liners for the Node invocations. Per the constraint in the task prompt, these were written as heredoc form (`node << 'NF_EVAL'`) with arguments passed via environment variables, to avoid the `nf-node-eval-guard` hook blocking them at skill execution time. This is the correct implementation approach.

## Formal Modeling

### Formal Coverage Intersect
- **Changed files:** `commands/nf/coderlm.md`
- **Intersections found:** None — no formal modules affected

### Loop 2 Simulation
- **Status:** Not applicable (no formal coverage intersections)

## Verification Results

1. `grep "argument-hint"` includes `callers|implementation|tests|peek` — PASS
2. `grep -c "coderlm-adapter"` returns 5 (>= 4) — PASS
3. `grep "coderlm-lifecycle.cjs --start"` confirms ensure-running preamble present — PASS
4. `grep -c "result.error"` returns 4 — PASS
5. Existing subcommands (start/stop/status/update) still present — PASS

## Self-Check

- commands/nf/coderlm.md: FOUND
- Commit 3d9a765b: FOUND
