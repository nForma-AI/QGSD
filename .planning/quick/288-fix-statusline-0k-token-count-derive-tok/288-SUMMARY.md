---
phase: quick-288
plan: 01
type: summary
date: 2026-03-14
completed_by: claude-haiku-4-5-20251001
status: complete
duration: 8m
tasks_completed: 2
files_modified: 3
commits: 2
requirements: []
---

# Quick Task 288 Summary: Fix Statusline 0K Token Count

## One-liner

Fixed statusline 0K token display by deriving token count estimation from remaining_percentage when input_tokens is absent, enabling meaningful color thresholds even when exact counts are missing.

## Overview

The nForma statusline was displaying "0K" token count in the context window indicator whenever Claude Code's Notification hook payload omitted `current_usage.input_tokens`. This made all contexts appear green despite deepening consumption. The fix adds a fallback estimation formula `Math.round((used / 100) * 1_000_000)` that derives the token count from the available `remaining_percentage` field, allowing color thresholds (green <100K, yellow 100-200K, orange 200-350K, red 350K+) to work correctly even without exact counts.

## Tasks Completed

### Task 1: Fix Token Fallback in Source and Dist, Update TC2 Test

**Completed:** ✓

- Updated `/Users/jonathanborduas/code/QGSD/hooks/nf-statusline.js` line 48-49:
  ```javascript
  const inputTokens = data.context_window?.current_usage?.input_tokens
    ?? Math.round((used / 100) * 1_000_000);
  ```
  The `used` variable (computed from `remaining_percentage` on line 40) is multiplied by 10,000 to estimate tokens (treating 1M context as baseline).

- Copied source to dist: `cp hooks/nf-statusline.js hooks/dist/nf-statusline.js`

- Added TC2b test to `/Users/jonathanborduas/code/QGSD/hooks/nf-statusline.test.js` (inserted after TC2):
  - Payload: `remaining_percentage: 85` (15% used), no `current_usage`
  - Expected: "15%" in output, "150K" estimated token label (15% of 1M), yellow ANSI code `\x1b[33m`
  - Test passes, confirming estimation and color selection work correctly

**Verification:**
```
✔ TC1: minimal payload includes model name and directory name
✔ TC2: context at 100% remaining shows all-empty bar at 0%
✔ TC2b: 15% used without current_usage shows estimated 150K in yellow
✔ TC3: 80% used with 400K tokens shows blinking red
✔ TC4: 49% used with 50K tokens shows green
✔ TC5: 64% used with 150K tokens shows yellow
✔ TC6: malformed JSON input exits 0 with empty stdout (silent fail)
✔ TC7: update available banner shows /nf:update in output
✔ TC8: in-progress task is shown in statusline output

9 tests passed, 0 failed
```

**Commit:** `38972afb` — feat(quick-288): Fix 0K token count fallback in statusline

### Task 2: Install Updated Hook Globally

**Completed:** ✓

- Ran: `node bin/install.js --claude --global --force-statusline`
- Installer copied `hooks/dist/nf-statusline.js` to `~/.claude/hooks/nf-statusline.js`
- Verified installed hook contains fallback expression via: `grep -n "Math.round.*used.*1_000_000" ~/.claude/hooks/nf-statusline.js`
- Result: Line 49 in installed hook contains the fallback formula

**Commit:** `6408e839` — chore(quick-288): Install updated statusline hook globally

## Files Modified

| File | Changes | Status |
|------|---------|--------|
| `hooks/nf-statusline.js` | Lines 48-49: Added `?? Math.round((used / 100) * 1_000_000)` fallback | ✓ |
| `hooks/nf-statusline.test.js` | Added TC2b test for 15% used without current_usage → 150K yellow | ✓ |
| `hooks/dist/nf-statusline.js` | Synced copy of source (via `cp`) | ✓ (gitignored, installed) |
| `~/.claude/hooks/nf-statusline.js` | Installed hook with fallback | ✓ |

## Verification Results

**Plan Requirement 1:** ✓ All tests pass (TC1–TC8 plus new TC2b)
```
node --test hooks/nf-statusline.test.js → 9 passed
```

**Plan Requirement 2:** ✓ All three files contain fallback
```
grep -n "Math.round.*used.*1_000_000" {source, dist, installed} → line 49 in each
```

**Plan Requirement 3:** ✓ No regressions
- TC3–TC5 (exact `input_tokens` paths) remain unchanged
- Color thresholds still work correctly with explicit counts
- Fallback only activates when `input_tokens` is undefined

## Deviations from Plan

None. Plan executed exactly as written.

## Key Decisions

1. **Estimation formula:** `Math.round((used / 100) * 1_000_000)` treats remaining_percentage directly: used=15 → 150,000 tokens. This is a reasonable approximation assuming ~1M context window capacity.

2. **Test placement:** TC2b inserted immediately after TC2 (line 67) for logical grouping of edge cases.

3. **Installation flag:** Used `--force-statusline` to override the "already configured" skip, ensuring the updated source is deployed to the live hook location.

## Success Criteria Met

- [x] Source, dist, and installed hook all contain percentage-based token estimation fallback
- [x] Test suite passes with TC2b confirming non-zero token label when `input_tokens` is absent and context is partially consumed
- [x] No regressions in TC3–TC5 (exact `input_tokens` paths remain unchanged)

## Metrics

| Metric | Value |
|--------|-------|
| Duration | 8 minutes |
| Tasks Completed | 2 |
| Files Modified | 3 (+ 1 installed) |
| Test Coverage | 9 tests (8 existing + 1 new) |
| Commits | 2 |
| Regression Tests | 0 failures |

---

**Completed:** 2026-03-14 at 1:30 PM
**Executor:** claude-haiku-4-5-20251001
