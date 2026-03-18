---
phase: quick-326
plan: 01
subsystem: workflows
tags: [fsm, solve-diagnose, close-formal-gaps, heuristics, detection]
key-files:
  modified:
    - commands/nf/solve-diagnose.md
    - core/workflows/close-formal-gaps.md
decisions:
  - Fail-open heuristics: missing heatmap file, grep errors, or absent files are all silently skipped
  - Enum-string heuristic documented as producing possible false positives (grep count cannot prove single-variable usage)
  - jq shell command used to extract file list rather than reading 3MB JSON into agent context
  - uncovered_hot_zones field used (not top_files) for heatmap source, consistent with existing artifact schema
  - core/workflows/close-formal-gaps.md is durable repo source; propagation to installed location requires manual node bin/install.js --claude --global
metrics:
  duration: ~3 min
  completed: 2026-03-18
  tasks: 2
  files_modified: 2
---

# Quick Task 326: Add implicit state machine detection to solve-diagnose and close-formal-gaps

**One-liner:** Implicit FSM detection via multi-flag boolean and enum-string heuristics added to solve-diagnose Step 1 and close-formal-gaps detect_gaps, surfacing ad-hoc state machines before they reach formal modeling.

## Summary

Two nForma workflows now detect implicit state machine patterns in hot-zone files before they need to be formally modeled:

- `commands/nf/solve-diagnose.md` — new "Implicit State Machine Detection" subsection at the end of Step 1, scanning the top 10 git churn heatmap files using two heuristics and storing results as `fsm_candidates` in the solve context and output_contract.
- `core/workflows/close-formal-gaps.md` — new "Implicit FSM Gap Detection" subsection in the `detect_gaps` step (Step 1), running the same heuristics and presenting candidates alongside uncovered requirements with a `fsm-to-tla.cjs --scaffold-config` recommendation.

## What Changed

### commands/nf/solve-diagnose.md

Added `### Implicit State Machine Detection` subsection after the Issue Classification block (end of `<process>`). It:

1. Extracts the top 10 code files from `.planning/formal/evidence/git-heatmap.json` using `uncovered_hot_zones[].file` via a `jq` shell command (avoids loading the 3MB JSON into agent context).
2. Runs **Heuristic A** — multi-flag boolean cluster: greps for boolean variable declarations matching state-indicator suffixes (Pending, Active, Done, etc.); ≥3 matches in a file = FSM candidate with reason `multi-flag-boolean`.
3. Runs **Heuristic B** — enum-like string state variable: greps for `===\s*['"][A-Z_]` and `case '[A-Z_]` patterns; ≥3 matches = FSM candidate with reason `enum-string-state` (documented as potentially producing false positives).
4. Both heuristics are fail-open: missing heatmap, grep errors, or absent files are skipped silently.
5. Logs a summary and per-candidate detail line.
6. Stores results as `fsm_candidates` in the solve context.

Also added `"fsm_candidates": []` to the `<output_contract>` JSON schema as a sibling of `"issues"`.

### core/workflows/close-formal-gaps.md

Added `### Implicit FSM Gap Detection` subsection in the `<step name="detect_gaps">` block, after the category-selection paragraph and before the `**Bug context parsing (MRF-01):**` block. It:

1. Extracts top 10 code files from the same heatmap artifact via the same `jq` shell command.
2. Runs the same two heuristics (grep counts, same thresholds).
3. If implicit FSM gaps found: appends a formatted table to the coverage gap summary with a `node bin/fsm-to-tla.cjs --scaffold-config` recommendation.
4. In `--batch` mode: logs candidates without pausing. In interactive mode: presents alongside uncovered requirements.
5. Entire step is fail-open: missing heatmap skips silently.

## Verification

Commands run and their output:

```
$ grep -n "fsm_candidates" commands/nf/solve-diagnose.md
50:  "fsm_candidates": [], /* implicit FSM candidates from heatmap scan */
274:Store the candidates array as `fsm_candidates` in the solve context.

$ grep -n "Implicit FSM" core/workflows/close-formal-gaps.md
47:### Implicit FSM Gap Detection
67:Implicit FSM Candidates (may not yet have a formal model)

$ grep -n "fsm-to-tla" core/workflows/close-formal-gaps.md
72:Recommended action: run `node bin/fsm-to-tla.cjs --scaffold-config` to generate

$ grep -n "uncovered_hot_zones" core/workflows/close-formal-gaps.md
51:**File source:** Extract the top 10 code files from `.planning/formal/evidence/git-heatmap.json` using the `uncovered_hot_zones` array (sorted by `priority` descending). ...
53:jq -r '[.uncovered_hot_zones[] | ...] | ...' .planning/formal/evidence/git-heatmap.json | head -10
```

All verification criteria from the plan pass:
1. `fsm_candidates` appears in both the process section and output_contract in solve-diagnose.md (2 matches).
2. "Implicit FSM" appears in detect_gaps step of close-formal-gaps.md.
3. `fsm-to-tla` scaffold suggestion present in close-formal-gaps.md.
4. `uncovered_hot_zones` field referenced (not `top_files`).
5. Both heuristics documented as fail-open.

## Self-Check: PASSED

- `commands/nf/solve-diagnose.md` — modified, verified present
- `core/workflows/close-formal-gaps.md` — modified, verified present
- Task 1 commit: beb0710e
- Task 2 commit: a9482dcf
