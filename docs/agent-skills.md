# Agent Skills

This document serves two purposes:

- explain how packaged skills fit into nForma's workflow model
- compare nForma's current coverage against the MIT-licensed [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills) catalog

## What packaged skills are for

Packaged skills are small reusable workflow guides under `agents/skills/`.

Use them when you need a focused process around a specific activity:

- shape an idea
- normalize a request into an issue
- review code before merge
- prepare a safe launch

Do not use packaged skills as a replacement for nForma's main orchestration commands. nForma already has strong slash-command workflows for planning, execution, debugging, verification, and milestone management.

## Packaged skill vs slash command

Use a packaged skill when:

- the task is narrow and process-oriented
- you need a reusable checklist or output structure
- you are between the larger roadmap steps

Use a slash command when:

- the task needs orchestration, state tracking, or multi-agent execution
- the task belongs to the main project lifecycle
- you want nForma to create plans, execute work, or verify outcomes

## Lifecycle routing

Recommended flow:

`idea-refine -> task-intake -> /nf:new-project or /nf:new-milestone -> /nf:plan-phase -> /nf:execute-phase -> /nf:verify-work -> code-review-and-quality -> shipping-and-launch`

For smaller ad-hoc work:

`idea-refine -> task-intake -> /nf:quick --full -> code-review-and-quality -> shipping-and-launch`

## Current packaged skills

| Skill | Purpose | Typical next step |
|---|---|---|
| `idea-refine` | Turn a rough idea into a focused one-pager with assumptions and MVP | `task-intake` or `/nf:new-project` |
| `task-intake` | Turn rough requests into issue-ready structured JSON | issue creation or `/nf:quick --full` |
| `code-review-and-quality` | Run a reusable merge-readiness review | `/nf:quick --full`, `/nf:verify-work`, or merge |
| `shipping-and-launch` | Prepare rollout, rollback, and launch readiness | release, staged rollout, or `/nf:observe` |

## Trimmed skills

In quick task 380, 11 packaged skills were trimmed because their guidance duplicated existing nForma capabilities. Their unique content was merged into core reference files and workflows:

| Removed skill | Guidance merged into |
|---|---|
| `test-driven-development` | `core/references/tdd.md` (Prove-It Pattern, anti-patterns) |
| `performance-optimization` | `core/references/performance-checklist.md` (optimization cycle, bottleneck patterns) |
| `code-simplification` | `core/workflows/cleanup-review.md` (simplification scanning category) |
| `frontend-ui-engineering` | Already covered by existing accessibility and UI references |
| `browser-testing-with-devtools` | Already covered by Playwright MCP and existing verification |
| `spec-driven-development` | Already covered by `/nf:new-project` and requirements flows |
| `incremental-implementation` | `core/references/verification-patterns.md` (slicing strategies) |
| `git-workflow-and-versioning` | `core/references/git-integration.md` (pre-commit checklist) |
| `ci-cd-and-automation` | `core/references/security-checklist.md` (pipeline gate ordering) |
| `documentation-and-adrs` | `agents/nf-planner.md` (ADR task suggestion) |
| `security-and-hardening` | `core/references/security-checklist.md` |
| `api-and-interface-design` | `core/references/api-design-checklist.md` (verifier conditional checklist) |

## Current state

nForma already has strong workflow coverage in these areas:

- project and milestone intake: `/nf:new-project`, `/nf:new-milestone`, `task-intake`
- research and planning: `/nf:research-phase`, `/nf:plan-phase`, `nf-planner`, `nf-plan-checker`
- execution and verification: `/nf:execute-phase`, `/nf:verify-work`, `/nf:quorum-test`, `nf-executor`, `nf-verifier`
- debugging and production observation: `/nf:debug`, `/nf:observe`, `/nf:solve-*`

The 4 remaining packaged skills fill the lifecycle gaps that slash commands do not cover:

- before planning: idea shaping (`idea-refine`) and scope convergence (`task-intake`)
- before merge: code quality review (`code-review-and-quality`)
- before release: shipping discipline (`shipping-and-launch`)

## Coverage status

All 20 upstream skills from `addyosmani/agent-skills` are covered. 4 have dedicated packaged skills; 1 (deprecation-and-migration) was converted to a conditional checklist (`core/references/deprecation-checklist.md`); 12 were trimmed and their guidance merged into core references and workflows; 2 (`planning-and-task-breakdown`, `context-engineering`) are fully handled by nForma's native orchestration; 1 (`using-agent-skills`) is covered by this document.

## Reference checklists

The `core/references/` directory contains lightweight checklists adapted from upstream for use alongside packaged skills and the verifier workflow:

| Checklist | Use with |
|---|---|
| `core/references/testing-patterns.md` | `code-review-and-quality`, `/nf:fix-tests`, `/nf:verify-work` |
| `core/references/security-checklist.md` | security-sensitive changes, `/nf:solve` |
| `core/references/performance-checklist.md` | `code-review-and-quality`, performance-sensitive changes |
| `core/references/accessibility-checklist.md` | CLI output changes, documentation updates |
| `core/references/api-design-checklist.md` | API endpoints, module interfaces, public contracts |
| `core/references/deprecation-checklist.md` | deprecation planning, migration tasks, `/nf:verify-work` |

These checklists are reference material, not enforcement gates. The verifier workflow (`core/workflows/verify-phase.md`) automatically scans against relevant checklists and reports findings as informational warnings.

The checklist registry (`core/references/checklist-registry.json`) drives automatic checklist resolution in verify-phase. Each entry maps file patterns, keywords, and task types to a checklist file. Adding a new checklist requires only a new `.md` file and a registry entry -- no workflow code changes.

## Using packaged skills well

- Start with the smallest skill that matches the problem.
- Route back into slash commands once orchestration or execution is needed.
- Prefer repo-aware outputs over generic guidance.
- Reference the checklists in `core/references/` when a skill calls for deeper verification.
- Avoid parallel documentation systems; packaged skills should reinforce existing nForma flows.

## Design principles for adaptation

Do not copy upstream skills verbatim into nForma. Adapt them to nForma's existing workflow model:

- route into slash commands where strong equivalents already exist
- keep packaged skills small and reusable
- prefer repo-aware outputs over generic advice
- avoid duplicate planning systems when nForma already has one
- treat upstream checklists as references, not replacements for nForma orchestration
