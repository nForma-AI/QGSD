---
name: documentation-and-adrs
description: Captures technical decisions and workflow changes in concise docs or ADR-style records tied to existing nForma documentation.
---

# documentation-and-adrs skill

Purpose
-------
Capture the why behind technical decisions and user-facing changes. This skill helps contributors write concise docs and ADR-style records without inventing a parallel planning system.

When to use
-----------
- A meaningful architectural decision was made
- Public behavior, setup, or workflow changed
- A contributor needs to explain tradeoffs for future humans or agents
- The same decision context keeps getting re-explained in reviews or chats

High-level steps the skill should follow
----------------------------------------
1) Identify the document type
  - ADR for durable architecture or process decisions
  - README/User Guide update for contributor or user-facing workflow changes
  - Changelog entry for notable shipped behavior

2) Capture the context
  - What changed?
  - Why was this path chosen?
  - What alternatives were rejected?
  - What follow-on consequences matter?

3) Write only the missing documentation
  - Do not restate obvious code
  - Prefer short, decision-oriented prose
  - Link to commands, files, or workflows when they are the source of truth

4) Verify alignment
  - Docs should match actual commands, file paths, and workflows in the repo
  - If the implementation changed, note any required follow-up doc updates

Output format
-------------
Choose the smallest fitting artifact:

- ADR-style note:
  - `## Context`
  - `## Decision`
  - `## Alternatives Considered`
  - `## Consequences`

- Workflow or user doc update:
  - short explanatory prose
  - command examples
  - links to the canonical file or workflow

Best practices / rules
----------------------
- Document decisions, constraints, and tradeoffs, not code trivia.
- Prefer one short strong document to several weak ones.
- Do not create standalone docs when an existing file is the right home.
- Keep docs repo-specific: refer to real commands and directories.
- If the decision is cheap to reverse, a short note is enough.

Recommended nForma integration
------------------------------
- Use after planning or implementation when a durable decision was made.
- Pair with `code-review-and-quality` when docs are part of merge readiness.
- Update `CHANGELOG.md` for user-facing changes.
- Prefer existing docs such as `README.md`, `docs/USER-GUIDE.md`, `CONTRIBUTING.md`, and `docs/agent-skills.md` before creating a new file.

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `documentation-and-adrs` skill in `addyosmani/agent-skills`, with emphasis on nForma's existing docs and planning artifacts.
