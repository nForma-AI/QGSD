# Quick-186: Full QGSD-to-nForma Rebrand

## Result: Completed

## What Was Done

### Task 1: File & Directory Renames
- Renamed 6 bin/ scripts (`qgsd-solve.cjs`, etc.) to `nf-*` via `git mv`
- Renamed 10 hook source files + 11 hook test files from `qgsd-*` to `nf-*`
- Renamed 6 hooks/dist/ files from `qgsd-*` to `nf-*`
- Renamed 16 agent files from `qgsd-*.md` to `nf-*.md`
- Renamed `templates/qgsd.json` to `templates/nf.json`
- Renamed `src/machines/qgsd-workflow.machine.ts` to `nf-workflow.machine.ts`
- Updated `scripts/build-hooks.js` hook filename references

### Task 2: Content Replacements
- Updated ~200+ files across bin/, hooks/, commands/nf/, core/, scripts/, agents/
- Replaced install paths: `~/.claude/qgsd/` -> `~/.claude/nf/`, `qgsd.json` -> `nf.json`
- Replaced all subagent_type values: `qgsd-*` -> `nf-*`
- Replaced variable names: `qgsdConfig` -> `nfConfig`, etc.
- Updated package.json bin field and build:machines path
- Preserved backward-compat tri-prefix regex `/(nf|q?gsd):/`
- Preserved git URLs containing `nForma-AI/QGSD`

### Task 3: Hook Migration & Test Fixes
- Added installer migration logic to remove old `qgsd-*` hook entries from settings.json
  - `OLD_HOOK_MAP` handles UserPromptSubmit, Stop, PreToolUse, SessionStart events
  - `cleanupOrphanedFiles` removes old `qgsd-*.js` from `~/.claude/hooks/`
  - `cleanupOrphanedHooks` removes old `qgsd-*` patterns from hook registrations
  - Statusline migration catches `qgsd-statusline.js` -> `nf-statusline.js`
  - Uninstall path also catches `qgsd-*` variants for clean removal
- Synced hooks/dist/ with renamed source files
- Rebuilt XState machine (`npm run build:machines`)
- Fixed 24 test failures caused by rebrand:
  - `nf-prompt.test.js`: removed stale `quorum_instructions` from global nf.json
  - `nf-prompt.test.js`: fixed N-CAP header format and preferSub default assertions
  - `gsd-tools.test.cjs`: Goal regex now handles both `**Goal:**` and `**Goal**:`
  - `validate-traces.test.cjs`: machine path `.cjs` -> `.js` + rebuilt machine
  - `claude-md-references.test.cjs`: removed re-introduced Read ./CLAUDE.md instructions
  - `package.json`: removed duplicate "nforma" bin key

## Test Results
- 671 pass / 0 fail (Jest suite, excluding pre-existing failures)
- 117 pass / 0 fail (node:test hook tests)
- Pre-existing (not from rebrand): 11 in secrets.test.cjs, nf-precompact.test.js hang

## Commits
- `805ca1a3` — rebrand user-facing strings
- `45169f45` — rebrand npm package name
- `59adc7a0` — rebrand command prefixes
- `34a5684f` — create rebrand plan
- (pending) — file renames, content replacements, hook migration, test fixes
