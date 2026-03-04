---
phase: quick-156
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - bin/nForma.cjs
  - bin/nForma.test.cjs
autonomous: false
requirements: [TUI-NAV]
formal_artifacts: none

must_haves:
  truths:
    - "F4 key switches to Sessions module showing 'New Session' menu item"
    - "Creating a new session launches an embedded Claude Code PTY terminal in the content area"
    - "Ctrl+backslash escapes terminal focus back to the menu list"
    - "F1/F2/F3 keys hide active terminal and switch to the respective module"
    - "Returning to Sessions via F4 reconnects to the last active terminal"
    - "Kill Session terminates the PTY and removes it from the session list"
    - "Tab/Shift-Tab cycling includes the Sessions module (4 modules total)"
    - "All existing 90 nForma tests continue to pass"
  artifacts:
    - path: "package.json"
      provides: "blessed-xterm dependency declaration"
      contains: "blessed-xterm"
    - path: "bin/nForma.cjs"
      provides: "Sessions module with embedded terminal lifecycle"
      contains: "blessed-xterm"
  key_links:
    - from: "bin/nForma.cjs (Sessions module)"
      to: "blessed-xterm XTerm widget"
      via: "require('blessed-xterm') + new XTerm()"
      pattern: "XTerm\\("
    - from: "bin/nForma.cjs (dispatch)"
      to: "session lifecycle functions"
      via: "action === 'session-new' / 'session-kill' / 'session-connect-'"
      pattern: "session-new|session-kill|session-connect"
    - from: "bin/nForma.cjs (switchModule)"
      to: "terminal show/hide"
      via: "activeSessionIdx check to hide/show terminal vs contentBox"
      pattern: "activeSessionIdx"
---

<objective>
Add a 4th "Sessions" module (F4) to nForma TUI that embeds interactive Claude Code terminal sessions using blessed-xterm. Users can create, switch between, and kill multiple PTY-backed Claude Code sessions directly within the TUI content pane.

Purpose: Enable multi-session Claude Code management from nForma without leaving the TUI — the core value proposition of the tool.
Output: Working Sessions module with full terminal lifecycle (create, connect, disconnect, kill) and proper focus management.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@/Users/jonathanborduas/.claude/plans/gleaming-dancing-conway.md
@bin/nForma.cjs
@bin/nForma.test.cjs
@package.json
@.formal/spec/tui-nav/invariants.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install blessed-xterm and add Sessions module with terminal lifecycle</name>
  <files>package.json, bin/nForma.cjs</files>
  <action>
**Step 1: Install dependency**

```bash
npm install blessed-xterm
```

This pulls in `node-pty` (native addon), `xterm`, `jsdom`. Verify `package.json` has `blessed-xterm` in dependencies.

**Step 2: Add require at top of bin/nForma.cjs**

After the existing `const blessed = require('blessed');` line (~line 56), add:

```javascript
const XTerm = require('blessed-xterm');
```

**Step 3: Add Sessions module to MODULES array**

After the Config module (line 152, before the closing `];` of MODULES), add a 4th module:

```javascript
{
  name: 'Sessions',
  icon: '\u25b6',
  art: ['\u2584\u2580\u2584', '\u2588\u2580\u2580', '\u2580\u2584\u2584'],
  key: 'f4',
  items: [
    { label: '  New Session',    action: 'session-new' },
  ],
}
```

**Step 4: Add session state variables**

After the MODULES array and MENU_ITEMS line, add:

```javascript
const sessions = [];        // { id, name, cwd, term (XTerm widget), alive }
let activeSessionIdx = -1;  // -1 = no terminal shown
let sessionIdCounter = 0;
```

**Step 5: Add refreshSessionMenu function**

Place after session state variables. This rebuilds the Sessions module items dynamically:

