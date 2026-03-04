---
phase: quick-162
plan: 01
task-count: 2
completed: 2
date: 2026-03-04
commit: 39fc61e9
status: Completed
---

# Quick Task 162: Make sync-baselines Always Use Detect Mode by Default

**One-liner:** Auto-detect project intent by default when no flags given, remove --detect from CLI and simplify skill UX

## Overview

Successfully refactored sync-baselines tool to auto-detect project intent as the default behavior (rather than requiring an explicit `--detect` flag). The CLI now prioritizes: `--intent-file > --profile > config.json > AUTO-DETECT`. The skill definition was simplified to auto-detect-first UX with confirmation only when needed.

## Tasks Completed

### Task 1: Update CLI to auto-detect by default and simplify skill definition

**Status:** Completed

**Changes made:**

1. **CLI changes in `bin/sync-baseline-requirements.cjs`:**
   - Changed priority to: `--intent-file > --profile > config.json intent > config.json profile > AUTO-DETECT`
   - Removed the separate `if (args.includes('--detect'))` block
   - Added `--detect` flag stripping for backwards compatibility (silently ignored, no-op)
   - Replaced the "no profile found" error with auto-detect fallback using detectProjectIntent
   - Auto-detect now includes detection metadata in JSON output: `{ ...result, detection: detectionResult }`
   - Error message simplified to hint --profile as fallback instead of showing full usage

2. **Skill changes in `commands/qgsd/sync-baselines.md`:**
   - Updated description to emphasize auto-detect by default
   - Updated argument-hint to remove `[--detect]` (now just `[--profile ...]`)
   - Simplified objective to describe auto-detect-first approach
   - Rewrote process flow with 5 clear steps:
     - **Step 1:** Detect Intent (auto-detect unless --profile given)
     - **Step 2:** Confirm Intent (ask user only if needs_confirmation non-empty)
     - **Step 3:** Run Sync (with or without profile flag)
     - **Step 4:** Store Intent (if auto-detected)
     - **Step 5:** Commit if Needed (if any requirements added)

**Files modified:**
- `bin/sync-baseline-requirements.cjs`
- `commands/qgsd/sync-baselines.md`

**Verification:**
- CLI with no flags auto-detects without error: `node bin/sync-baseline-requirements.cjs --json` exits 0
- CLI with --profile override still works: `node bin/sync-baseline-requirements.cjs --profile cli --json` exits 0
- Skill no longer mentions `--detect` flag in argument-hint

### Task 2: Update tests for default auto-detect behavior

**Status:** Completed

**Changes made:**

1. **Added test infrastructure:**
   - Imported `execFileSync` from child_process for safe CLI testing

2. **Added 3 new CLI tests (Tests 19-21):**
   - **Test 19:** "CLI with no flags auto-detects and exits 0"
     - Creates temp project with package.json bin field (CLI detection)
     - Runs CLI with no flags and --json
     - Asserts output parses as JSON with added requirements
     - Asserts detection metadata included with base_profile === 'cli'

   - **Test 20:** "CLI --profile override bypasses auto-detect"
     - Creates temp project
     - Runs CLI with --profile cli and --json
     - Asserts output parses as JSON with added requirements
     - Asserts NO detection metadata (explicit profile mode)

   - **Test 21:** "CLI --detect flag accepted silently for backwards compat"
     - Creates temp project with package.json bin field
     - Runs CLI with --detect --json (deprecated flag)
     - Asserts exits 0 (no throw)
     - Asserts output parses as JSON with added requirements

**Files modified:**
- `bin/sync-baseline-requirements.test.cjs`

**Verification:**
- All 21 tests pass (18 existing + 3 new): `node --test bin/sync-baseline-requirements.test.cjs`
  - Test output: ℹ tests 21, ℹ pass 21, ℹ fail 0
  - All timing under 300ms total

## Success Criteria Met

- [x] Auto-detect is the default when no flags provided (exits 0, produces valid output)
- [x] --profile and --intent-file still work as explicit overrides
- [x] --detect is silently accepted (backwards compat, no error)
- [x] Skill definition uses auto-detect-first UX with confirmation only when changes exist
- [x] All 21 tests pass (18 existing + 3 new)
- [x] grep -c '\-\-detect' commands/qgsd/sync-baselines.md returns 0

## Key Links

- **CLI tool:** `bin/sync-baseline-requirements.cjs` — now auto-detects by default when no flags
- **Skill definition:** `commands/qgsd/sync-baselines.md` — simplified auto-detect-first UX
- **Test file:** `bin/sync-baseline-requirements.test.cjs` — 21 tests (3 new CLI tests)
- **Detection engine:** `bin/detect-project-intent.cjs` — unchanged, now called by default

## Deviations

None — plan executed exactly as written.

## Next Steps

The sync-baselines skill is now ready for users who want to auto-sync baseline requirements without specifying a profile. The tool intelligently detects project intent (web, mobile, desktop, api, cli, library) and syncs accordingly. Users can still override with --profile if needed.
