---
phase: quick-400
plan: "01"
subsystem: commands
tags: [coderlm, intent-detection, ux, argument-parsing]
dependency_graph:
  requires: [399-add-a-nf-coderlm-query-skill]
  provides: [smart-arg-parsing-coderlm]
  affects: [commands/nf/coderlm.md]
tech_stack:
  added: []
  patterns: [heuristic-intent-detection, argument-shape-routing]
key_files:
  created: []
  modified:
    - commands/nf/coderlm.md
decisions:
  - "Rule 1 extension list limited to .js, .cjs, .mjs, .ts, .tsx, .json — .md files fall to Rule 5 (ambiguous) to avoid misclassifying doc files as test targets"
  - "Rule 5 defaults to Rule 4 (implementation+callers) with a note, keeping fail-open behavior"
  - "Rule 6 falls through to existing Step 1 help display, no new code path needed"
metrics:
  duration: "5m"
  completed: "2026-04-16"
  tasks_completed: 1
  files_modified: 1
---

# Phase quick-400 Plan 01: Add Smart Argument Parsing to /nf:coderlm Summary

**One-liner:** Heuristic intent detection (Step 1.5) added to /nf:coderlm — bare symbol names, file paths, and line ranges now auto-route to the correct subcommand without explicit subcommand syntax.

## What Was Built

Inserted **Step 1.5: Smart argument detection** between Step 1 (subcommand parse) and Step 2 (subcommand execute) in `commands/nf/coderlm.md`. The block fires only when the first argument is not a known explicit subcommand, using argument shape to resolve the intended operation.

Six rules cover all argument patterns:

| Rule | Trigger | Resolved subcommand |
|------|---------|---------------------|
| 1 | Single arg, looks like a file (has `/` or known extension) | `tests` |
| 2 | Two args, second looks like a file | `callers` |
| 3 | Three args: file + two integers | `peek` (with validation) |
| 4 | Single arg, does NOT look like a file | `implementation` + `callers` (combined) |
| 5 | Single arg, ambiguous (dot but no recognized extension) | Rule 4 + note |
| 6 | No args or unmatched | Fall through to Step 1 usage help |

Also updated the `argument-hint` frontmatter from `<start|stop|status|update|callers|implementation|tests|peek>` to `<subcommand | symbol | file | symbol file | file startLine endLine>`.

## Verification Results

1. `grep -n "Step 1.5"` — found at line 39
2. Step ordering: Step 1 (line 16) < Step 1.5 (line 39) < Step 2 (line 86)
3. `coderlm-lifecycle.cjs` reference count: 5 (unchanged)
4. `argument-hint` contains "symbol" and "file"
5. Combined output format block ("Implementation of") present at line 68

## Deviations from Plan

None — plan executed exactly as written.

The plan specified the Rule 1 extension list as "like .js, .cjs, .ts, .tsx, .md, .json" but per the quorum improvement constraint, the exhaustive list `.js, .cjs, .mjs, .ts, .tsx, .json` was used and `.md` files were excluded (falling to Rule 5 ambiguous treatment instead). This matches the constraint requirements.

## Formal Modeling

Not applicable (no formal intersections found — `formal-coverage-intersect.cjs` returned `intersections_found: false`).
