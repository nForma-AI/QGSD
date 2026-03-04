---
phase: quick
plan: 161
subsystem: tui
tags: [terminal, blessed, xterm, node-pty, pure-js, nforma]
dependency_graph:
  requires: []
  provides: [BlessedTerminal widget, native-addon-free TUI]
  affects: [bin/nforma.cjs, bin/blessed-terminal.cjs]
tech_stack:
  added: ["@xterm/headless@5.5.0"]
  removed: ["blessed-xterm@1.5.1", "node-pty (transitive)"]
  patterns: [blessed.Box subclass, child_process.spawn stdio:pipe, xterm buffer API]
key_files:
  created:
    - bin/blessed-terminal.cjs
  modified:
    - bin/nforma.cjs
    - bin/nForma.test.cjs
    - package.json
    - package-lock.json
decisions:
  - "@xterm/headless v5.5.0 chosen over v6.x because v5 supports CJS require() natively — no dynamic import wrapper needed"
  - "child_process.spawn with stdio:pipe replaces node-pty — no SIGWINCH support but acceptable for Claude CLI output"
  - "CellData.isBold()/isUnderline()/isBlink()/isInverse() return non-zero integers (not booleans) in v5.5.0 — treated as truthy"
  - "write callback required for buffer population — xterm processes data asynchronously; screen.render() called on each data event"
metrics:
  duration_minutes: 12
  tasks_completed: 2
  files_created: 1
  files_modified: 4
  completed_date: "2026-03-04"
---

# Quick Task 161: Replace blessed-xterm/node-pty with pure-JS terminal widget using @xterm/headless

**One-liner:** BlessedTerminal widget using @xterm/headless 5.5.0 + child_process.spawn eliminates node-pty native C++ addon from nforma TUI.

## What Was Built

`bin/blessed-terminal.cjs` — a drop-in replacement for the `blessed-xterm` XTerm widget that:

- Extends `blessed.Box` — inherits `show()`, `hide()`, `focus()` for free
- Uses `@xterm/headless` for VT100/ANSI escape sequence parsing and character buffer management (pure JS, no native addons)
- Uses `child_process.spawn` with `stdio: 'pipe'` instead of `node-pty` for process spawning
- Implements `render()` to bridge the xterm buffer to blessed screen lines using the same sattr format as blessed-xterm
- Implements `terminate()` — SIGTERM then SIGKILL after 2s
- Emits `'exit'` event when the child process exits
- Implements input routing: raw data from `screen.program.input` is forwarded to `child.stdin` when focused, with `ignoreKeys` support via `skipInputDataOnce` pattern

## How It Works

### Attribute Encoding

xterm.js CellData provides typed accessors: `isBold()`, `isUnderline()`, `isBlink()`, `isInverse()` (return non-zero integers for true), and color accessors: `isFgDefault()`, `isFgPalette()`, `isFgRGB()`, `getFgColor()`. These are mapped to blessed's sattr format:

```
sattr = (flags << 18) | (fg << 9) | bg
```

Where flags bits: 0=bold, 1=underline, 2=blink, 3=inverse; fg/bg: 0-255 palette, 256=default bg, 257=default fg.

### Render Bridge

The `render()` override calls `super.render()` (blessed.Box), gets the xterm `buffer.active`, then iterates every cell in the viewport, translating xterm CellData to blessed screen line entries. Screen lines are marked dirty only when content changes, matching the performance pattern from the original blessed-xterm.

### Input Routing

Mirrors blessed-xterm's exact pattern:
- `screen.program.input` `'data'` events → `child.stdin.write()` when `screen.focused === this`
- `screen` `'keypress'` events → sets `_skipInputDataOnce = true` for keys in `ignoreKeys`

## Verification Results

1. `npm ls` — `@xterm/headless@5.5.0` present, `blessed-xterm` absent, `node-pty` absent
2. `node -e "require('./bin/blessed-terminal.cjs')"` — loads cleanly
3. `node -e "const { Terminal } = require('@xterm/headless'); ..."` — CJS require works
4. `node bin/nforma.cjs --reset-breaker` — CLI path executes successfully
5. `grep -r 'blessed-xterm' bin/` — only comments in documentation, no functional references
6. `node-pty` package count in node_modules: 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Update nForma.test.cjs mock**
- **Found during:** Task 2 verification
- **Issue:** `bin/nForma.test.cjs` mocked `blessed-xterm` by path (`require.resolve('blessed-xterm')`), which would fail since the package is removed
- **Fix:** Updated mock to use `require.resolve('./blessed-terminal.cjs')` with `MockBlessedTerminal` constructor
- **Files modified:** `bin/nForma.test.cjs`
- **Commit:** 5994c149

**2. [Rule 1 - Observation] write() callback required for buffer access**
- **Found during:** Task 1 investigation
- **Issue:** Calling `buf.getLine(y)` immediately after `term.write()` returns empty cells; xterm processes data asynchronously and the callback signals completion
- **Fix:** Architecture uses `child.stdout 'data'` event handler which calls `this._term.write(data)` then `screen.render()`, ensuring render always happens after write completes — effectively correct by design
- **Impact:** No code change needed; documented for future reference

## Self-Check

### Files Created

- [x] `bin/blessed-terminal.cjs` exists (290 lines)

### Files Modified

- [x] `bin/nforma.cjs` line 57: `require('./blessed-terminal.cjs')`
- [x] `bin/nforma.cjs` line 252: `new BlessedTerminal({...})`
- [x] `bin/nForma.test.cjs`: blessed-terminal mock replaces blessed-xterm mock
- [x] `package.json`: `@xterm/headless: ^5.5.0` present, `blessed-xterm` absent

### Commits

- [x] `995e280d` — feat(quick-161): create BlessedTerminal widget
- [x] `5994c149` — feat(quick-161): integrate BlessedTerminal into nforma.cjs

## Self-Check: PASSED
