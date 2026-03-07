---
phase: quick-213
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nForma.cjs
  - bin/generate-tui-assets.cjs
  - bin/generate-tui-assets.test.cjs
  - package.json
autonomous: true
requirements: [QUICK-213]
formal_artifacts: none

must_haves:
  truths:
    - "Running `node bin/nForma.cjs --screenshot agents` outputs ANSI text of the Agents module to stdout and exits"
    - "Running `node bin/nForma.cjs --screenshot reqs` outputs ANSI text of the Reqs module to stdout and exits"
    - "Running `node bin/generate-tui-assets.cjs` produces SVG files in docs/assets/ for each module"
    - "Running `npm run assets:tui` invokes generate-tui-assets.cjs successfully"
  artifacts:
    - path: "bin/generate-tui-assets.cjs"
      provides: "ANSI-to-SVG converter for TUI module screenshots"
      min_lines: 80
    - path: "docs/assets/tui-agents.svg"
      provides: "SVG screenshot of Agents module"
    - path: "docs/assets/tui-reqs.svg"
      provides: "SVG screenshot of Reqs module"
    - path: "docs/assets/tui-config.svg"
      provides: "SVG screenshot of Config module"
    - path: "docs/assets/tui-sessions.svg"
      provides: "SVG screenshot of Sessions module"
  key_links:
    - from: "bin/nForma.cjs"
      to: "stdout"
      via: "--screenshot <module> CLI flag"
      pattern: "--screenshot"
    - from: "bin/generate-tui-assets.cjs"
      to: "bin/nForma.cjs"
      via: "spawnSync with --screenshot flag"
      pattern: "spawnSync.*nForma.*--screenshot"
    - from: "package.json"
      to: "bin/generate-tui-assets.cjs"
      via: "npm script assets:tui"
      pattern: "assets:tui"
---

<objective>
Add headless TUI screenshot capability to nForma.cjs and create a script that generates SVG documentation assets from those screenshots.

Purpose: Automate generation of TUI documentation images so they stay in sync with the actual UI without manual screenshotting.
Output: 4 SVG files in docs/assets/ (one per module), npm script to regenerate them.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/nForma.cjs (TUI source — MODULES array, screen setup, switchModule, blessed usage)
@scripts/generate-terminal-svg.js (existing SVG generation pattern — Tokyo Night palette, layout constants, logo renderer)
@assets/terminal.svg (existing SVG template for terminal window chrome style)
@package.json (existing scripts section)
@.planning/formal/spec/tui-nav/invariants.md (TUI navigation invariants — EscapeProgress verified, no violations possible from read-only screenshot mode)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add --screenshot CLI mode to nForma.cjs</name>
  <files>bin/nForma.cjs</files>
  <action>
Add a `--screenshot <module>` CLI handler in the non-interactive CLI section (after `--reset-breaker`, before the TUI section at line ~57). This handler must:

1. Parse `--screenshot` flag and extract module name argument (agents, reqs, config, sessions — case-insensitive)
2. Map module name to MODULES index (0-3)
3. Create a blessed screen in headless mode: `blessed.screen({ smartCSR: true, input: devNull, output: devNull, fullUnicode: true, title: 'nForma' })` where devNull is `fs.createWriteStream('/dev/null')`. Set `screen.program.setupTput()` and `screen.program.zero = true` to suppress output.
4. Build the same UI widgets inline (header, activityBar, menuList, contentBox, statusBar) with the same dimensions/styles as the interactive mode — reuse the S palette object by extracting it above the CLI section.
5. Call switchModule(idx) logic inline: populate activityBar and menuList with the target module's items.
6. Call `screen.render()` then `process.stdout.write(screen.screenshot())` to output the ANSI representation.
7. Call `screen.destroy()` and `process.exit(0)`.

IMPORTANT: The --screenshot handler must exit before the interactive TUI loads (same pattern as --disable-breaker, --enable-breaker, --reset-breaker). It uses `process.exit(0)` to prevent the interactive screen from starting.

IMPORTANT: blessed.screen.screenshot() returns a string with ANSI escape codes representing the screen contents. This is the raw ANSI text that generate-tui-assets.cjs will convert to SVG.

NOTE: If blessed cannot create a screen without a TTY (common limitation), fall back to a simpler approach: export the MODULES array data and build a synthetic ANSI representation from the module items directly (menu items as colored text lines). The fallback should produce consistent output regardless of terminal availability.

TUI-nav invariant safety: --screenshot is read-only, exits immediately, does not modify depth or trigger EscapeUp/Select — no invariant violations possible.
  </action>
  <verify>
