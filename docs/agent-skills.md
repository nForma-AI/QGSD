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
- capture a decision in docs
- harden a change before merge or release
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

`idea-refine -> task-intake -> /nf:new-project or /nf:new-milestone -> /nf:plan-phase -> /nf:execute-phase -> /nf:verify-work -> code-review-and-quality -> security-and-hardening -> shipping-and-launch`

For smaller ad-hoc work:

`idea-refine -> task-intake -> /nf:quick --full -> code-review-and-quality -> shipping-and-launch`

## Current packaged skills

| Skill | Purpose | Typical next step |
|---|---|---|
| `idea-refine` | Turn a rough idea into a focused one-pager with assumptions and MVP | `task-intake` or `/nf:new-project` |
| `task-intake` | Turn rough requests into issue-ready structured JSON | issue creation or `/nf:quick --full` |
| `code-review-and-quality` | Run a reusable merge-readiness review | `/nf:quick --full`, `/nf:verify-work`, or merge |
| `documentation-and-adrs` | Capture decisions and workflow changes clearly | docs update or changelog |
| `security-and-hardening` | Run a security-focused review and minimum hardening checks | fix issues or `shipping-and-launch` |
| `shipping-and-launch` | Prepare rollout, rollback, and launch readiness | release, staged rollout, or `/nf:observe` |
| `test-driven-development` | RED → GREEN → REFACTOR cycle for new features and bug fixes | `code-review-and-quality` or `/nf:quorum-test` |
| `performance-optimization` | Measure, identify bottlenecks, fix, verify, guard | `code-review-and-quality` or `shipping-and-launch` |
| `code-simplification` | Reduce complexity and remove dead code without changing behavior | `code-review-and-quality` |
| `api-and-interface-design` | Contract-first API and interface design | `code-review-and-quality` or `security-and-hardening` |
| `deprecation-and-migration` | Safe deprecation: replace, announce, migrate, remove | `documentation-and-adrs` or `/nf:plan-phase` |
| `frontend-ui-engineering` | Production-quality UI: components, accessibility, responsive | `browser-testing-with-devtools` or `code-review-and-quality` |
| `browser-testing-with-devtools` | Debug and verify web apps using DevTools | `code-review-and-quality` or `shipping-and-launch` |

## Current state

nForma already has strong workflow coverage in these areas:

- project and milestone intake: `/nf:new-project`, `/nf:new-milestone`, `task-intake`
- research and planning: `/nf:research-phase`, `/nf:plan-phase`, `nf-planner`, `nf-plan-checker`
- execution and verification: `/nf:execute-phase`, `/nf:verify-work`, `/nf:quorum-test`, `nf-executor`, `nf-verifier`
- debugging and production observation: `/nf:debug`, `/nf:observe`, `/nf:solve-*`

Before this work, nForma lacked a small set of portable, reusable skills for the earlier and later parts of the lifecycle:

- before planning: idea shaping and scope convergence
- after building: shipping, rollout, rollback, and launch discipline

## Upstream matrix

