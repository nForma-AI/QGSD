---
phase: quick-380
plan: 01
subsystem: agent-skills
tags: [skills, references, workflows, cleanup]
dependency_graph:
  requires: []
  provides: [trimmed-skill-set, enriched-core-references, quality-checklist-wiring]
  affects: [verify-phase, cleanup-review, nf-planner, install]
tech_stack:
  added: []
  patterns: [core-reference-enrichment, verifier-quality-scan]
key_files:
  created:
    - core/references/testing-patterns.md
    - core/references/security-checklist.md
    - core/references/performance-checklist.md
    - core/references/accessibility-checklist.md
  modified:
    - core/references/tdd.md
    - core/references/git-integration.md
    - core/references/verification-patterns.md
    - agents/nf-planner.md
    - core/workflows/verify-phase.md
    - core/workflows/cleanup-review.md
    - docs/agent-skills.md
    - CONTRIBUTING.md
    - README.md
    - docs/USER-GUIDE.md
  deleted:
    - agents/skills/{11 removed skill directories}
    - commands/nf/{11 removed command routing files}
    - references/{4 checklist files moved to core/references/}
decisions:
  - "Merged unique guidance from 11 removed skills into existing core references and workflows rather than creating new files"
  - "Added quality checklist scan as informational warnings in verifier, not blocking gates"
  - "ADR suggestion added to planner as optional guidance, not mandatory task requirement"
metrics:
  duration: "8 minutes"
  completed: "2026-04-07"
  tasks: 3
  files_created: 4
  files_modified: 10
  files_deleted: 30
---

# Quick Task 380: Trim Packaged Skills to 6, Merge Into Lifecycle Summary

Trimmed packaged skills from 17 to 6 by merging 11 removed skills' unique guidance into core reference files and verifier/cleanup workflows, with 4 reference checklists moved from references/ to core/references/ with enrichments.

## Tasks Completed

### Task 1: Merge removed skills guidance into core references and workflows
**Commit:** 652d5719

Enriched 3 existing core references:
- `tdd.md` with Prove-It Pattern (bug-first TDD) and anti-patterns
- `git-integration.md` with pre-commit checklist
- `verification-patterns.md` with slicing strategies (vertical, contract-first, risk-first)

Added ADR task suggestion to `nf-planner.md` for architectural decision capture.

Moved 4 checklists from `references/` to `core/references/` with enrichments:
- `testing-patterns.md` with test quality principles (state-based vs interaction-based)
- `security-checklist.md` with pipeline gate ordering (fail-fast, cheapest-first)
- `performance-checklist.md` with optimization cycle and common bottleneck patterns
- `accessibility-checklist.md` (comprehensive as-is)

Wired quality checklists into verifier workflow (informational scan after must_haves verification). Added simplification scanning category to cleanup-review workflow.

### Task 2: Delete removed skills, command files, old references dir, update docs
**Commit:** 807f0c5b

Deleted 11 skill directories, 11 command routing files, and the old `references/` directory. Updated 4 documentation files to reflect exactly 6 remaining skills: idea-refine, task-intake, code-review-and-quality, api-and-interface-design, deprecation-and-migration, shipping-and-launch.

### Task 3: Install sync and final verification
**No commit** (install.js already copies entire core/ directory)

Verified:
- `node bin/install.js --claude --global` installs all 18 reference files to `~/.claude/nf/references/`
- Installed workflows contain quality checklist scan and simplification scanning
- `npm run test:ci`: 1392 tests pass, 0 fail
- `npm run lint:isolation`: all portable-path checks passed
- `npm run check:assets`: all 3 assets up to date

## Deviations from Plan

None -- plan executed exactly as written.

## Final State

- **6 packaged skills**: idea-refine, task-intake, code-review-and-quality, api-and-interface-design, deprecation-and-migration, shipping-and-launch
- **18 core reference files** (14 existing + 4 moved checklists)
- **Enriched verifier** with quality checklist scan step
- **Enriched cleanup-review** with simplification scanning category
- **Enriched planner** with ADR task suggestion
- All CI gates pass

## Self-Check

Verifying claims:
- core/references/testing-patterns.md: EXISTS
- core/references/security-checklist.md: EXISTS
- core/references/performance-checklist.md: EXISTS
- core/references/accessibility-checklist.md: EXISTS
- Commit 652d5719: EXISTS
- Commit 807f0c5b: EXISTS
- agents/skills/ count: 6 (CORRECT)
- ~/.claude/nf/references/ count: 18 (CORRECT)

## Self-Check: PASSED
