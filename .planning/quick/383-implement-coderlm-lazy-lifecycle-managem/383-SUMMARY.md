---
phase: quick-383
plan: 01
subsystem: coderlm-lifecycle
tags: [coderlm, lifecycle, auto-start, idle-timeout, fail-open]
dependency_graph:
  requires: [quick-381, quick-382]
  provides: [coderlm-lifecycle-module, nf-coderlm-skill]
  affects: [nf-solve, coderlm-adapter]
tech_stack:
  added: []
  patterns: [lazy-lifecycle, fail-open, pid-management, idle-auto-stop]
key_files:
  created:
    - bin/coderlm-lifecycle.cjs
    - bin/coderlm-lifecycle.test.cjs
    - commands/nf/coderlm.md
  modified:
    - bin/nf-solve.cjs
    - bin/coderlm-adapter.cjs
    - docs/coderlm-integration.md
decisions:
  - id: D-383-01
    summary: "Use gh CLI for binary download instead of direct HTTPS — handles auth, redirects, and latest-release resolution"
  - id: D-383-02
    summary: "Default adapter to enabled=true, removing NF_CODERLM_ENABLED gate — lifecycle module manages server availability"
  - id: D-383-03
    summary: "5-minute idle timeout for auto-stop — balances resource usage with responsiveness for back-to-back solve runs"
metrics:
  duration: 594s
  completed: 2026-04-08
---

# Quick Task 383: Implement coderlm lazy lifecycle management

Lazy lifecycle manager that auto-downloads coderlm binary from GitHub Releases, auto-starts the server on first nf:solve run, and auto-stops after 5 minutes idle -- replacing the manual NF_CODERLM_ENABLED gate with fully self-managing fail-open semantics.

## Task Results

### Task 1: Create bin/coderlm-lifecycle.cjs -- binary download and process lifecycle

**Commit:** `5b40e4c9`
**Files:** `bin/coderlm-lifecycle.cjs`, `bin/coderlm-lifecycle.test.cjs`

Created CommonJS lifecycle module with 6 exported functions:

- **ensureBinary()** -- Idempotent binary download via `gh release download`. Preserves user-placed binaries (OverridesPreserved invariant). Returns `{ok, path, source}`.
- **ensureRunning(opts)** -- Start server if not running. Handles stale PID files, zombie processes (alive but unhealthy), and binary download. Polls health endpoint up to 3s after spawn.
- **stop()** -- Graceful SIGTERM with 3s timeout, escalating to SIGKILL. PID file cleanup guaranteed in ALL exit paths via try/catch/finally pattern (LivenessProperty1).
- **status()** -- Reports binary, process, health, and idle state as structured object.
- **touchLastQuery()** -- Resets idle timer. Fire-and-forget (fail-open).
- **checkIdleStop()** -- Stops server if idle > 5 minutes.

CLI interface (`--start`, `--stop`, `--status`, `--update`, `--check-idle`) outputs JSON to stdout.

Test file covers: module exports, platform detection, ensureBinary idempotency, PID file lifecycle, stop ESRCH handling, touchLastQuery/checkIdleStop timing, zombie PID cleanup, status structure, CLI dispatch guard, and fail-open contracts for all 6 functions. 32 tests, all pass.

### Task 2: Wire lifecycle into nf-solve.cjs and update coderlm-adapter.cjs

**Commit:** `4c660ece`
**Files:** `bin/nf-solve.cjs`, `bin/coderlm-adapter.cjs`

**nf-solve.cjs changes:**
- Added `require('./coderlm-lifecycle.cjs')` import for `ensureRunning`, `touchLastQuery`, `checkIdleStop`
- Replaced `if (process.env.NF_CODERLM_ENABLED === 'true')` gate with `ensureRunning({ port: 8787, indexPath: ROOT })` call
- Added `touchLastQuery()` on successful health check to reset idle timer
- Added `checkIdleStop()` after autoClose to stop server if idle > 5 min
- Preserved all graph-driven wave ordering logic (queryEdgesSync, computeWavesFromGraph) unchanged
- Preserved outer try/catch and fallback to heuristic waves

**coderlm-adapter.cjs changes:**
- Changed default `enabled` from `process.env.NF_CODERLM_ENABLED === 'true'` to `true`
- Added comment documenting the change and that `enabled: false` override still works for testing

Formal verification (solve-convergence module): 200 pass, 0 fail. Full test suite: 1392 pass, 0 fail.

### Task 3: Create /nf:coderlm skill and update docs

**Commit:** `67302123`
**Files:** `commands/nf/coderlm.md`, `docs/coderlm-integration.md`

**Skill file** (`commands/nf/coderlm.md`):
- YAML frontmatter with `nf:coderlm` name, description, argument-hint, allowed-tools
- 4 subcommands: start, stop, status, update
- Each subcommand invokes `node bin/coderlm-lifecycle.cjs --{cmd}` and parses JSON output
- Help text displayed for missing/invalid argument

**Docs updates** (`docs/coderlm-integration.md`):
- Marked `NF_CODERLM_ENABLED` as DEPRECATED with migration note
- Added "Automatic Lifecycle (Recommended)" section with manual control commands
- Updated architecture diagram to include coderlm-lifecycle module
- Updated fallback behavior item 1: "Binary unavailable" replaces "Disabled"
- Added "Lifecycle Management" section: file locations, auto-download, idle timeout, exported functions
- Updated integration code example, API docs, and troubleshooting sections

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. `node bin/coderlm-lifecycle.cjs --status` -- returns valid JSON status object
2. `NF_CODERLM_ENABLED` not referenced as functional gate in nf-solve.cjs (only in comment)
3. `npm run test:ci` -- 1392 pass, 0 fail
4. `node --test bin/coderlm-lifecycle.test.cjs` -- 32 pass, 0 fail
5. `grep 'name: nf:coderlm' commands/nf/coderlm.md` -- matches
6. `ensureRunning`, `touchLastQuery`, `checkIdleStop` all referenced in nf-solve.cjs
7. Formal verification: 200 pass, 0 fail (solve-convergence module)
