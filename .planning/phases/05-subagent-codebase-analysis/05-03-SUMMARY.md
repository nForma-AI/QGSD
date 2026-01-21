---
phase: 05-subagent-codebase-analysis
plan: 03
title: gsd-indexer Agent Definition
subsystem: agents
tags: [subagent, indexing, file-analysis, context-preservation]

dependency-graph:
  requires:
    - 05-01 (gsd-entity-generator pattern reference)
    - gsd-codebase-mapper.md (agent structure pattern)
    - analyze-codebase.md Step 3 (regex patterns)
  provides:
    - gsd-indexer subagent definition
    - File indexing via subagent delegation
    - Context-preserving index generation
  affects:
    - 05-04 (analyze-codebase integration)
    - Steps 2-3 context exhaustion fix

tech-stack:
  added: []
  patterns:
    - Subagent direct-write pattern
    - Statistics-only return pattern
    - Regex-based export/import extraction

key-files:
  created:
    - agents/gsd-indexer.md
  modified: []

decisions:
  - id: absolute-path-keys
    choice: Use absolute paths as index keys
    rationale: O(1) lookup, matches existing index.json schema

metrics:
  duration: 1 min 23 sec
  completed: 2026-01-21
---

# Phase 05 Plan 03: gsd-indexer Agent Definition Summary

**One-liner:** Subagent definition for file indexing that extracts exports/imports using validated regex patterns and writes index.json directly to disk.

## What Was Built

Created `agents/gsd-indexer.md` following the `gsd-entity-generator.md` pattern:

**Agent structure:**
- Frontmatter with name, description, tools (Read, Write, Bash), color
- Role section explaining spawn context from `/gsd:analyze-codebase`
- `<why_this_matters>` section explaining index consumers (convention detection, entity generation, PostToolUse hook)
- 4-step process: parse_input, process_each_file, write_index, return_statistics

**Regex patterns (exact match with analyze-codebase Step 3):**

Export patterns:
| Pattern | Regex | Purpose |
|---------|-------|---------|
| Named exports | `export\s*\{([^}]+)\}` | `export { a, b }` |
| Declaration | `export\s+(?:const\|let\|var\|function\*?\|async\s+function\|class)\s+(\w+)` | `export const foo` |
| Default | `export\s+default\s+(?:function\s*\*?\s*\|class\s+)?(\w+)?` | `export default` |
| CommonJS object | `module\.exports\s*=\s*\{([^}]+)\}` | `module.exports = { }` |
| CommonJS single | `module\.exports\s*=\s*(\w+)\s*[;\n]` | `module.exports = X` |
| TypeScript | `export\s+(?:type\|interface)\s+(\w+)` | `export type/interface` |

Import patterns:
| Pattern | Regex | Purpose |
|---------|-------|---------|
| ES6 | `import\s+(?:\{[^}]*\}\|\*\s+as\s+\w+\|\w+)\s+from\s+['"]([^'"]+)['"]` | `import X from 'y'` |
| Side-effect | `import\s+['"]([^'"]+)['"]` | `import 'styles.css'` |
| CommonJS | `require\s*\(\s*['"]([^'"]+)['"]\s*\)` | `require('x')` |

**Index schema (matches Step 5):**
```javascript
{
  version: 1,
  updated: Date.now(),
  files: {
    "/absolute/path": {
      exports: [],
      imports: [],
      indexed: Date.now()
    }
  }
}
```

**Critical rules:**
- Write index.json directly (never return contents)
- Use exact regex patterns from Step 3
- Absolute paths as keys for O(1) lookup
- Handle read errors gracefully (log, continue)
- Return statistics only (~10 lines)

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create gsd-indexer agent definition | 5d03e14 | agents/gsd-indexer.md |

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Absolute path keys**
   - Continues existing index.json schema decision from 01-01
   - Enables O(1) lookup for any file path
   - Consistent with PostToolUse hook expectations

## Verification Results

- [x] File exists at `agents/gsd-indexer.md`
- [x] Frontmatter valid YAML (name, description, tools, color)
- [x] Role section explains subagent purpose (spawned by analyze-codebase)
- [x] Process has 4 steps: parse, process, write, return
- [x] Export regex patterns match Step 3 exactly (6 patterns)
- [x] Import regex patterns match Step 3 exactly (3 patterns)
- [x] Index schema matches Step 5 format (version, updated, files)
- [x] Critical rules section matches gsd-entity-generator style
- [x] Returns statistics only (not index contents)

## Next Phase Readiness

**Prerequisites for 05-04:**
- [x] gsd-indexer.md exists
- [x] Agent follows expected patterns (direct write, stats return)
- [x] Regex patterns validated against analyze-codebase Step 3
- [x] Index schema matches existing expectations

**Ready for:** Integration into `/gsd:analyze-codebase` command Steps 2-3 (Plan 05-04)
