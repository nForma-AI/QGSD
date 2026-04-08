---
name: nf:idea-refine
description: Refines vague product or workflow ideas into a focused direction, MVP scope, assumptions, and the right next nForma workflow.
---

# idea-refine skill

Purpose
-------
Refine a rough product, workflow, or tooling idea into a small, actionable direction worth planning or building. This skill fills the gap before `task-intake` and before nForma's roadmap-driven planning commands.

When to use
-----------
- A user has a vague feature, product, or workflow idea
- The team wants to explore options before opening an issue
- The request is too early for `/nf:plan-phase` or `task-intake`
- The user needs help reducing scope, exposing assumptions, or choosing an MVP

High-level steps the skill should follow
----------------------------------------
1) Frame the problem
  - Restate the idea as a single clear problem statement
  - Identify the target user and the signal of success

2) Expand the space
  - Ask 3-5 sharp questions that expose missing context
  - Generate 4-7 materially different approaches
  - Prefer meaningful variations, not cosmetic rewrites

3) Converge
  - Cluster the strongest directions
  - Stress-test them for user value, feasibility, and differentiation
  - Surface hidden assumptions and obvious ways the idea could fail

4) Narrow to an MVP
  - Recommend one direction
  - Define the smallest version worth building
  - State what is explicitly out of scope

5) Route the next step
  - If the idea is ready for issue creation, recommend `task-intake`
  - If it is ready for project planning, recommend `/nf:new-project` or `/nf:new-milestone`
  - If discovery is still needed, state the open questions directly

Output format
-------------
Return a markdown one-pager with these sections:

- `# <Idea name>`
- `## Problem Statement`
- `## Target User`
- `## Success Signal`
- `## Candidate Directions`
- `## Recommended Direction`
- `## Key Assumptions to Validate`
- `## MVP Scope`
- `## Not Doing`
- `## Open Questions`
- `## Recommended Next nForma Step`

Best practices / rules
----------------------
- Push toward simplicity. Reduce scope before adding cleverness.
- Do not jump to implementation details before the problem is clear.
- Do not generate more than 7 candidate directions.
- Challenge weak ideas directly and explain why.
- Make tradeoffs explicit with a real `Not Doing` section.
- If the codebase already provides strong primitives, reuse them in the recommendation.
- If context is missing, make uncertainty visible instead of inventing answers.

Integration notes
-----------------
- This skill complements `task-intake`; it does not replace it.
- Use this before `task-intake` when the request is still fuzzy.
- Use this before `/nf:new-project` or `/nf:new-milestone` when the milestone scope is still unsettled.
- If the user confirms a direction, the resulting one-pager can be converted into an issue or planning input.

Prompt templates (for implementation)
-------------------------------------
- System prompt: "You are a rigorous product and engineering thinking partner. Refine vague ideas into small, testable directions. Prefer clarity, focus, and explicit tradeoffs over breadth."
- User prompt: "Refine this idea into an actionable one-pager and recommend the next nForma workflow: <RAW_IDEA>"

Edge cases
----------
- If the idea is already concrete, compress the divergent phase and move quickly to assumptions, MVP, and routing.
- If the idea spans multiple unrelated problems, split it into separate directions instead of forcing one plan.
- If the best answer is "do not build this," say so and explain why.

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `idea-refine` skill in `addyosmani/agent-skills`, with routing integrated into nForma workflows.