| Upstream skill | nForma today | Status | Recommendation |
|---|---|---|---|
| `using-agent-skills` | Meta guidance now lives in this document | Covered | Keep as documentation, not a separate packaged skill |
| `idea-refine` | Packaged skill added | Covered | Keep and iterate based on usage |
| `spec-driven-development` | `/nf:new-project`, `/nf:new-milestone`, requirements flows, plus packaged skill | Covered | Packaged skill for lightweight standalone specs outside milestone system |
| `planning-and-task-breakdown` | `/nf:plan-phase`, `nf-planner`, plan verification loop | Covered | Improve existing planner prompts instead of importing |
| `incremental-implementation` | `/nf:execute-phase`, worktree executor, wave model, plus packaged skill | Covered | Packaged skill for standalone incremental work outside phase system |
| `test-driven-development` | `/nf:fix-tests`, `/nf:debug`, quorum verification, plus packaged TDD skill | Covered | Packaged skill adds TDD discipline; existing tools handle test fixing and running |
| `code-review-and-quality` | `nf-verifier`, `nf-integration-checker`, quorum gates, plus packaged skill | Covered | Keep skill lightweight and routed into verifier flows |
| `documentation-and-adrs` | Existing planning docs plus packaged skill | Covered | Prefer existing docs as the output location |
| `git-workflow-and-versioning` | Contributor guide, worktree executor rules, release scripts, plus packaged skill | Covered | Packaged skill for git discipline guidance in any project |
| `api-and-interface-design` | Packaged skill added | Covered | Use for any API, module boundary, or interface design work |
| `browser-testing-with-devtools` | Packaged skill added | Covered | Pairs with frontend-ui-engineering and Playwright MCP |
| `ci-cd-and-automation` | GitHub Actions, release scripts, publish scripts, plus packaged skill | Covered | Packaged skill for CI/CD pipeline design in any project |
| `code-simplification` | Packaged skill added | Covered | Complements `/simplify` plugin with nForma-native process |
| `context-engineering` | Core nForma strength: fresh subagents, planning context, routing, guardrails | Covered | Keep native approach |
| `debugging-and-error-recovery` | `/nf:debug`, `/nf:observe`, solve loop, quorum diagnosis | Covered | Keep native approach |
| `deprecation-and-migration` | Packaged skill added | Covered | Use for sunsetting systems, APIs, or features |
| `frontend-ui-engineering` | Packaged skill added | Covered | Use for any frontend development work |
| `performance-optimization` | Packaged skill added, plus `references/performance-checklist.md` | Covered | Measure-first approach; pairs with performance checklist |
| `security-and-hardening` | Security docs, secret scan, security sweep, plus packaged skill | Covered | Reuse repo scripts instead of generic checklists |
| `shipping-and-launch` | Release automation plus packaged launch skill | Covered | Keep tied to `/nf:observe` and release scripts |

## Coverage status

All 20 upstream skills from `addyosmani/agent-skills` are now covered. 19 have dedicated packaged skills; 1 (`using-agent-skills`) is covered by this document. The only upstream skill without a dedicated packaged skill is `planning-and-task-breakdown`, which is fully handled by `/nf:plan-phase` and `nf-planner`.

## Import history

Phase 1 (initial):
1. `idea-refine`
2. `shipping-and-launch`
3. `code-review-and-quality`
4. `documentation-and-adrs`
5. `security-and-hardening`

Phase 2 (engineering practices):
6. `test-driven-development`
7. `performance-optimization`
8. `code-simplification`
9. `api-and-interface-design`
10. `deprecation-and-migration`
11. `frontend-ui-engineering`
12. `browser-testing-with-devtools`

Phase 3 (complete coverage):
13. `spec-driven-development`
14. `incremental-implementation`
15. `git-workflow-and-versioning`
16. `ci-cd-and-automation`

This covers the full lifecycle:

`idea -> scope -> plan -> build -> verify -> review -> ship`

nForma is already strong from `plan` through `verify`. This pass extends that strength into `idea`, `review`, and `ship`.

## Design principles for adaptation

Do not copy upstream skills verbatim into nForma. Adapt them to nForma's existing workflow model:

- route into slash commands where strong equivalents already exist
- keep packaged skills small and reusable
- prefer repo-aware outputs over generic advice
- avoid duplicate planning systems when nForma already has one
- treat upstream checklists as references, not replacements for nForma orchestration

## Reference checklists

The `references/` directory contains lightweight checklists adapted from upstream for use alongside packaged skills:

| Checklist | Use with |
|---|---|
| `references/testing-patterns.md` | `code-review-and-quality`, `/nf:fix-tests`, `/nf:verify-work` |
| `references/security-checklist.md` | `security-and-hardening`, `/nf:solve` |
| `references/performance-checklist.md` | `code-review-and-quality`, performance-sensitive changes |
| `references/accessibility-checklist.md` | CLI output changes, documentation updates |

These checklists are reference material, not enforcement gates. Use them during review or when a packaged skill recommends a deeper check.

## Using packaged skills well

- Start with the smallest skill that matches the problem.
- Route back into slash commands once orchestration or execution is needed.
- Prefer repo-aware outputs over generic guidance.
- Reference the checklists in `references/` when a skill calls for deeper verification.
- Avoid parallel documentation systems; packaged skills should reinforce existing nForma flows.

## Suggested next step

The next useful move is not importing every upstream skill blindly. It is continuing to tighten the bridge between packaged skills and core commands so outputs flow naturally into the rest of nForma.
