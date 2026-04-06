---
name: nf:spec-driven-development
description: Guides spec-first development — write specifications before code to surface assumptions, define success criteria, and establish boundaries.
---

# spec-driven-development skill

Purpose
-------
Write specifications before writing code. The spec surfaces misunderstandings before code gets written, defines success criteria, and establishes boundaries. Use this for any work where the requirements are not yet clear or the scope exceeds a simple fix.

When to use
-----------
- New projects or features with ambiguous requirements
- Multi-file changes where scope needs to be defined upfront
- Architectural decisions that affect multiple components
- Work estimated to take more than 30 minutes
- When the user asks to write a spec, define requirements, or plan before building

When NOT to use
---------------
- Single-line fixes with clear requirements
- Self-contained changes where the spec would be longer than the code
- Already using `/nf:new-project` or `/nf:plan-phase` (which include spec-like steps)

High-level steps
----------------
1) Specify — surface assumptions and document:
  - **Objective**: who is the user, what does success look like?
  - **Commands**: how to build, test, lint, run
  - **Project structure**: directory layout and key files
  - **Code style**: conventions and working examples
  - **Testing strategy**: framework, coverage targets, test levels
  - **Boundaries**: "always do," "ask first," "never do"

2) Plan — create a technical approach:
  - Identify components, dependencies, and order
  - Flag risks and unknowns
  - Define verification checkpoints

3) Tasks — break the plan into discrete units:
  - Each task fits in a single session
  - Each has acceptance criteria and a verification step
  - Each lists the files it will touch

4) Implement — execute tasks incrementally:
  - Test-first where possible (see `nf:test-driven-development`)
  - Commit after each completed task
  - Update the spec when scope or decisions change

Living document rules
---------------------
- Update the spec when decisions change — it is not frozen after step 1
- Commit spec files alongside code
- Reference the spec in pull requests

Integration with nForma
------------------------
- For full project specs, use `/nf:new-project` instead (includes roadmap and milestone structure)
- For phase-level planning, use `/nf:plan-phase`
- This skill is for lightweight, standalone specs outside the milestone system
- After specifying, route to `nf:task-intake` for issue creation or `/nf:quick --full` for execution

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `spec-driven-development` skill in `addyosmani/agent-skills`.
