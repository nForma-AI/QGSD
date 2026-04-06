---
created: 2026-04-06T12:00:00.000Z
title: Add documentation-and-adrs packaged skill
area: docs
files:
  - agents/skills/
  - docs/agent-skills.md
  - CONTRIBUTING.md
---

## Problem

nForma generates strong planning artifacts, but it still lacks a reusable packaged skill for writing concise engineering documentation and ADR-style decisions outside the main roadmap flow.

This makes small architecture writeups and decision capture inconsistent, especially for contributors doing focused quick tasks.

## Solution

Add an `agents/skills/documentation-and-adrs/SKILL.md` package adapted to nForma.

The skill should:

- define when to write docs vs ADRs vs changelog entries
- prefer short, decision-oriented outputs
- point users at existing repo docs and contribution patterns
- avoid inventing a second planning system alongside `.planning/`
