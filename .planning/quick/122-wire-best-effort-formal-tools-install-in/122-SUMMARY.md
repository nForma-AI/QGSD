---
phase: quick-122
plan: 01
subsystem: installer
tags: [formal-tools, installer, best-effort, always-exit-0]
dependency_graph:
  requires: [quick-121]
  provides: [formal-tools-auto-run-on-install]
  affects: [bin/install.js, bin/install-formal-tools.cjs]
tech_stack:
  added: []
  patterns: [best-effort-spawn, always-exit-0]
key_files:
  created: []
  modified:
    - bin/install-formal-tools.cjs
    - bin/install.js
decisions:
  - "Best-effort means all failure paths in install-formal-tools.cjs call process.exit(0) — no conditional exit(1)"
  - "Formal tools block placed inside finishInstall() after Done banner, not at top-level — so --uninstall and --formal early-exit paths naturally bypass it"
  - "spawnSync exit code ignored intentionally — failures are non-blocking warnings to the user"
metrics:
  duration: 4m
  completed: 2026-02-28
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 122: Wire Best-Effort Formal Tools into Main Installer — Summary

**One-liner:** Best-effort formal tools block wired into `finishInstall()` after the Done banner; `install-formal-tools.cjs` now always exits 0 regardless of TLA+/Alloy/PRISM download result.

## What Was Done

### Task 1 — Make install-formal-tools.cjs always exit 0 (commit: ec14aaac)

Changed the exit-code block at the bottom of the async IIFE from a conditional `process.exit(1)` (when TLA+ or Alloy failed) to an unconditional `process.exit(0)`. Also updated the `.catch` handler from `process.exit(1)` to `process.exit(0)`. Updated the header comment from "Exits 0 if TLA+ and Alloy succeed; exits 1 if either fails." to "Always exits 0 — failures are non-blocking warnings."

**Files modified:** `bin/install-formal-tools.cjs`

### Task 2 — Inject best-effort formal tools run into finishInstall (commit: e8bb56d5)

Added a formal tools block inside `finishInstall()` in `bin/install.js`, after the Done/Join-community console.log. The block:
- Is guarded by `!hasUninstall && !hasFormal` (safety checks — those paths never reach finishInstall anyway)
- Uses `spawnSync(process.execPath, [formalScript], { stdio: 'inherit' })`
- Ignores the exit code (best-effort)
- Prints `Formal verification tools:` header before spawning

The `--formal` early-exit block (lines ~2346-2351) is unchanged — it remains a standalone retry shortcut using `process.exit(result.status ?? 0)`.

**Files modified:** `bin/install.js`

## Verification

All three smoke-test checks pass:
- `exit(1) in formal tools: false` — no process.exit(1) calls remain
- `Best-effort block present: true` — finishInstall() contains the block
- `--formal flag intact: true` — standalone retry shortcut unchanged

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | ec14aaac | fix(quick-122): make install-formal-tools.cjs always exit 0 |
| 2 | e8bb56d5 | feat(quick-122): inject best-effort formal tools into finishInstall |
