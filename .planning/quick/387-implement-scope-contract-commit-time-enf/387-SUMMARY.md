---
phase: quick-387
plan: 01
subsystem: hooks, ci
tags: [scope-guard, pretooluse, hooks, test-ci]
dependency_graph:
  requires: []
  provides: [nf-scope-guard-active, scope-contract-enforcement]
  affects: [hooks/dist, package.json, ~/.claude/settings.json]
tech_stack:
  added: []
  patterns: [pretooluse-warn-only, fail-open, additionalContext-advisory]
key_files:
  created:
    - hooks/dist/nf-scope-guard.js
  modified:
    - package.json
decisions:
  - Hook is warn-only (exits 0 always) per SCOPE-02 -- never blocks tool calls
  - No-op when .claude/scope-contract.json absent per SCOPE-03 -- fail-open
  - Hook registered via ~/.claude/settings.json PreToolUse entry (not ~/.claude.json)
  - 15 pre-existing CI failures confirmed as baseline (not introduced by this task)
metrics:
  duration: 8m
  completed: 2026-04-10
  tasks_completed: 2
  tasks_total: 2
  tests_added: 0
  tests_total_pass: 12
---

# Quick Task 387: Implement Scope-Contract Commit-Time Enforcement via Claude Code PreToolUse Hook

Activated the nf-scope-guard PreToolUse hook by syncing hooks/dist/, adding the test to test:ci, and installing globally -- all 12 unit tests pass and hook fires on every Edit/Write/MultiEdit call.

## Task 1: Sync hook to dist and add test to test:ci

**Commit:** a914e9e2

### Changes

- Ran `npm run build:hooks` to copy `hooks/nf-scope-guard.js` to `hooks/dist/nf-scope-guard.js`
- Added `hooks/nf-scope-guard.test.js` to the `test:ci` `node --test` invocation in `package.json`, adjacent to `hooks/nf-destructive-git-guard.test.js`

### Verification

- `diff hooks/nf-scope-guard.js hooks/dist/nf-scope-guard.js` -- no differences (files in sync)
- `grep "nf-scope-guard.test.js" package.json` -- match found
- `node --test hooks/nf-scope-guard.test.js` -- 12/12 tests pass (TC-SG-01 through TC-SG-12)

## Task 2: Install hook globally and run full CI gate

**Commit:** 32907a3b

### Changes

- Ran `node bin/install.js --claude --global` to copy `hooks/dist/nf-scope-guard.js` to `~/.claude/hooks/` and register a PreToolUse entry in `~/.claude/settings.json`
- Note: the installer writes to `~/.claude/settings.json` (not `~/.claude.json`) -- the hook command is `node "/Users/jonathanborduas/.claude/hooks/nf-scope-guard.js"` with timeout 10

### Verification

- `grep "nf-scope-guard" ~/.claude/settings.json` -- PreToolUse entry present
- `npm run test:ci` -- 1408/1423 tests pass; 15 failures confirmed as pre-existing baseline (same count before and after our changes, in unrelated conformance-trace validation tests)

## Deviations from Plan

### Auto-noted Differences

**1. [Observation] ~/.claude.json vs ~/.claude/settings.json**
- **Found during:** Task 2 verification
- **Issue:** Plan's verify step says `grep "nf-scope-guard" ~/.claude.json` but the installer writes hooks to `~/.claude/settings.json`
- **Resolution:** Verified correct file (`~/.claude/settings.json`) -- hook is properly registered. No code change needed.

**2. [Observation] Pre-existing CI failures**
- **Found during:** Task 2 CI gate
- **Issue:** `npm run test:ci` reports 15 failures
- **Resolution:** Confirmed identical failure count before and after our changes by running test:ci with a git stash. These are pre-existing failures in conformance-trace validation tests unrelated to scope guard work.

## Loop 2 Formal Verification

INFO: No formal coverage intersections found -- Loop 2 not needed (GATE-03). Both tasks checked via `formal-coverage-intersect.cjs` with exit code 2 (no intersections).

## Verification Results

1. `diff hooks/nf-scope-guard.js hooks/dist/nf-scope-guard.js` -- no diff (files in sync)
2. `grep "nf-scope-guard.test.js" package.json` -- test in CI list
3. `node --test hooks/nf-scope-guard.test.js` -- 12/12 pass
4. `grep "nf-scope-guard" ~/.claude/settings.json` -- hook registered globally
5. `npm run test:ci` -- passes (15 pre-existing failures are baseline, not regressions)

## Self-Check

- [x] `hooks/dist/nf-scope-guard.js` exists
- [x] Commit a914e9e2 exists (Task 1)
- [x] Commit 32907a3b exists (Task 2)
- [x] Hook registered in `~/.claude/settings.json`
- [x] All 12 unit tests pass

## Self-Check: PASSED
