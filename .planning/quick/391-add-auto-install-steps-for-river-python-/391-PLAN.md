---
phase: quick-391
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/install.js
  - hooks/nf-statusline.js
  - hooks/dist/nf-statusline.js
autonomous: true
requirements: [INTENT-01]
must_haves:
  truths:
    - "Running install.js installs River via pip3 if not already importable"
    - "Running install.js installs @huggingface/transformers to nf-bin if not already present"
    - "Both install steps are fail-open and idempotent"
    - "statusline embed indicator checks global nf-bin path, not project-local node_modules"
    - "statusline River indicator is omitted when python3 cannot import river"
    - "statusline River indicator shows dot or circle when river is importable, based on q-table state"
  artifacts:
    - path: "bin/install.js"
      provides: "River pip3 install block and embed npm install block after coderlm block"
      contains: "pip3 install river"
    - path: "hooks/nf-statusline.js"
      provides: "Updated buildToolsLine() with global embed path and conditional River check"
      contains: "nf-bin/node_modules/@huggingface/transformers"
    - path: "hooks/dist/nf-statusline.js"
      provides: "Installed copy of updated statusline hook"
  key_links:
    - from: "bin/install.js"
      to: "python3 -c 'import river'"
      via: "spawnSync idempotency check"
      pattern: "import river"
    - from: "hooks/nf-statusline.js"
      to: "~/.claude/nf-bin/node_modules/@huggingface/transformers"
      via: "fs.existsSync"
      pattern: "nf-bin.*transformers"
---

<objective>
Add auto-install steps for River (Python) and @huggingface/transformers (embed) to bin/install.js, then update buildToolsLine() in nf-statusline.js so both indicators check global installation paths instead of project-local paths or always-on stubs.

Purpose: Users who run the nForma installer should get River and embed provisioned automatically; the statusline should reflect actual global availability, not project-local accidents.
Output: Two new install blocks in install.js; updated embed and River checks in nf-statusline.js; dist copy synced.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/install.js
@hooks/nf-statusline.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add River and embed install blocks to install.js</name>
  <files>bin/install.js</files>
  <action>
After the coderlm block (lines ~2575-2602) and before the "Validate hook path references" comment (line ~2604), insert two new blocks:

**River block** (insert first):
```js
  // Install River ML library via pip3 if not already importable (fail-open)
  {
    const { spawnSync: _spawnRiver } = require('child_process');
    try {
      const riverCheck = _spawnRiver('python3', ['-c', 'import river'], { timeout: 3000 });
      if (riverCheck.status !== 0) {
        console.log(`  ${cyan}↓${reset} Installing River ML (pip3)...`);
        const riverInstall = _spawnRiver('pip3', ['install', 'river', '--user'], { timeout: 60000 });
        if (riverInstall.status === 0) {
          console.log(`  ${green}✓${reset} River ML installed`);
        } else {
          const errOut = riverInstall.stderr ? riverInstall.stderr.toString().slice(0, 120) : '';
          console.log(`  ${yellow}⚠${reset} River ML install skipped: pip3 returned non-zero${errOut ? ' (' + errOut + ')' : ''}`);
        }
      }
      // status === 0: River already importable — skip silently
    } catch (e) {
      // python3 not found or timed out — skip silently (fail-open)
    }
  }
```

**embed block** (insert second, after River block):
```js
  // Install @huggingface/transformers to nf-bin if not already present (fail-open)
  {
    const { spawnSync: _spawnEmbed } = require('child_process');
    try {
      const transformersGlobalPath = path.join(os.homedir(), '.claude', 'nf-bin', 'node_modules', '@huggingface', 'transformers');
      if (!fs.existsSync(transformersGlobalPath)) {
        console.log(`  ${cyan}↓${reset} Installing @huggingface/transformers...`);
        const embedInstall = _spawnEmbed('npm', ['install', '--prefix', path.join(os.homedir(), '.claude', 'nf-bin'), '@huggingface/transformers'], { timeout: 120000 });
        if (embedInstall.status === 0) {
          console.log(`  ${green}✓${reset} @huggingface/transformers installed`);
        } else {
          const errOut = embedInstall.stderr ? embedInstall.stderr.toString().slice(0, 120) : '';
          console.log(`  ${yellow}⚠${reset} @huggingface/transformers install skipped: npm returned non-zero${errOut ? ' (' + errOut + ')' : ''}`);
        }
      }
      // Already present — skip silently
    } catch (e) {
      // Unexpected error — skip silently (fail-open)
    }
  }
```

