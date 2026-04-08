---
created: 2026-04-06T12:00:00.000Z
title: Bridge packaged skills into nForma workflow routing
area: tooling
files:
  - docs/agent-skills.md
  - CONTRIBUTING.md
  - README.md
  - docs/USER-GUIDE.md
  - commands/nf/
---

## Problem

The packaged skills now exist, but the handoff between them and nForma's core commands is still mostly documentary.

Right now the expected flow is implicit:

- `idea-refine -> task-intake`
- `task-intake -> issue creation`
- `verify-work -> shipping-and-launch`

That is useful, but not yet operationally obvious.

## Solution

Add explicit workflow routing guidance so contributors and agents know which packaged skill or slash command to use next.

Potential implementation points:

- docs and user guide examples
- command descriptions that reference the adjacent packaged skill
- a lightweight meta-guide for "when to use which skill"

The goal is to reduce hesitation and duplicate workflows, not to add more ceremony.
