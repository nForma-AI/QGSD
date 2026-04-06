---
created: 2026-04-06T12:00:00.000Z
title: Add code-review-and-quality packaged skill
area: tooling
files:
  - agents/skills/
  - docs/agent-skills.md
  - CONTRIBUTING.md
  - .github/pull_request_template.md
---

## Problem

The upstream `code-review-and-quality` skill is still only partially covered in nForma. We have strong verifier and integration-checker agents, but no small packaged skill that a contributor can invoke directly for structured pre-merge review guidance.

This leaves a gap between:

- code is implemented and verified
- a human or agent wants a reusable review checklist and decision rubric before merge

## Solution

Add an `agents/skills/code-review-and-quality/SKILL.md` package adapted to nForma.

The skill should:

- focus on correctness, readability, architecture, security, and performance
- route into existing nForma verification workflows where appropriate
- stay lightweight and reusable instead of duplicating `nf-verifier`
- update docs so contributors know when to use the packaged skill vs slash commands