```javascript
function refreshSessionMenu() {
  const mod = MODULES[3]; // Sessions
  const items = [{ label: '  New Session', action: 'session-new' }];
  if (sessions.length > 0) {
    items.push({ label: ' \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', action: 'sep' });
    sessions.forEach((s, i) => {
      const status = s.alive ? '{green-fg}\u25cf{/}' : '{red-fg}\u25cb{/}';
      const active = (i === activeSessionIdx) ? '{#4a9090-fg}\u25b8{/} ' : '  ';
      items.push({
        label: `${active}${status} [${s.id}] ${s.name}`,
        action: `session-connect-${i}`,
      });
    });
    items.push({ label: ' \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', action: 'sep' });
    items.push({ label: '  Kill Session', action: 'session-kill' });
  }
  mod.items = items;
  // If Sessions module is active, refresh the visible menu
  if (activeModuleIdx === 3) {
    menuList.clearItems();
    menuList.setItems(mod.items.map(m => m.label));
    screen.render();
  }
}
```

**Step 6: Add terminal lifecycle functions**

Place after refreshSessionMenu:

```javascript
function createSession(name, cwd) {
  const id = ++sessionIdCounter;
  const term = new XTerm({
    shell: 'claude',
    args: [],
    cwd: cwd || process.cwd(),
    cursorType: 'block',
    scrollback: 1000,
    top: 3, left: 35, right: 0, bottom: 2,
    border: { type: 'line' },
    style: {
      bg: S.mid,
      border: { fg: S.bdr },
      focus: { border: { fg: '#4a9090' } },
    },
    label: ` {#4a9090-fg}${name}{/} `,
    tags: true,
    ignoreKeys: ['f1', 'f2', 'f3', 'f4', 'C-\\\\'],
  });
  screen.append(term);
  term.hide();

  const session = { id, name, cwd: cwd || process.cwd(), term, alive: true };
  sessions.push(session);

  term.on('exit', () => {
    session.alive = false;
    refreshSessionMenu();
    if (activeSessionIdx === sessions.indexOf(session)) {
      toast(`Session "${name}" exited`);
    }
    screen.render();
  });

  refreshSessionMenu();
  connectSession(sessions.length - 1);
  return session;
}

function connectSession(idx) {
  if (idx < 0 || idx >= sessions.length) return;
  // Hide contentBox
  contentBox.hide();
  // Hide previous active terminal
  if (activeSessionIdx >= 0 && activeSessionIdx < sessions.length) {
    sessions[activeSessionIdx].term.hide();
  }
  // Show and focus new terminal
  activeSessionIdx = idx;
  sessions[idx].term.show();
  sessions[idx].term.focus();
  screen.render();
}

function disconnectSession() {
  if (activeSessionIdx >= 0 && activeSessionIdx < sessions.length) {
    sessions[activeSessionIdx].term.hide();
  }
  activeSessionIdx = -1;
  contentBox.show();
  menuList.focus();
  screen.render();
}

function killSession(idx) {
  if (idx < 0 || idx >= sessions.length) return;
  const session = sessions[idx];
  try { session.term.terminate(); } catch (_) {}
  screen.remove(session.term);
  sessions.splice(idx, 1);
  // Adjust activeSessionIdx
  if (activeSessionIdx === idx) {
    disconnectSession();
  } else if (activeSessionIdx > idx) {
    activeSessionIdx--;
  }
  refreshSessionMenu();
}
```

**Step 7: Add flow functions for New Session and Kill Session**

```javascript
async function newSessionFlow() {
  const name = await promptInput({ title: 'New Session', prompt: 'Session name:' });
  if (!name) return;
  const cwd = await promptInput({ title: 'New Session', prompt: 'Working directory:', default: process.cwd() });
  createSession(name, cwd || process.cwd());
}

async function killSessionFlow() {
  if (sessions.length === 0) { toast('No sessions to kill'); return; }
  const items = sessions.map((s, i) => ({
    label: `[${s.id}] ${s.name} (${s.alive ? 'alive' : 'dead'})`,
    value: i,
  }));
  const choice = await promptList({ title: 'Kill Session', items });
  killSession(choice.value);
}
```

**Step 8: Modify switchModule for terminal show/hide**

In the `switchModule(idx)` function (~line 161), add terminal management:

At the VERY TOP of `switchModule`, before `activeModuleIdx = idx;`, add:

```javascript
// Hide active terminal when leaving Sessions module
if (activeModuleIdx === 3 && activeSessionIdx >= 0 && activeSessionIdx < sessions.length) {
  sessions[activeSessionIdx].term.hide();
  contentBox.show();
}
```

At the BOTTOM of `switchModule`, just before the final closing `}`, REPLACE the auto-dispatch block (the `// Auto-show first item's content` block at lines ~189-194) with:

