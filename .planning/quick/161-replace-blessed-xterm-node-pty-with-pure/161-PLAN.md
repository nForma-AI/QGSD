---
phase: quick
plan: 161
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nforma.cjs
  - bin/blessed-terminal.cjs
  - package.json
autonomous: true
formal_artifacts: none
requirements:
  - QUICK-161

must_haves:
  truths:
    - "nforma TUI launches without node-pty ABI mismatch errors on any Node.js version"
    - "Sessions module spawns Claude subprocess and displays output in blessed terminal widget"
    - "Keyboard input in a connected session reaches the Claude subprocess stdin"
    - "Session lifecycle (create, connect, disconnect, kill, exit event) works identically to before"
    - "blessed-xterm and node-pty are no longer in the dependency tree"
  artifacts:
    - path: "bin/blessed-terminal.cjs"
      provides: "Drop-in BlessedTerminal widget replacing blessed-xterm, using @xterm/headless + child_process.spawn"
      min_lines: 200
    - path: "bin/nforma.cjs"
      provides: "Updated TUI using BlessedTerminal instead of blessed-xterm XTerm"
    - path: "package.json"
      provides: "Deps: +@xterm/headless, -blessed-xterm"
  key_links:
    - from: "bin/nforma.cjs"
      to: "bin/blessed-terminal.cjs"
      via: "require('./blessed-terminal.cjs')"
      pattern: "require.*blessed-terminal"
    - from: "bin/blessed-terminal.cjs"
      to: "@xterm/headless"
      via: "require('@xterm/headless')"
      pattern: "require.*@xterm/headless"
    - from: "bin/blessed-terminal.cjs"
      to: "child_process.spawn"
      via: "spawn(shell, args, { stdio: 'pipe' })"
      pattern: "spawn\\("
---

<objective>
Replace blessed-xterm (which depends on node-pty, a native C++ addon causing ABI mismatch errors across Node.js versions) with a pure-JS terminal widget built on @xterm/headless + child_process.spawn.

Purpose: Eliminate native addon dependency that breaks on Node.js upgrades, making nforma portable across Node versions without recompilation.
Output: New `bin/blessed-terminal.cjs` widget module, updated `bin/nforma.cjs`, updated `package.json`.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@bin/nforma.cjs (lines 56-57, 165-345 — XTerm usage and session lifecycle)
@package.json (dependencies section)

Formal invariants (tui-nav): EscapeProgress verified — ESC always decreases depth.
This task does NOT affect navigation depth or ESC handling (those use blessed keybindings, not the terminal widget).
No formal artifacts need creation or modification.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create BlessedTerminal widget (blessed-terminal.cjs)</name>
  <files>bin/blessed-terminal.cjs, package.json</files>
  <action>
1. Add `@xterm/headless` (latest v6.x) to package.json dependencies. Remove `blessed-xterm` from dependencies. Run `npm install`.

2. Create `bin/blessed-terminal.cjs` — a drop-in replacement for blessed-xterm's XTerm widget. This module exports a class `BlessedTerminal` that extends `blessed.Box` and provides the EXACT same API surface used by nforma.cjs:

**Constructor options (pass-through to blessed.Box):** top, left, right, bottom, border, style, label, tags. Terminal-specific options: `shell` (string, executable name), `args` (string[]), `cwd` (string), `cursorType` (ignored — blessed has no cursor), `scrollback` (number, passed to @xterm/headless Terminal), `ignoreKeys` (string[] — key names to NOT forward to subprocess).

**Methods:**
- `show()` / `hide()` — inherited from blessed.Box (no override needed)
- `focus()` — inherited from blessed.Box (no override needed, but must also start input routing)
- `terminate()` — kills the child process (child.kill('SIGTERM'), then SIGKILL after 2s timeout)

**Events:**
- `'exit'` — emitted when child process exits (with code, signal args)

**Internal architecture:**

a) **@xterm/headless Terminal** — `const { Terminal } = require('@xterm/headless')`. Create with `{ cols, rows, scrollback, allowProposedApi: true }`. This handles all VT100/ANSI escape sequence parsing and maintains a character buffer.

b) **child_process.spawn** — spawn the shell process with `stdio: 'pipe'`. Set env vars: `FORCE_COLOR=1`, `TERM=xterm-256color`, `COLUMNS=cols`, `LINES=rows`. Pipe `child.stdout` and `child.stderr` into `term.write()` (the @xterm/headless terminal). Listen for `child.on('exit', (code, signal) => this.emit('exit', code, signal))`.

c) **Input routing** — Listen on `this.screen.program.input` for `'data'` events. When this widget `isFocused()`, write data to `child.stdin`. Implement `ignoreKeys` by listening on `this.screen` for `'keypress'` and setting a skip flag (matching blessed-xterm's `skipInputDataOnce` pattern).

d) **render() override** — Override `render()` to bridge @xterm/headless buffer to blessed screen lines. The algorithm:
   - Call `super.render()` to get blessed box positioning (this.ileft, this.itop, this.width, this.height)
   - Get the xterm active buffer: `const buf = this._term.buffer.active`
   - For each row y (0 to rows-1) and col x (0 to cols-1):
     - `const line = buf.getLine(y + buf.viewportY)`
     - If no line, write blank
     - `const cell = line.getCell(x)` (reuse a CellData object for perf)
     - Get char: `cell.getChars() || ' '`
     - Map colors: use `cell.isFgDefault()` / `cell.isFgPalette()` / `cell.isFgRGB()` with `cell.getFgColor()` to determine fg. Same for bg. Default fg=257, default bg=256 in blessed's sattr scheme.
     - For palette colors (0-255): use directly as blessed color index
     - For RGB colors: find nearest 256-color index (simple mapping: use the 6x6x6 cube + grayscale ramp formula)
     - Get attributes: `cell.isBold()` → flags bit 0, `cell.isUnderline()` → flags bit 1, `cell.isBlink()` → flags bit 2, `cell.isInverse()` → flags bit 3
     - Write to blessed: `this.screen.lines[screenY][screenX] = [blessed.helpers.sattr({bold, underline, blink, inverse}, fg, bg), cell.getChars() || ' ']` — BUT the actual format is `((flags << 18) | (fg << 9) | bg)` as a numeric sattr value. Use `blessed.Element.sattr()` if available, or compute directly.
   - Mark screen lines dirty: `this.screen.lines[screenY].dirty = true`

