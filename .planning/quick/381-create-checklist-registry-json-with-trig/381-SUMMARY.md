---
phase: quick-381
plan: 01
subsystem: checklist-registry
tags: [checklist, registry, verify-phase, deprecation, skill-consolidation]
dependency-graph:
  requires: []
  provides: [checklist-registry-json, checklist-match-script, deprecation-checklist]
  affects: [verify-phase, agent-skills-docs]
tech-stack:
  added: []
  patterns: [data-driven-routing, glob-to-regex]
key-files:
  created:
    - core/references/checklist-registry.json
    - core/references/deprecation-checklist.md
    - bin/checklist-match.cjs
    - bin/checklist-match.test.cjs
  modified:
    - core/workflows/verify-phase.md
    - docs/agent-skills.md
  deleted:
    - agents/skills/deprecation-and-migration/SKILL.md
    - commands/nf/deprecation-and-migration.md
decisions:
  - Implemented lightweight glob-to-regex converter instead of external dependency (minimatch)
  - Converted deprecation-and-migration from standalone skill to conditional checklist
metrics:
  duration: 4m
  completed: 2026-04-07
  tasks: 2/2
  tests: 10 new (1392 total passing)
---

# Quick Task 381: Create checklist registry JSON + matching script Summary

Data-driven checklist registry with 6 entries, matching script using glob-to-regex and keyword resolution, replacing hardcoded if/then routing in verify-phase.md.

## What was done

### Task 1: Create checklist registry, matching script with tests, and deprecation checklist

- Created `core/references/checklist-registry.json` (schema `checklist-registry/v1`) with 6 checklist entries: testing-patterns, security, performance, accessibility, api-design, deprecation
- Created `bin/checklist-match.cjs` with lightweight glob-to-regex matcher (no external dependencies), CLI interface with --files/--description/--task-type/--help flags, and exported `matchChecklists()` for testability
- Created `bin/checklist-match.test.cjs` with 10 tests covering file patterns, keywords, task types, no-matches, multiple matches, glob edge cases, and deprecation keywords
- Created `core/references/deprecation-checklist.md` with decision framework, before-deprecating, migration, removal, and anti-patterns sections extracted from the skill

**Commit:** 7d78a050

### Task 2: Update verify-phase.md, remove deprecation skill, update docs

- Replaced hardcoded quality_checklist_scan step in `core/workflows/verify-phase.md` with registry-driven approach using `checklist-match.cjs`
- Deleted `agents/skills/deprecation-and-migration/SKILL.md` and `commands/nf/deprecation-and-migration.md`
- Updated `docs/agent-skills.md`: 5 skills to 4, removed deprecation-and-migration from table and lifecycle, added deprecation-checklist.md to reference table, documented the checklist registry system

**Commit:** 0c515031

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `node --test bin/checklist-match.test.cjs`: 10/10 pass
- `node bin/checklist-match.cjs --files "hooks/nf-stop.js" --description "auth fix"`: returns security checklist
- `node bin/checklist-match.cjs --help`: prints usage
- Registry JSON valid and loadable
- verify-phase.md contains `checklist-match`, no hardcoded conditions
- Deprecation skill directory and command deleted
- docs/agent-skills.md says 4 packaged skills, includes deprecation-checklist.md
- `npm run lint:isolation`: passed
- `npm run test:ci`: 1392 pass / 0 fail
