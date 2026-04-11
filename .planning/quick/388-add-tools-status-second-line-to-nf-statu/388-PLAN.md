---
task_id: "388"
description: "Add second tools-status line to nf-statusline showing coderlm/River/embed availability"
formal_artifacts: none
---

# Quick Task 388 — Tools Status Second Line in nf-statusline

## Objective

Add a second output line to `hooks/nf-statusline.js` that shows tool availability. The line appears after the main statusline and uses `●` (bright, colored) for active tools and `·` (dim) for installed-but-idle tools. Tools not installed are omitted entirely.

Format: `· coderlm │ · River │ · embed` (each indicator dim or colored per state, missing when not installed).

**River is always shown** — it is a built-in nForma capability (not an external binary). The absence of `.nf-river-state.json` means River has not run yet (idle), not that it is uninstalled. coderlm and embed are omitted when not installed (binary/package missing).

---

## Task 1 — Implement `buildToolsLine()` in `hooks/nf-statusline.js`

**File:** `hooks/nf-statusline.js`

**What to do:**

Add a `buildToolsLine(homeDir, dir)` function after the existing coderlm indicator block (after line 225). The function assembles tool indicator parts and returns a joined string.

**Implementation details:**

```js
function buildToolsLine(homeDir, dir) {
  const parts = [];

  // 1. coderlm indicator
  try {
    const coderlmBin = path.join(homeDir, '.claude', 'nf-bin', 'coderlm');
    if (fs.existsSync(coderlmBin)) {
      // Binary present — check if PID is alive
      let alive = false;
      try {
        const pidFile = path.join(homeDir, '.claude', 'nf-bin', 'coderlm.pid');
        const pidStr = fs.readFileSync(pidFile, 'utf8').trim();
        const pid = parseInt(pidStr, 10);
        if (!isNaN(pid)) {
          process.kill(pid, 0); // throws ESRCH if dead
          alive = true;
        }
      } catch (_e) {}
      parts.push(alive
        ? '\x1b[32m● coderlm\x1b[0m'
        : '\x1b[2m· coderlm\x1b[0m');
    }
    // Binary missing → omit entirely
  } catch (_e) {}

  // 2. River indicator — always shown (built-in capability, not an external binary)
  // Absence of state file = idle (not uninstalled); always emits at least · River
  try {
    const riverPath = path.join(dir, '.nf-river-state.json');
    if (fs.existsSync(riverPath)) {
      // State file present — derive indicator text (same logic as main block,
      // but emit without leading space for tools line)
      const riverRaw = fs.readFileSync(riverPath, 'utf8');
      const riverState = JSON.parse(riverRaw);
      const qTable = riverState && riverState.qTable;
      let toolsRiver = '\x1b[2m· River\x1b[0m'; // default dim until q-table confirms active
      if (qTable && typeof qTable === 'object') {
        const RIVER_MIN_EXPLORE = 20;
        let hasArms = false;
        let allAbove = true;
        for (const taskType of Object.keys(qTable)) {
          const arms = qTable[taskType];
          if (arms && typeof arms === 'object') {
            for (const armName of Object.keys(arms)) {
              hasArms = true;
              if ((arms[armName].visits || 0) < RIVER_MIN_EXPLORE) allAbove = false;
            }
          }
        }
        if (hasArms) {
          toolsRiver = allAbove
            ? '\x1b[32m● River\x1b[0m'
            : '\x1b[36m● River\x1b[0m';
        }
        if (riverState.lastShadow && typeof riverState.lastShadow.recommendation === 'string' && riverState.lastShadow.recommendation) {
          toolsRiver = `\x1b[33m● River: ${riverState.lastShadow.recommendation}\x1b[0m`;
        }
      }
      parts.push(toolsRiver);
    } else {
      parts.push('\x1b[2m· River\x1b[0m');
    }
  } catch (_e) {
    parts.push('\x1b[2m· River\x1b[0m');
  }

  // 3. embed indicator
  // Note: embed has no runtime active signal — always dim when installed.
  // There is no "active" state to detect; ● embed is intentionally not implemented.
  try {
    const transformersPath = path.join(dir, 'node_modules', '@huggingface', 'transformers');
    if (fs.existsSync(transformersPath)) {
      parts.push('\x1b[2m· embed\x1b[0m');
    }
    // Not installed → omit entirely
  } catch (_e) {}

  return parts.join(' \x1b[2m│\x1b[0m ');
}
```

Then, after the main `process.stdout.write(...)` call (lines 229-233), add a second write:

```js
    // Tools status second line
    try {
      const toolsLine = buildToolsLine(homeDir, dir);
      if (toolsLine) {
        process.stdout.write('\n' + toolsLine);
      }
    } catch (_e) {}
```

**Style notes:**
- CommonJS (`require`, not `import`)
- Note: `hooks/nf-statusline.js` pre-dates the `'use strict'` coding-style rule and does not currently have it. Do NOT add it in this task — it is a pre-existing deviation scoped to a separate cleanup.
- Wrap all external I/O in try/catch (fail-open per security rules)
- The separator `│` uses dim ANSI (`\x1b[2m│\x1b[0m`) so it doesn't compete with the indicators
- `buildToolsLine(homeDir, dir)` takes only two parameters — no `riverIndicator` param needed (function reads state file independently to avoid leading-space coupling)

**Verify:** `echo '{"model":{"display_name":"M"},"workspace":{"current_dir":"/tmp"}}' | node hooks/nf-statusline.js` — stdout contains a newline followed by `· River` (dim ANSI).

**Done:** Main statusline line unchanged. Second line printed with `\n` prefix. River always present. coderlm and embed omitted when binary/package absent. All tool checks wrapped in try/catch.

---

## Task 2 — Update tests in `hooks/nf-statusline.test.js`

**File:** `hooks/nf-statusline.test.js`

**What to do:**

The existing TC17 asserts `!stdout.includes('River:')` — this was testing absence of the shadow-recommendation form. The new second line always includes `River` (via `· River` or `● River`). Update TC17 to assert absence of the shadow form `River:` while allowing `River` (without colon) to be present.

Also add three new test cases after TC23 (the last existing test):

**TC24 — coderlm binary absent → no coderlm in tools line:**
```js
test('TC24: coderlm binary absent means coderlm omitted from tools line', () => {
  const tempHome = makeTempDir('tc24');
  const tempDir = makeTempDir('tc24-dir');
  // Do NOT create ~/.claude/nf-bin/coderlm — binary absent
  try {
    const { stdout, exitCode } = runHook(
      { model: { display_name: 'M' }, workspace: { current_dir: tempDir } },
      { HOME: tempHome }
    );
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.ok(!stdout.includes('coderlm'), 'stdout must NOT include coderlm when binary absent');
    assert.ok(stdout.includes('River'), 'stdout must include River (always shown)');
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
```

**TC25 — coderlm binary present but no PID file → dim `· coderlm`:**
```js
test('TC25: coderlm binary present but no PID → dim indicator', () => {
  const tempHome = makeTempDir('tc25');
  const tempDir = makeTempDir('tc25-dir');
  const binDir = path.join(tempHome, '.claude', 'nf-bin');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, 'coderlm'), '#!/bin/sh\n', 'utf8');
  // No .pid file → not alive
  try {
    const { stdout, exitCode } = runHook(
      { model: { display_name: 'M' }, workspace: { current_dir: tempDir } },
      { HOME: tempHome }
    );
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.ok(stdout.includes('coderlm'), 'stdout must include coderlm when binary present');
    assert.ok(stdout.includes('\x1b[2m· coderlm\x1b[0m'), 'stdout must include dim coderlm indicator');
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
```

**TC27 — coderlm binary present AND PID alive → bright green `● coderlm`:**
```js
test('TC27: coderlm binary present with alive PID shows green active indicator', () => {
  const tempHome = makeTempDir('tc27');
  const tempDir = makeTempDir('tc27-dir');
  const binDir = path.join(tempHome, '.claude', 'nf-bin');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, 'coderlm'), '#!/bin/sh\n', 'utf8');
  // Use current process PID — guaranteed alive
  fs.writeFileSync(path.join(binDir, 'coderlm.pid'), String(process.pid), 'utf8');
  try {
    const { stdout, exitCode } = runHook(
      { model: { display_name: 'M' }, workspace: { current_dir: tempDir } },
      { HOME: tempHome }
    );
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.ok(stdout.includes('\x1b[32m● coderlm\x1b[0m'), 'stdout must include green active coderlm indicator');
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
```

**TC26 — embed package present → dim `· embed` in tools line:**
```js
test('TC26: embed package present shows dim embed indicator', () => {
  const tempDir = makeTempDir('tc26');
  const pkgDir = path.join(tempDir, 'node_modules', '@huggingface', 'transformers');
  fs.mkdirSync(pkgDir, { recursive: true });
  try {
    const { stdout, exitCode } = runHook({
      model: { display_name: 'M' },
      workspace: { current_dir: tempDir },
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.ok(stdout.includes('embed'), 'stdout must include embed indicator when package present');
    assert.ok(stdout.includes('\x1b[2m· embed\x1b[0m'), 'stdout must include dim embed indicator');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
```

**TC17 update — rename test description:** TC17 currently has description "No state file means no River indicator". After this change, `buildToolsLine` always emits `· River` when no state file is present. Update TC17's test name to "No state file shows idle River (no active indicator form)" and update its assertion comment to "stdout must NOT include 'River:' shadow form — tools line shows dim · River not ● River". The assertion `!stdout.includes('River:')` itself remains correct (the tools line uses `River` without colon).

**TC18 update — rename and strengthen:** TC18 currently has description "Malformed state file produces no River indicator". After this change, `buildToolsLine`'s catch block emits `· River` as a fail-open fallback. Update TC18's test name to "Malformed state file shows idle River (fail-open fallback)" and add `assert.ok(stdout.includes('River'), 'stdout must include River as fail-open fallback')`. The existing `!stdout.includes('River:')` assertion remains correct.

**Note on TC25 HOME forwarding:** `runHook()` spreads `extraEnv` over `process.env` (`env: { ...process.env, ...extraEnv }`), so `{ HOME: tempHome }` correctly overrides HOME for the child process. TC25 and TC27 correctly pass `{ HOME: tempHome }` as the second arg.

**Verify:** `node --test hooks/nf-statusline.test.js` — all tests pass including TC24, TC25, TC26, TC27.

**Done:** New tests cover tools line absence/present-idle/present-alive/dim states. Existing TC15–TC23 continue passing. TC17 passes because tools line emits `River` not `River:`.

---

## Task 3 — Sync `hooks/dist/nf-statusline.js`, run installer, verify

**Files:** `hooks/dist/nf-statusline.js`, `~/.claude/hooks/nf-statusline.js`

**What to do:**

1. Copy updated source to dist (dist is gitignored, requires `git add -f`):
   ```bash
   cp hooks/nf-statusline.js hooks/dist/nf-statusline.js
   git add -f hooks/dist/nf-statusline.js
   ```

2. Run the installer (OverridesPreserved invariant: use standard invocation, no override-clearing flags):
   ```bash
   node bin/install.js --claude --global
   ```

3. Run the full test suite to confirm no regressions:
   ```bash
   node --test hooks/nf-statusline.test.js
   ```

4. Quick manual smoke test to confirm second line appears:
   ```bash
   echo '{"model":{"display_name":"TestModel"},"workspace":{"current_dir":"/tmp"}}' | node hooks/dist/nf-statusline.js
   ```
   Expected: two lines — main statusline on line 1, tools line (containing `· River`) on line 2.

**Verify:**
- `hooks/dist/nf-statusline.js` matches `hooks/nf-statusline.js` (diff is empty)
- `~/.claude/hooks/nf-statusline.js` contains `buildToolsLine`
- All TC1–TC26 pass

**Done:** dist copy synced, installer run without override-clearing flags, installed copy contains tools line logic.