e) **Resize handling** — On blessed `'resize'` event, update `this._term.resize(newCols, newRows)`. If using a real PTY this would need SIGWINCH, but with piped stdio, just resize the xterm terminal (the child process may not respond to column changes, which is acceptable for Claude CLI output).

f) **Cleanup** — On widget `'destroy'` event, kill child process, dispose xterm terminal, remove input listener.

IMPORTANT NOTES:
- @xterm/headless v6 uses `import()` — but we need CommonJS. Check if `require('@xterm/headless')` works. If not, use dynamic `import()` wrapped in an async init. The constructor can defer spawn until the terminal is ready. OR check if v5.x supports CJS require (v5.5.0 has CJS). Use whichever version supports `require()` — test this during npm install.
- blessed screen.lines format: each line is an array of `[attr, char]` pairs where attr is the numeric sattr. Confirm by inspecting `this.screen.lines[0][0]` at runtime.
- The CellData API requires `allowProposedApi: true` in Terminal options.
  </action>
  <verify>
- `node -e "require('./bin/blessed-terminal.cjs')"` loads without error
- `node -e "const { Terminal } = require('@xterm/headless'); const t = new Terminal({cols:80,rows:24,allowProposedApi:true}); t.write('hello'); console.log('OK')"` works
- `npm ls blessed-xterm` shows empty (not installed)
- `npm ls @xterm/headless` shows installed version
  </verify>
  <done>
BlessedTerminal class exists in bin/blessed-terminal.cjs, exports a blessed.Box subclass with terminate() method and 'exit' event. @xterm/headless is installed, blessed-xterm is removed from dependencies.
  </done>
</task>

<task type="auto">
  <name>Task 2: Integrate BlessedTerminal into nforma.cjs and verify end-to-end</name>
  <files>bin/nforma.cjs</files>
  <action>
1. In `bin/nforma.cjs`, replace line 57:
   - FROM: `const XTerm = require('blessed-xterm');`
   - TO: `const BlessedTerminal = require('./blessed-terminal.cjs');`

2. In `createSession()` function (line 252), replace `new XTerm({...})` with `new BlessedTerminal({...})`. The constructor options are identical — shell, args, cwd, cursorType, scrollback, top, left, right, bottom, border, style, label, tags, ignoreKeys all pass through unchanged.

3. Verify the rest of the session lifecycle code needs NO changes — it only calls `.hide()`, `.show()`, `.focus()`, `.terminate()` and listens for `'exit'` event, all of which BlessedTerminal provides.

4. Run `node bin/nforma.cjs --help` or a quick smoke test to confirm the TUI loads without error. The circuit breaker CLI flags (--disable-breaker, --enable-breaker, --reset-breaker) should still work since they exit before the TUI loads.

5. Run `npm uninstall blessed-xterm` if not already done in Task 1 to ensure node-pty is fully removed from node_modules.

6. Verify no other files in the repo reference `blessed-xterm` — grep for it. If found in tests, update those references too.
  </action>
  <verify>
- `grep -r 'blessed-xterm' bin/ --include='*.cjs' --include='*.js'` returns nothing
- `grep -r 'node-pty' node_modules/ --include='package.json' -l 2>/dev/null | wc -l` returns 0
- `node bin/nforma.cjs --reset-breaker` succeeds (CLI path works)
- `node -e "require('./bin/nforma.cjs')"` does not throw (requires blessed, which needs a TTY — may need to test differently)
  </verify>
  <done>
nforma.cjs uses BlessedTerminal instead of blessed-xterm. No references to blessed-xterm or node-pty remain in the codebase dependencies. The CLI flags (--disable-breaker, --enable-breaker, --reset-breaker) continue to work. The TUI can launch without native addon errors on any Node.js version.
  </done>
</task>

</tasks>

<verification>
1. `npm ls` shows @xterm/headless in deps, no blessed-xterm or node-pty
2. `node -e "require('./bin/blessed-terminal.cjs')"` loads cleanly
3. `node bin/nforma.cjs --reset-breaker` executes the CLI path successfully
4. No grep hits for `blessed-xterm` in bin/ or package.json
5. Interactive test: run `node bin/nforma.cjs`, navigate to Sessions module, create a new session — should spawn Claude and display output (human verification if available)
</verification>

<success_criteria>
- blessed-xterm and node-pty are completely removed from the dependency tree
- @xterm/headless is the terminal emulation backend
- child_process.spawn replaces node-pty for process spawning
- All 4 session lifecycle operations (create/connect/disconnect/kill) work with the new widget
- nforma TUI launches without native addon errors on the current Node.js version
</success_criteria>

<output>
After completion, create `.planning/quick/161-replace-blessed-xterm-node-pty-with-pure/161-SUMMARY.md`
</output>
