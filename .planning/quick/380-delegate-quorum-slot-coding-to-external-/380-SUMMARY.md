---
phase: quick-380
plan: 01
subsystem: quorum-dispatch
tags: [coding-delegation, mode-c, quorum, external-agents]
dependency_graph:
  requires: [call-quorum-slot.cjs, providers.json, quorum-slot-dispatch.cjs]
  provides: [coding-task-router.cjs, mode-c-dispatch]
  affects: [quorum-slot-dispatch.cjs, quorum-slot-dispatch.test.cjs]
tech_stack:
  added: []
  patterns: [fail-open-parsing, prompt-builder-delegation, status-to-verdict-mapping]
key_files:
  created:
    - bin/coding-task-router.cjs
    - bin/coding-task-router.test.cjs
  modified:
    - bin/quorum-slot-dispatch.cjs
    - bin/quorum-slot-dispatch.test.cjs
decisions:
  - Delegated buildModeCPrompt to coding-task-router.cjs rather than inlining prompt construction
  - Mapped coding result status to quorum verdicts: SUCCESS->APPROVE, PARTIAL->FLAG, FAILED->REJECT, UNKNOWN->FLAG
  - Used fail-open pattern for parseCodingResult: malformed output returns UNKNOWN status rather than null/error
metrics:
  duration: 273s
  completed: 2026-04-06
  tasks_completed: 3
  tasks_total: 3
  test_count: 113
---

# Quick Task 380: Delegate quorum slot coding to external agents via quorum-slot-dispatch.cjs

Coding task delegation to external agent CLIs (codex, gemini, opencode, copilot) via Mode C in quorum-slot-dispatch.cjs, with structured prompt construction and fail-open result parsing.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create coding-task-router.cjs | 8064d872 | bin/coding-task-router.cjs, bin/coding-task-router.test.cjs |
| 2 | Add Mode C to quorum-slot-dispatch.cjs | 5f7f8185 | bin/quorum-slot-dispatch.cjs, bin/quorum-slot-dispatch.test.cjs |
| 3 | Add integration tests | f56c7d43 | bin/coding-task-router.test.cjs |

## What Was Built

### coding-task-router.cjs (new module)
Four exported pure functions for coding task delegation:
- `buildCodingPrompt()` — constructs structured prompts with TASK/REPOSITORY/FILES/CONSTRAINTS/CONTEXT/OUTPUT FORMAT sections
- `parseCodingResult()` — extracts status/filesModified/summary from CLI output, fail-open to UNKNOWN on parse failure
- `routeCodingTask()` — orchestrates delegation: builds prompt, spawns call-quorum-slot.cjs, parses result
- `selectSlot()` — returns first subprocess provider with file access (pluggable policy placeholder for future Q-learning routing)

### Mode C in quorum-slot-dispatch.cjs (additive change)
- `buildModeCPrompt()` — delegates to coding-task-router.cjs (no re-inlining)
- Mode C branch in `buildPromptForProvider` closure with `--files` and `--constraints` CLI args
- Mode C result parsing: coding status mapped to quorum verdicts
- Exported in module.exports alongside existing Mode A/B functions

### Test Coverage
- 22 tests in coding-task-router.test.cjs (17 unit + 5 integration)
- 91 tests in quorum-slot-dispatch.test.cjs (87 existing + 4 new Mode C)
- Zero regressions in existing Mode A/B tests

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Prompt delegation over inlining**: buildModeCPrompt delegates to coding-task-router.cjs rather than re-implementing prompt construction, keeping the single-responsibility pattern consistent.

2. **Status-to-verdict mapping**: SUCCESS->APPROVE, PARTIAL->FLAG, FAILED->REJECT, UNKNOWN->FLAG. This maps coding outcomes to the existing quorum verdict vocabulary.

3. **Fail-open parsing**: parseCodingResult returns UNKNOWN status with truncated raw output as summary when structured fields cannot be extracted, matching the project's fail-open convention.

## Self-Check: PASSED

All files verified present, all commits verified in git log.
