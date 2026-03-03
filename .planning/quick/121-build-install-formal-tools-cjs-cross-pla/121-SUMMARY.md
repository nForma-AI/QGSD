---
phase: quick-121
plan: 01
subsystem: installer
tags: [formal-verification, installer, cross-platform, tooling]
dependency_graph:
  requires: []
  provides: [bin/install-formal-tools.cjs, --formal flag in bin/install.js]
  affects: [VERIFICATION_TOOLS.md, README.md, docs/]
tech_stack:
  added: []
  patterns: [Node.js built-ins only (https/fs/path/os/child_process/zlib), idempotent installer, soft-warning pattern]
key_files:
  created:
    - bin/install-formal-tools.cjs
    - docs/QUORUM_CONSENSUS.md
    - docs/quorum_interface.md
  modified:
    - bin/install.js
    - VERIFICATION_TOOLS.md
    - README.md
decisions:
  - "PRISM failure is non-blocking: TLA+ and Alloy are the exit-code gates; PRISM failure prints a warning and continues"
  - "Java check is soft-warning only: never blocks install, contributor decides whether to upgrade"
  - "Zero npm dependencies: script uses only Node.js built-ins to keep it portable and installable on a fresh clone"
metrics:
  duration: ~10 min
  completed: 2026-02-28
  tasks_completed: 2
  files_created: 3
  files_modified: 3
---

# Quick Task 121: Build install-formal-tools.cjs cross-platform installer — Summary

**One-liner:** Idempotent Node.js installer (no npm deps) for TLA+, Alloy, and PRISM wired into bin/install.js via --formal flag with updated prereq docs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create bin/install-formal-tools.cjs | 3ea0caec | bin/install-formal-tools.cjs |
| 2 | Wire --formal flag into bin/install.js and update docs | e765606c | bin/install.js, VERIFICATION_TOOLS.md, README.md, docs/QUORUM_CONSENSUS.md, docs/quorum_interface.md |

## What Was Built

### bin/install-formal-tools.cjs

A 276-line CommonJS script using only Node.js built-ins that:

- **Java check (soft warning):** Calls `java -version`, parses major version from stderr, warns if < 17 or not found — never blocks.
- **TLA+ install:** Downloads `tla2tools.jar` from the TLA+ GitHub releases page to `.formal/tla/`. Skips with an arrow if already present.
- **Alloy install:** Downloads `org.alloytools.alloy.dist.jar` from the Alloy GitHub releases page to `.formal/alloy/`. Skips with an arrow if already present.
- **PRISM install (non-blocking):** Skips if `PRISM_BIN` env is set and file exists. Otherwise downloads platform-specific tarball/installer (darwin/linux/win32), extracts, runs `install.sh`, removes quarantine attribute on macOS, prints `PRISM_BIN` export suggestion.
- **Petri nets:** Prints skip message (bundled via npm).
- **Summary table:** Prints results with color-coded status (installed / skipped / failed).
- **Exit code:** 0 if TLA+ and Alloy both non-fail; 1 otherwise. PRISM failure is non-blocking.

### bin/install.js changes

Three changes:
1. `const hasFormal = args.includes('--formal');` added after `hasMigrateSlots`
2. Dispatch block after `hasMigrateSlots` block: spawnSyncs `install-formal-tools.cjs` and passes through its exit code
3. `--formal` added to the help text options list

### Documentation updates

- **VERIFICATION_TOOLS.md:** Replaced "Shared Prerequisite: Java 17" section with a "Prerequisites" section that leads with the install script command, retains all per-tool sections below.
- **README.md:** Updated formal verification Prerequisites table from manual `curl` instructions to one-step `node bin/install-formal-tools.cjs` command with a quick summary table showing auto-download for TLA+/Alloy.
- **docs/QUORUM_CONSENSUS.md:** Moved from repo root to `docs/` (no content change).
- **docs/quorum_interface.md:** Moved from repo root to `docs/` (no content change).

## Verification Results

```
node bin/install-formal-tools.cjs   # exits 0 (jars present → skip arrows, PRISM configured → skip)
node bin/install.js --formal        # dispatches to installer, exits 0
grep "install-formal-tools" README.md           # found
grep "install-formal-tools" VERIFICATION_TOOLS.md  # found
ls docs/QUORUM_CONSENSUS.md docs/quorum_interface.md  # both present
ls QUORUM_CONSENSUS.md  # No such file (root copy removed)
ls quorum_interface.md  # No such file (root copy removed)
node --test bin/conformance-schema.test.cjs     # 12/12 pass
node --test hooks/qgsd-stop.test.js            # 32/32 pass
node scripts/lint-isolation.js                  # no interference found
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `bin/install-formal-tools.cjs` exists and is executable
- [x] `docs/QUORUM_CONSENSUS.md` exists
- [x] `docs/quorum_interface.md` exists
- [x] Root `QUORUM_CONSENSUS.md` removed
- [x] Root `quorum_interface.md` removed
- [x] Commit 3ea0caec exists (Task 1)
- [x] Commit e765606c exists (Task 2)
- [x] `VERIFICATION_TOOLS.md` references `install-formal-tools.cjs`
- [x] `README.md` references `install-formal-tools.cjs`
- [x] `bin/install.js --formal` dispatches to installer (exit 0 verified)
