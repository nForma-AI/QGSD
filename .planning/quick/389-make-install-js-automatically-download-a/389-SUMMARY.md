---
phase: quick-389
plan: 01
subsystem: install
tags: [coderlm, install, lifecycle, binary-download, fail-open]
dependency_graph:
  requires: [bin/coderlm-lifecycle.cjs]
  provides: [coderlm binary auto-download on install]
  affects: [bin/install.js]
tech_stack:
  added: []
  patterns: [lazy-require, fail-open, idempotency-check]
key_files:
  modified:
    - bin/install.js
    - bin/coderlm-lifecycle.test.cjs
decisions:
  - Lazy require pattern used so install.js does not fail at startup if coderlm-lifecycle.cjs is absent
  - Outer try/catch scoped only to fs.accessSync (presence check); ensureBinary() handles its own errors internally
  - Only ENOENT triggers download — other access errors (EACCES, EISDIR) skip silently to preserve idempotency
  - No failures.push() for coderlm step — download failure never causes process.exit(1)
metrics:
  duration: ~10m
  completed: 2026-04-09
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 389: Make install.js automatically download coderlm binary — Summary

**One-liner:** Wired `ensureBinary()` from coderlm-lifecycle.cjs into install() via lazy require, with idempotent presence check, progress feedback, and fail-open error handling.

## What Was Done

### Task 1: Wire ensureBinary() into install() after nf-bin copy

Modified `bin/install.js` to:

1. Added a lazy require pattern near the top (alongside other requires) that defers loading `coderlm-lifecycle.cjs` so a missing module never breaks install startup.

2. After the `if (fs.existsSync(binSrc))` nf-bin copy block (line 2562), added a coderlm download block that:
   - Checks if `~/.claude/nf-bin/coderlm` is already executable (idempotency)
   - Only on `ENOENT` (truly absent binary): prints `Installing coderlm...`, calls `lifecycle.ensureBinary()`, then prints success or yellow warning
   - Other access errors (EACCES, EISDIR) are silently skipped to preserve idempotency
   - Never calls `failures.push()` — coderlm download failure never causes `process.exit(1)`
   - No `'use strict'` added (pre-existing style of install.js preserved)

### Task 2: Add integration test for coderlm download step

Added two contract tests to `bin/coderlm-lifecycle.test.cjs` in a new `describe('ensureBinary() install.js contract', ...)` block:

- `returns ok:true with source:cached when binary already exists` — verifies the exact behavior install.js relies on for idempotency
- `returns ok:false (not ok:undefined) on download failure` — verifies `result.ok` is always a boolean, never undefined

Both new tests pass. The pre-existing test failure (`exports all 6 required functions` — doesn't account for `reindex`) was present before this task and is out of scope.

## Verification Results

- `node bin/install.js --claude --global` exits 0 when coderlm download fails (yellow warning printed)
- Re-run with binary present: no "Installing coderlm..." line, exits 0 (idempotent)
- `grep -n 'ensureBinary' bin/install.js` returns matches at lines 2588, 2591
- `grep -n "'use strict'" bin/install.js` returns empty (constraint preserved)
- `node --test bin/coderlm-lifecycle.test.cjs` — 33/34 pass (1 pre-existing failure unrelated to this task)

## Deviations from Plan

None — plan executed exactly as written.

## Commit

- `bf0931c2` — feat(quick-389): wire ensureBinary() into install.js for coderlm auto-download

## Self-Check

- [x] bin/install.js modified with lazy require and ensureBinary() call
- [x] bin/coderlm-lifecycle.test.cjs has 2 new contract tests
- [x] Commit bf0931c2 exists
- [x] No 'use strict' added to install.js
- [x] Install exits 0 regardless of download outcome