```javascript
// If switching TO Sessions with an active session, reconnect terminal
if (idx === 3 && activeSessionIdx >= 0 && activeSessionIdx < sessions.length) {
  connectSession(activeSessionIdx);
  return;
}

// Auto-show first item's content (skip separators, use view-only for interactive actions)
const first = mod.items[0];
if (first && first.action !== 'sep') {
  const viewAction = first.action === 'settings' ? 'settings-view' : first.action;
  dispatch(viewAction);
}
```

**Step 9: Add dispatch cases**

In the `dispatch(action)` function (~line 2082), inside the try block, add these cases before the closing `} catch`:

```javascript
else if (action === 'session-new')  await newSessionFlow();
else if (action === 'session-kill') await killSessionFlow();
else if (action.startsWith('session-connect-')) {
  connectSession(parseInt(action.replace('session-connect-', ''), 10));
}
```

**Step 10: Add keybindings**

In the keybindings section (~line 2392), add:

```javascript
screen.key(['f4'], () => switchModule(3));
```

And add Ctrl+\ for terminal escape:

```javascript
screen.key(['C-\\'], () => {
  if (activeModuleIdx === 3 && activeSessionIdx >= 0) {
    menuList.focus();
  }
});
```

**Step 11: Update header key hints**

In `renderHeader()` (~line 407), update the `keys` string to include F4:

Change from:
```
{#4a9090-fg}[F1]{/} A  {#4a9090-fg}[F2]{/} R  {#4a9090-fg}[F3]{/} C   {#4a9090-fg}[Tab]{/} cycle  {#4a9090-fg}[/]{/} filter  {#4a9090-fg}[q]{/} quit
```

To:
```
{#4a9090-fg}[F1]{/} A  {#4a9090-fg}[F2]{/} R  {#4a9090-fg}[F3]{/} C  {#4a9090-fg}[F4]{/} S   {#4a9090-fg}[Tab]{/} cycle  {#4a9090-fg}[C-\\]{/} menu  {#4a9090-fg}[q]{/} quit
```

Adjust the `gap` calculation accordingly: `const gap = Math.max(2, w - 25 - 74);` (wider key hints).

**Step 12: Export sessions-related identifiers for testing**

In `module.exports._pure`, add `sessions` reference (read-only for test introspection -- not the mutable array, just the MODULES which now includes Sessions):

The existing `MODULES` export already covers this since the 4th module is now in the array.

**Formal invariant compliance (tui-nav):**
- EscapeProgress: Not violated -- terminal `ignoreKeys` passes F-keys and Ctrl+\ to screen, ensuring escape path is never blocked. Depth does not increase beyond MaxDepth.
- NoDeadlock: Ctrl+\ always returns focus to menuList. F1-F4 always switch modules. q/Ctrl+C always exits. No dead-end state is created.
  </action>
  <verify>
1. `npm ls blessed-xterm` shows it installed
2. `grep -c 'blessed-xterm' package.json` returns 1
3. `grep -c "name: 'Sessions'" bin/nForma.cjs` returns 1
4. `grep -c 'session-new' bin/nForma.cjs` returns at least 3 (MODULES item, dispatch case, flow)
5. `grep -c 'XTerm' bin/nForma.cjs` returns at least 2 (require + new XTerm)
6. `node -e "const m = require('./bin/nForma.cjs'); console.log(m._pure.MODULES.length)"` prints 4
7. `node -e "const m = require('./bin/nForma.cjs'); console.log(m._pure.MODULES[3].name)"` prints "Sessions"
  </verify>
  <done>