Run `node bin/nForma.cjs --screenshot agents 2>/dev/null | head -5` — should output text content (ANSI or plain) and exit with code 0.
Run `node bin/nForma.cjs --screenshot reqs 2>/dev/null | head -5` — should output different content than agents.
Run `echo $?` after each — should be 0.
  </verify>
  <done>
All four module names (agents, reqs, config, sessions) produce distinct ANSI/text output to stdout and exit cleanly with code 0. Invalid module names print usage and exit 1.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create generate-tui-assets.cjs ANSI-to-SVG converter and npm script</name>
  <files>bin/generate-tui-assets.cjs, bin/generate-tui-assets.test.cjs, package.json</files>
  <action>
Create `bin/generate-tui-assets.cjs` that:

1. Uses `'use strict'` and CommonJS (per coding-style rules).
2. Defines the MODULE_NAMES array: `['agents', 'reqs', 'config', 'sessions']`.
3. For each module, calls `spawnSync('node', ['bin/nForma.cjs', '--screenshot', name], { encoding: 'utf8', timeout: 10000 })` and captures stdout.
4. Implements an `ansiToSvg(ansiText, title)` function that:
   a. Strips ANSI escape codes to get plain text lines (regex: `/\x1b\[[0-9;]*[A-Za-z]/g`)
   b. Also parses ANSI color codes to extract foreground colors for each character span (map standard ANSI 30-37/90-97 and 256-color codes to hex colors using the Tokyo Night palette from generate-terminal-svg.js).
   c. Wraps the content in the same SVG terminal window chrome as assets/terminal.svg (dark background #1a1b26, title bar with traffic lights, rounded corners).
   d. Uses the same font family and sizing as generate-terminal-svg.js: `'SF Mono', 'Fira Code', 'JetBrains Mono', Consolas, monospace`, font-size 14, char-width 8.4px, line-height 22px.
   e. Sets the window title to "nForma - {Module Name}" (e.g., "nForma - Agents").
   f. Auto-sizes SVG height based on number of lines.
5. Writes each SVG to `docs/assets/tui-{name}.svg`.
6. Prints summary: `"Generated N TUI assets in docs/assets/"`.

Create `bin/generate-tui-assets.test.cjs` with tests:
- Test that `ansiToSvg` strips ANSI codes correctly (export it for testing).
- Test that `ansiToSvg` produces valid SVG structure (starts with `<svg`, contains `</svg>`).
- Test that ANSI color codes map to expected hex values.
- Test that the script handles empty/error output gracefully (fail-open: skip module, log warning).

Update `package.json` scripts section:
- Add `"assets:tui": "node bin/generate-tui-assets.cjs"`
- Update `"generate-assets"` to include the new script: `"npm run generate-terminal && npm run generate-logo && npm run assets:tui"`

Add the test file to the `test:ci` script list in package.json.
  </action>
  <verify>
Run `node bin/generate-tui-assets.cjs` — should produce 4 SVG files in docs/assets/.
Run `ls docs/assets/tui-*.svg | wc -l` — should output 4.
Run `head -3 docs/assets/tui-agents.svg` — should start with `<svg`.
Run `node --test bin/generate-tui-assets.test.cjs` — all tests pass.
Run `npm run assets:tui` — exits 0.
  </verify>
  <done>
Four SVG files exist at docs/assets/tui-agents.svg, docs/assets/tui-reqs.svg, docs/assets/tui-config.svg, docs/assets/tui-sessions.svg. Each contains valid SVG with terminal window chrome and module content. The npm script `assets:tui` runs successfully. Tests pass.
  </done>
</task>

</tasks>

<verification>
- `node bin/nForma.cjs --screenshot agents` exits 0 with ANSI output
- `node bin/nForma.cjs --screenshot invalid` exits 1 with usage message
- `node bin/generate-tui-assets.cjs` produces 4 SVG files in docs/assets/
- Each SVG file is valid XML starting with `<svg` and ending with `</svg>`
- `npm run assets:tui` works
- `node --test bin/generate-tui-assets.test.cjs` passes
- Existing tests still pass: `npm run test:ci`
</verification>

<success_criteria>
- Four TUI module SVG assets generated deterministically from live TUI code
- Screenshot CLI mode is non-interactive and exits cleanly
- SVG style matches existing terminal.svg aesthetic (Tokyo Night palette, monospace font, terminal chrome)
- No new npm dependencies added (zero-dependency constraint)
- All tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/213-automate-tui-asset-generation-with-headl/213-SUMMARY.md`
</output>