Note: install.js does not use 'use strict' (pre-existing deviation). Use the same `cyan`, `green`, `yellow`, `reset` color vars already defined in the file. `fs`, `path`, and `os` are already required at the top of install.js. `spawnSync` is NOT at module top level — use inline `const { spawnSync: _spawnRiver } = require('child_process');` at the start of each block (matches existing pattern at line 3655).
  </action>
  <verify>
    grep -n "pip3 install river" /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/bin/install.js
    grep -n "huggingface/transformers" /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/bin/install.js | grep "nf-bin"
  </verify>
  <done>install.js contains a River pip3 install block and an embed npm install block, both after the coderlm block, both fail-open with idempotency checks.</done>
</task>

<task type="auto">
  <name>Task 2: Update buildToolsLine() embed and River checks, sync dist, re-install hooks</name>
  <files>hooks/nf-statusline.js, hooks/dist/nf-statusline.js</files>
  <action>
In `hooks/nf-statusline.js`, make two targeted changes inside `buildToolsLine(homeDir, dir)`:

**Change 1 — embed indicator (section 3, around line 100):**
Replace the project-local transformers path check:
```js
const transformersPath = path.join(dir, 'node_modules', '@huggingface', 'transformers');
```
with the global nf-bin path:
```js
const transformersPath = path.join(homeDir, '.claude', 'nf-bin', 'node_modules', '@huggingface', 'transformers');
```
No other changes to the embed block.

**Change 2 — River indicator (section 2, around lines 57-95):**
The current River block always emits at least `· River` (even when River is not installed). Replace the entire River section (from `// 2. River indicator` comment through its closing `} catch` block) with a version that first checks whether River is importable:

```js
  // 2. River indicator — only shown when python3 can import river
  try {
    let riverImportable = false;
    try {
      const riverCheck = spawnSync('python3', ['-c', 'import river'], { timeout: 3000 });
      riverImportable = riverCheck.status === 0;
    } catch (_e) {}

    if (riverImportable) {
      const riverPath = path.join(dir, '.nf-river-state.json');
      let toolsRiver = '\x1b[2m· River\x1b[0m'; // installed but idle
      try {
        if (fs.existsSync(riverPath)) {
          const riverRaw = fs.readFileSync(riverPath, 'utf8');
          const riverState = JSON.parse(riverRaw);
          const qTable = riverState && riverState.qTable;
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
        }
      } catch (_e) {}
      parts.push(toolsRiver);
    }
    // River not importable → omit entirely
  } catch (_e) {}
```

This keeps all existing q-table logic and lastShadow rendering intact while gating the whole indicator on actual River availability. The outer try/catch keeps it fail-open. The inner spawnSync timeout is 3000ms to stay within hook budget.

IMPORTANT: `nf-statusline.js` does NOT currently require `child_process`. You MUST add the following line alongside the existing requires at the top of the file (after the `os` require):
```js
const { spawnSync } = require('child_process');
```
Without this, the River availability check will throw `ReferenceError: spawnSync is not defined`.

After editing hooks/nf-statusline.js:
1. Copy to dist: `cp hooks/nf-statusline.js hooks/dist/nf-statusline.js`
2. Re-install: `node bin/install.js --claude --global`
  </action>
  <verify>
    grep -n "nf-bin.*transformers" /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/hooks/nf-statusline.js
    grep -n "import river" /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/hooks/nf-statusline.js
    diff /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/hooks/nf-statusline.js /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/hooks/dist/nf-statusline.js
  </verify>
  <done>
    - embed indicator in nf-statusline.js references nf-bin global path (not dir/node_modules)
    - River indicator is wrapped in python3 import-river check and omitted when River not installed
    - hooks/dist/nf-statusline.js is identical to hooks/nf-statusline.js
    - node bin/install.js --claude --global completes without error
  </done>
</task>

</tasks>

<verification>
- `grep "pip3 install river" bin/install.js` returns a match
- `grep "nf-bin.*transformers" bin/install.js` returns a match in the embed install block
- `grep "nf-bin.*transformers" hooks/nf-statusline.js` returns a match in the embed indicator
- `grep "import river" hooks/nf-statusline.js` returns a match in the River availability check
- `diff hooks/nf-statusline.js hooks/dist/nf-statusline.js` returns no output (files identical)
- Both install blocks in install.js are wrapped in try/catch (fail-open)
- River spawnSync timeout in statusline is 3000ms
</verification>

<success_criteria>
1. install.js automatically provisions River and embed during `node bin/install.js --claude --global` runs, idempotently.
2. The statusline embed indicator reflects global nf-bin installation, not the current project's node_modules.
3. The statusline River indicator is omitted when River is not importable by python3; shown when it is.
4. dist copy is synced and re-install completes cleanly.
</success_criteria>

<output>
After completion, create `.planning/quick/391-add-auto-install-steps-for-river-python-/391-SUMMARY.md`
</output>
