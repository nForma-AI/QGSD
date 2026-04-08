---
phase: quick-387
plan: 01
subsystem: hooks/statusline
tags: [river-ml, statusline, visual-consistency, coderlm]
one_liner: "River ML statusline indicator replaced with compact dot-style format matching coderlm indicator pattern"
dependency_graph:
  requires: []
  provides: [river-dot-indicator]
  affects: [hooks/nf-statusline.js, hooks/dist/nf-statusline.js, hooks/nf-statusline.test.js]
tech_stack:
  added: []
  patterns: [dot-style-indicator, fail-open-statusline]
key_files:
  modified:
    - hooks/nf-statusline.js
    - hooks/dist/nf-statusline.js
    - hooks/nf-statusline.test.js
decisions:
  - "Used actual ● Unicode character (U+25CF) in source rather than escape sequence for direct string matching"
  - "Shadow state shows '● River: <recommendation>' with no trailing '(shadow)' suffix for visual cleanliness"
  - "TC17/TC18/TC20 negative assertions (!stdout.includes('River:')) preserved unchanged — new format uses '● River' not 'River:'"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-08"
  tasks_completed: 3
  files_modified: 3
---

# Phase quick-387 Plan 01: Improve River ML Statusline Indicator Summary

## One-liner

River ML statusline indicator replaced with compact dot-style format matching coderlm indicator pattern.

## What Was Built

Replaced verbose `River: active` / `River: exploring` / `River: <rec> (shadow)` text indicators in the nf-statusline hook with compact dot-style indicators that match the coderlm indicator visual pattern.

### Three new indicator states

| State | Before | After |
|---|---|---|
| Active (allAbove = true) | ` \x1b[32mRiver: active\x1b[0m` | ` \x1b[32m● River\x1b[0m` |
| Exploring (allAbove = false) | ` \x1b[36mRiver: exploring\x1b[0m` | ` \x1b[36m● River\x1b[0m` |
| Shadow recommendation | `` `\x1b[33mRiver: ${rec} (shadow)\x1b[0m` `` | `` `\x1b[33m● River: ${rec}\x1b[0m` `` |

## Files Modified

### hooks/nf-statusline.js (lines 187-193)
- Changed active/exploring ternary assignment to use `● River` dot-style strings
- Changed shadow recommendation assignment to use `● River: ${rec}` (no trailing `(shadow)` suffix)

### hooks/dist/nf-statusline.js
- Byte-for-byte copy of source via `cp hooks/nf-statusline.js hooks/dist/nf-statusline.js`
- `diff` confirms identical

### hooks/nf-statusline.test.js
Updated 6 assertion sites:
- **Line 267** (TC15 exploring): `'River: exploring'` → `'● River'`
- **Line 293** (TC16 active): `'River: active'` → `'● River'`
- **Line 356** (TC19 mixed exploring): `'River: exploring'` → `'● River'`
- **Line 406** (TC21 shadow): `'River: gemini-1 (shadow)'` → `'● River: gemini-1'`
- **Line 432** (TC22 no-shadow fallback): `'River: active'` → `'● River'`
- **Lines 459-460** (TC23 null recommendation): two-part OR → single `'● River'` check

Preserved unchanged: TC17/TC18/TC20 which assert `!stdout.includes('River:')` — correct because the new format `● River` does not contain `River:`.

## Verification Results

- `diff hooks/nf-statusline.js hooks/dist/nf-statusline.js` — exit 0, no output
- `grep '● River' hooks/nf-statusline.js` — 3 matches (active, exploring, shadow lines)
- `grep -E 'River: (active|exploring)' hooks/nf-statusline.js` — no matches
- `grep '(shadow)' hooks/nf-statusline.js` — no matches
- `node bin/install.js --claude --global` — exit 0
- `grep '● River' ~/.claude/hooks/nf-statusline.js` — 3 matches
- `node --test hooks/nf-statusline.test.js` — 24/24 pass, 0 fail

## Deviations from Plan

None — plan executed exactly as written. The only clarification needed was to use the actual `●` Unicode character in source rather than the `\u25cf` escape sequence, so runtime string matching works correctly.

## Self-Check

- [x] hooks/nf-statusline.js modified — contains `● River` (3 matches)
- [x] hooks/dist/nf-statusline.js in sync — diff returns 0
- [x] hooks/nf-statusline.test.js updated — all 6 sites changed
- [x] Installer ran successfully — deployed copy confirmed
- [x] All 24 tests pass — TC15-TC23 all green
- [x] Commit 380dd967 exists