- Sessions module is the 4th entry in MODULES array with F4 key, icon, pixel art, and "New Session" action
- blessed-xterm is installed and required
- createSession spawns XTerm with shell='claude', positioned over contentBox area
- connectSession/disconnectSession properly toggle contentBox vs terminal visibility
- killSession terminates PTY and removes from sessions array
- switchModule hides terminal when leaving Sessions, reconnects when returning
- dispatch handles session-new, session-kill, and session-connect-N actions
- F4 keybinding switches to Sessions module
- Ctrl+\ escapes terminal focus back to menu
- Header shows F4 and Ctrl+\ hints
- Tab/Shift-Tab cycling works with 4 modules (existing % MODULES.length logic handles it)
  </done>
</task>

<task type="auto">
  <name>Task 2: Update tests to validate Sessions module integration</name>
  <files>bin/nForma.test.cjs</files>
  <action>
Read `bin/nForma.test.cjs` to understand existing test patterns. Add new tests for the Sessions module:

1. **MODULES length test**: Assert `MODULES.length === 4`
2. **Sessions module structure**: Assert `MODULES[3].name === 'Sessions'`, `MODULES[3].key === 'f4'`, has `items` array with at least `session-new` action
3. **Sessions module icon and art**: Assert `MODULES[3].icon` is defined, `MODULES[3].art.length === 3`
4. **MENU_ITEMS includes session actions**: Assert `MENU_ITEMS.some(m => m.action === 'session-new')` is true
5. **Tab cycling covers all 4 modules**: Test that `(activeModuleIdx + 1) % MODULES.length` cycles through 0,1,2,3,0...

Follow existing test file patterns exactly (node:test, node:assert, requiring `._pure`). Do NOT test terminal lifecycle functions (they require screen/PTY -- those are verified manually via checkpoint). Only test pure data structures.

Run `node --test bin/nForma.test.cjs` to confirm all existing tests + new tests pass.
  </action>
  <verify>
`node --test bin/nForma.test.cjs` passes with 0 failures (all existing tests + new Sessions tests)
  </verify>
  <done>
- At least 4 new test cases validate Sessions module in MODULES array
- All pre-existing tests continue to pass
- Test output shows 0 failures
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify Sessions module works interactively</name>
  <files>bin/nForma.cjs</files>
  <action>
Human verifies the interactive terminal session functionality that cannot be automated in tests.
  </action>
  <verify>
User runs through the 12-step verification checklist and confirms all behaviors work correctly.
  </verify>
  <done>
User types "approved" confirming all interactive behaviors work as expected.
  </done>
  <what-built>Sessions module in nForma TUI with embedded Claude Code terminal sessions via blessed-xterm.</what-built>
  <how-to-verify>
    1. Run `node bin/nForma.cjs`
    2. Press F4 -- should switch to Sessions module showing "New Session" menu item
    3. Press Enter on "New Session" -- enter a name and working directory
    4. Verify Claude Code launches in the content area (interactive terminal)
    5. Type something in the terminal to confirm it is interactive
    6. Press Ctrl+\ -- focus should return to the session list menu
    7. Press F1 -- terminal should hide, Agents module content should show
    8. Press F4 -- terminal should reappear with the session still active
    9. Create a 2nd session, switch between them via menu items
    10. Use "Kill Session" to terminate one -- verify it is removed from the list
    11. Press Tab repeatedly -- should cycle through all 4 modules (A, R, C, S)
    12. Press q to exit
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `npm ls blessed-xterm` confirms dependency installed
- `node --test bin/nForma.test.cjs` all tests pass (existing + new)
- `node -e "const m = require('./bin/nForma.cjs'); console.log(m._pure.MODULES.length)"` outputs 4
- Manual verification of terminal lifecycle (create, switch, kill) via Task 3
</verification>

<success_criteria>
- blessed-xterm installed as production dependency
- Sessions module is 4th module in nForma TUI, accessible via F4
- New Session creates embedded Claude Code terminal in content area
- Terminal focus management works: Ctrl+\ returns to menu, F-keys switch modules
- Multiple sessions supported with menu-based switching
- Kill Session terminates PTY cleanly
- All existing nForma tests pass alongside new Sessions tests
</success_criteria>

<output>
After completion, create `.planning/quick/156-add-sessions-module-to-nforma-with-bless/156-SUMMARY.md`
</output>
