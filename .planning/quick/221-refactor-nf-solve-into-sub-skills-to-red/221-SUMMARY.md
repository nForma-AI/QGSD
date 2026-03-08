---
phase: quick-221
plan: 01
subsystem: solve-orchestration
tags: [refactor, context-reduction, sub-skills, solve]
dependency-graph:
  requires: []
  provides: [solve-diagnose-sub-skill, solve-remediate-sub-skill, solve-report-sub-skill, solve-thin-orchestrator]
  affects: [nf-solve-workflow]
tech-stack:
  added: []
  patterns: [agent-dispatch-sub-skills, structured-json-contracts, phase-based-decomposition]
key-files:
  created:
    - commands/nf/solve-diagnose.md
    - commands/nf/solve-remediate.md
    - commands/nf/solve-report.md
  modified:
    - commands/nf/solve.md
decisions:
  - Operational frontmatter only for sub-skills (not full skill routing) since they are Agent-dispatched internally
  - Constraints 4, 5, 8 placed in solve-remediate.md; constraints 1, 2, 3, 6, 7 kept in orchestrator
  - Sub-skills use structured JSON status field (ok/bail/error) for orchestrator branching
metrics:
  duration: 8min
  completed: 2026-03-08
---

# Quick 221: Refactor nf:solve into Sub-Skills Summary

Decomposed monolithic solve.md (971 lines) into 3 Agent-dispatched sub-skills plus a thin orchestrator (107 lines), reducing per-invocation context load by 75-90% depending on which phase executes.

## What Changed

**Task 1: solve-diagnose.md (247 lines)** -- Extracted Steps 0-1: legacy migration, config audit, observe target loading, inline observe refresh, debt load, initial diagnostic sweep, git churn heatmap, and issue classification. Includes JSON output contract with structured status field for bail/error signaling.

**Task 2: solve-remediate.md (568 lines) + solve-report.md (219 lines)** -- Extracted all 13 remediation dispatches (3a-3m) into solve-remediate with Agent-per-layer isolation pattern and input/output JSON contracts. Extracted Steps 6-8 (before/after table, formal verification detail, post-convergence actions) into solve-report as display-only sub-skill. Relevant constraints distributed to each sub-skill.

**Task 3: solve.md thin orchestrator (107 lines)** -- Rewrote as dispatch table with 4 phases: Diagnose, Report-Only Gate, Remediate (convergence loop), Report. Retains Steps 4-5 (re-diagnostic sweep and convergence check) and debt resolution. Reads structured status from each sub-skill to branch on ok/bail/error.

## Line Count Summary

| File | Lines | Content |
|------|-------|---------|
| solve.md (orchestrator) | 107 | Dispatch logic, convergence loop, report-only gate |
| solve-diagnose.md | 247 | Steps 0-1: migration, config, observe, diagnostics |
| solve-remediate.md | 568 | Steps 3a-3m: all 13 remediation dispatches |
| solve-report.md | 219 | Steps 6-8: tables, verification detail, post-actions |
| **Total** | **1141** | vs. original 971 (overhead from frontmatter + contracts) |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | caa866e5 | Create solve-diagnose.md sub-skill (Steps 0-1) |
| 2 | 58975828 | Create solve-remediate.md and solve-report.md sub-skills |
| 3 | e281ec29 | Rewrite solve.md as thin orchestrator (971 -> 107 lines) |

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED
