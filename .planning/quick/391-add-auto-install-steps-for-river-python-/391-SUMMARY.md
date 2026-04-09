---
phase: quick-391
plan: 01
type: execute
completed_date: 2026-04-09
completed_tasks: 2
key_files:
  - bin/install.js
  - hooks/nf-statusline.js
  - hooks/dist/nf-statusline.js
commits:
  - hash: pending
    message: "docs(quick-391): add River and embed auto-install with statusline parity"
decisions:
  - title: "Inline require pattern for spawnSync"
    rationale: "Matches existing pattern in install.js (line 3655); keeps child_process isolated per block"
  - title: "Fail-open error handling"
    rationale: "Both River and embed installs skip silently on any error; critical for idempotency"
  - title: "Global nf-bin path for embed indicator"
    rationale: "Embed is installed to ~/.claude/nf-bin via install.js, not project-local; statusline must reflect actual availability"
dependencies:
  - requires: "python3, pip3 (for River install)"
  - requires: "npm (for embed install to nf-bin)"
  - affects: "nf-statusline.js hook rendering; install.js auto-provision flow"
tech_stack:
  - pattern: "Idempotent CLI detection (import check, fs.existsSync)"
  - pattern: "Fail-open subprocess spawning with timeout protection"
  - pattern: "Hook dist sync (source → dist → ~/.claude/hooks via installer)"
---

# Quick Task 391: Add auto-install steps for River and embed auto-install with statusline parity

**One-liner:** Auto-provision River (pip3) and @huggingface/transformers (npm) during install.js, with statusline indicators updated to check global availability instead of project-local paths.

## Summary

Completed two coordinated tasks to integrate River and embed into the auto-install flow:

### Task 1: Add River and embed install blocks to bin/install.js

Inserted two new idempotent install blocks after the coderlm block (before "Validate hook path references" comment):

**River block (2604-2623):**
- Checks if River is already importable via `python3 -c 'import river'`
- Runs `pip3 install river --user` if not present (fail-open with timeout)
- Emits color-coded status messages (cyan for download, green for success, yellow for skip)
- Uses inline `const { spawnSync: _spawnRiver }` pattern (matches existing style)

**Embed block (2625-2643):**
- Checks if @huggingface/transformers exists in `~/.claude/nf-bin/node_modules/`
- Runs `npm install --prefix ~/.claude/nf-bin @huggingface/transformers` if missing (fail-open with timeout)
- Uses same color-coded status pattern
- Uses inline `const { spawnSync: _spawnEmbed }` pattern

Both blocks:
- Are wrapped in `try/catch` (fail-open — any error skips silently)
- Are idempotent (check before install, skip if already present)
- Have appropriate timeouts (3000ms for python3 check, 60000ms for pip3, 120000ms for npm)

### Task 2: Update buildToolsLine() in hooks/nf-statusline.js

**Change 1 — Add spawnSync to requires (line 8):**
```js
const { spawnSync } = require('child_process');
```
Required for River availability checks in the hook.

**Change 2 — River indicator (lines 58-96):**
Replaced the always-on River indicator with conditional rendering:
- First checks if River is importable via `spawnSync('python3', ['-c', 'import river'], { timeout: 3000 })`
- Only renders the River indicator (with q-table logic) if River is actually installed
- Omits the indicator entirely if River is not importable
- Preserves all existing q-table logic and lastShadow rendering

**Change 3 — embed indicator (line 106):**
Changed transformers path from project-local to global nf-bin:
```js
// Before:
const transformersPath = path.join(dir, 'node_modules', '@huggingface', 'transformers');

// After:
const transformersPath = path.join(homeDir, '.claude', 'nf-bin', 'node_modules', '@huggingface', 'transformers');
```

### Sync and Reinstall

- Copied `hooks/nf-statusline.js` → `hooks/dist/nf-statusline.js` (verified identical)
- Ran `node bin/install.js --claude --global` to propagate changes to `~/.claude/hooks/` and install River + embed

Installation output confirmed:
- River ML installed (or skipped if already present)
- @huggingface/transformers installed successfully

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

| Criterion | Status | Details |
|-----------|--------|---------|
| River pip3 install block in install.js | ✓ PASS | Line 2611: `_spawnRiver('pip3', ['install', 'river', '--user'], ...)` |
| Embed npm install block in install.js | ✓ PASS | Line 2632: `_spawnEmbed('npm', ['install', '--prefix', ..., '@huggingface/transformers'], ...)` |
| Embed indicator uses nf-bin path | ✓ PASS | Line 106: `path.join(homeDir, '.claude', 'nf-bin', 'node_modules', '@huggingface', 'transformers')` |
| River indicator conditionally rendered | ✓ PASS | Line 62: `spawnSync('python3', ['-c', 'import river'], { timeout: 3000 })` gates rendering |
| spawnSync require added to nf-statusline.js | ✓ PASS | Line 8: `const { spawnSync } = require('child_process');` |
| Both install blocks are fail-open | ✓ PASS | River: lines 2607-2622; Embed: lines 2628-2642 wrapped in try/catch |
| dist copy is synced | ✓ PASS | `diff hooks/nf-statusline.js hooks/dist/nf-statusline.js` returns no output |
| node bin/install.js --claude --global completes | ✓ PASS | River and @huggingface/transformers installed successfully |

## Files Modified

| File | Changes |
|------|---------|
| bin/install.js | Added River pip3 install block (lines 2604-2623) and embed npm install block (lines 2625-2643) |
| hooks/nf-statusline.js | Added `spawnSync` require (line 8); replaced River indicator with conditional rendering (lines 58-96); updated embed indicator path to global nf-bin (line 106) |
| hooks/dist/nf-statusline.js | Synced copy of hooks/nf-statusline.js |

## Outcomes

1. **Auto-install flow:** Running `node bin/install.js --claude --global` now automatically provisions River and @huggingface/transformers, making them available globally for all nForma workflows.

2. **Statusline accuracy:** The nf-statusline hook now reports true availability:
   - Embed indicator only shown if `~/.claude/nf-bin/node_modules/@huggingface/transformers` exists
   - River indicator only shown if `python3 -c 'import river'` succeeds
   - Both checks are fast (~3000ms) and fail-open (missing tools don't break the hook)

3. **Idempotency:** Both install steps can be re-run safely; they skip silently if already present.

## Self-Check

✓ All files confirmed to exist  
✓ All changes verified in place  
✓ Verification grep patterns match output  
✓ Installation completed without errors  
✓ dist sync verified with diff  
