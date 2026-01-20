---
phase: 05-subagent-codebase-analysis
plan: 01
title: gsd-entity-generator Agent Definition
subsystem: agents
tags: [subagent, entity-generation, semantic-analysis]

dependency-graph:
  requires:
    - 04-03 (entity generation instructions)
    - gsd-codebase-mapper.md (pattern reference)
  provides:
    - gsd-entity-generator subagent definition
    - Entity template specification
    - Type heuristics table
  affects:
    - 05-02 (analyze-codebase integration)
    - Future entity generation workflows

tech-stack:
  added: []
  patterns:
    - Subagent direct-write pattern
    - Statistics-only return pattern
    - Wiki-link dependency notation

key-files:
  created:
    - agents/gsd-entity-generator.md
  modified: []

decisions:
  - id: skip-existing-entities
    choice: Check for existing entity file before writing
    rationale: Prevents overwriting manual edits to entities

metrics:
  duration: 1 min 13 sec
  completed: 2026-01-20
---

# Phase 05 Plan 01: gsd-entity-generator Agent Definition Summary

**One-liner:** Subagent definition for semantic entity generation with direct disk writes and statistics-only returns.

## What Was Built

Created `agents/gsd-entity-generator.md` following the established `gsd-codebase-mapper.md` pattern:

**Agent structure:**
- Frontmatter with name, description, tools (Read, Write, Bash), color
- Role section explaining spawn context from `/gsd:analyze-codebase`
- `<why_this_matters>` section explaining how entities feed the intelligence system
- 3-step process: parse_file_list, process_each_file, return_statistics

**Entity template specification:**
- YAML frontmatter: path, type, updated, status
- Sections: Purpose, Exports, Dependencies, Used By, Notes
- Internal dependencies use [[wiki-links]] for graph edge creation
- External dependencies as plain text

**Type heuristics table:**
| Type | Indicators |
|------|-----------|
| api | api/, routes/, endpoints/ |
| component | components/, React/Vue exports |
| util | utils/, lib/, helpers/ |
| config | config/, *.config.* |
| hook | hooks/, use* functions |
| service | services/ |
| model | models/, types/ |
| test | *.test.*, *.spec.* |
| module | default |

**Wiki-link rules:**
- Internal (starts with `.` or `@/`) -> convert to slug, wrap in [[brackets]]
- External (package name) -> plain text, no brackets

**Critical rules matching gsd-codebase-mapper:**
- WRITE entities directly (never return contents)
- PostToolUse hook syncs to graph.db automatically
- Use EXACT template format (hook parses frontmatter + [[links]])
- Skip existing entities (don't overwrite)
- Return statistics only (~10 lines)

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create gsd-entity-generator agent definition | f4c5817 | agents/gsd-entity-generator.md |

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Skip existing entities by default**
   - Prevents accidental overwrite of manually edited entities
   - Aligns with research recommendation in 05-RESEARCH.md
   - Agent checks `ls .planning/intel/entities/{slug}.md` before writing

## Verification Results

- [x] File exists at `agents/gsd-entity-generator.md`
- [x] Frontmatter valid YAML (name, description, tools, color)
- [x] Role section explains subagent purpose
- [x] Process has 3 steps: parse, process, return
- [x] Entity template included in full
- [x] Type heuristics table present
- [x] Wiki-link rules specified
- [x] Critical rules section matches gsd-codebase-mapper style
- [x] Returns statistics only (not entity contents)

## Next Phase Readiness

**Prerequisites for 05-02:**
- [x] gsd-entity-generator.md exists
- [x] Agent follows expected patterns (direct write, stats return)
- [x] Entity template matches what PostToolUse hook expects

**Ready for:** Integration into `/gsd:analyze-codebase` command (Plan 05-02)
