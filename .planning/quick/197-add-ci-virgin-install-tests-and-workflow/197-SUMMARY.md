---
phase: quick-197
plan: 01
subsystem: testing
tags: [install, ci, node-test, github-actions, multi-runtime]

requires:
  - phase: none
    provides: standalone
provides:
  - Virgin install integration test suite for Claude, OpenCode, and Gemini runtimes
  - CI workflow with ubuntu+macOS x Node 18/20/22 matrix
  - test:install npm script shortcut
affects: [bin/install.js, hooks/dist]

tech-stack:
  added: []
  patterns: [execFileSync with --config-dir for isolated install testing]

key-files:
  created:
    - test/install-virgin.test.cjs
    - .github/workflows/ci-install.yml
  modified:
    - Dockerfile.test-install
    - package.json

key-decisions:
  - "Content adaptation tests verify config-loader.js (not nf-stop.js) since that is where path.join replacement occurs"
  - "OpenCode frontmatter conversion keeps YAML --- delimiters with modified fields, not TOML"
  - "Gemini commands use .toml extension (converted from .md by installer)"
  - "No Windows in CI matrix (install.js uses $HOME which is shell-specific)"

patterns-established:
  - "Virgin install testing via execFileSync + mkdtempSync + --config-dir isolation"

requirements-completed: [CI-INSTALL-01]

duration: 4min
completed: 2026-03-06
---

# Quick 197: Add CI Virgin Install Tests and Workflow Summary

**32-test virgin install suite covering Claude/OpenCode/Gemini file layout, content adaptation, and idempotency with a 6-combination CI matrix**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T20:31:19Z
- **Completed:** 2026-03-06T20:35:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

### Task 1: Virgin Install Integration Test Suite
- Created `test/install-virgin.test.cjs` with 32 tests across 3 runtime describe blocks
- File layout verification (nf/, nf-bin/, hooks/, agents/, commands/, settings.json, nf.json, package.json)
- Content adaptation: config-loader.js path references, OpenCode /nf- prefix conversion, Gemini .toml commands
- Idempotency: re-install produces identical file count and VERSION content (OverridesPreserved invariant)
- **Commit:** 9654f344

### Task 2: CI Workflow, Dockerfile Rebrand, npm Script
- Created `.github/workflows/ci-install.yml` with ubuntu+macOS x Node 18/20/22 matrix (6 combinations)
- Path-filtered to installer-related files only (bin/install.js, hooks/dist/, commands/, agents/, core/)
- Rebranded Dockerfile.test-install from QGSD to nForma
- Added `test:install` script to package.json
- **Commit:** 97563a54

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed content adaptation test targets**
- **Found during:** Task 1
- **Issue:** Plan specified checking nf-stop.js for '.claude' path references, but the actual path.join replacement occurs in config-loader.js
- **Fix:** Changed tests to verify config-loader.js instead of nf-stop.js
- **Files modified:** test/install-virgin.test.cjs

**2. [Rule 1 - Bug] Fixed OpenCode frontmatter assertions**
- **Found during:** Task 1
- **Issue:** Plan assumed OpenCode command/agent files would NOT have YAML --- frontmatter, but convertClaudeToOpencodeFrontmatter preserves --- delimiters while converting field values
- **Fix:** Changed tests to verify /nf- prefix conversion and tool name adaptations instead
- **Files modified:** test/install-virgin.test.cjs

**3. [Rule 1 - Bug] Fixed Gemini command file extension**
- **Found during:** Task 1
- **Issue:** Plan assumed Gemini commands/ would contain .md files, but installer converts them to .toml format
- **Fix:** Changed test to check for .toml files in commands/nf/
- **Files modified:** test/install-virgin.test.cjs

## Verification

- All 32 tests pass via `npm run test:install`
- YAML syntax validated for ci-install.yml
- Zero QGSD references remaining in Dockerfile.test-install
- No files written outside /tmp/ during test execution
