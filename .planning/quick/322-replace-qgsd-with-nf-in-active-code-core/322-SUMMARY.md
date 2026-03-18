---
task: 322
description: "Replace /qgsd: with /nf: in active code (core, agents, hooks, templates)"
status: complete
date: 2026-03-18
commits:
  - 214f833b
  - 60f1ef9a
  - 59d5f7c6
---

# Quick Task 322: Replace /qgsd: → /nf: in Active Code

## What Changed

Replaced all `/qgsd:` slash command references with `/nf:` in active source files:

- **23 files** in `core/templates/`, `core/references/`, `agents/` — 79 replacements
- **2 files** in `.planning/PROJECT.md`, `.planning/MILESTONES.md` — 30 replacements
- **1 file** `CHANGELOG.md` — 6 replacements

## What Was Preserved

- **Hook source comments** (5 occurrences in nf-stop.js, nf-prompt.js) — accurately document the tri-prefix backward-compat regex `/(nf|q?gsd):/`
- **Hook test inputs** (79 occurrences) — test that the regex correctly matches all 3 prefixes
- **Archived files** (.planning/archive/, .planning/milestones/, .planning/phases/, .planning/quick/) — historical records

## Verification

After replacement, zero `/qgsd:` references remain in:
- core/ (0)
- agents/ (0)
- commands/ (0)
- bin/ (0)
- src/ (0)
- .planning/PROJECT.md (0)
- .planning/MILESTONES.md (0)
- CHANGELOG.md (0)
