---
phase: quick-77
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/qgsd-circuit-breaker.js
  - bin/install.js
  - .gitignore
autonomous: true
requirements: [QUICK-77]

must_haves:
  truths:
    - "A detected oscillation is persisted to .planning/oscillation-log.json keyed by fileSetHash:patternHash"
    - "PreToolUse suppresses the warning if log[key].resolvedAt is set"
    - "PostToolUse on Bash calls Haiku when active entries exist; writes resolvedAt+resolvedByCommit+haikuRationale on YES"
    - "--reset-breaker stamps manualResetAt on all active log entries"
  artifacts:
    - path: "hooks/qgsd-circuit-breaker.js"
      provides: "oscillation log read/write, PostToolUse handler, suppression logic"
    - path: ".gitignore"
      provides: ".planning/oscillation-log.json excluded from git"
  key_links:
    - from: "hooks/qgsd-circuit-breaker.js PreToolUse"
      to: ".planning/oscillation-log.json"
      via: "readOscillationLog(); check entry.resolvedAt before emitting warning"
    - from: "hooks/qgsd-circuit-breaker.js PostToolUse"
      to: "Anthropic API (Haiku)"
      via: "spawnSync node -e inline script with HAIKU_BODY env var"
---

<objective>
Add a persisted oscillation memory log so the circuit breaker remembers which oscillations have been resolved and stops re-firing on already-fixed patterns.

Purpose: The current circuit breaker re-warns on every PreToolUse even after the oscillation is fixed, creating noise. Persisting resolved entries lets the hook suppress warnings for closed loops and lets PostToolUse auto-detect resolution via Haiku.

Output: Modified hooks/qgsd-circuit-breaker.js with log read/write, suppression in PreToolUse, PostToolUse handler; updated bin/install.js --reset-breaker; .gitignore entry; install sync.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/qgsd-circuit-breaker.js
@hooks/config-loader.js
@bin/install.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add oscillation-log helpers and suppression to qgsd-circuit-breaker.js</name>
  <files>hooks/qgsd-circuit-breaker.js</files>
  <action>
Add the following to hooks/qgsd-circuit-breaker.js (keep all existing code intact):

**1. Add `const crypto = require('crypto');` to the require block at the top.**

**2. Five new helper functions after `appendFalseNegative`:**

```js
function getOscillationLogPath(gitRoot) {
  return path.join(gitRoot, '.planning', 'oscillation-log.json');
}

function readOscillationLog(logPath) {
  if (!fs.existsSync(logPath)) return {};
  try { return JSON.parse(fs.readFileSync(logPath, 'utf8')); }
  catch { return {}; }
}

function writeOscillationLog(logPath, log) {
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf8');
  } catch (e) {
    process.stderr.write(`[qgsd] WARNING: Could not write oscillation log: ${e.message}\n`);
  }
}

function makeFileSetHash(files) {
  return crypto.createHash('sha1')
    .update(files.slice().sort().join('\0'))
    .digest('hex').slice(0, 12);
}

function makePatternHash(fileSets) {
  // Collapse to run-group keys (same as detectOscillation step 1)
  const runKeys = [];
  for (const files of fileSets) {
    const key = files.slice().sort().join('\0');
    if (runKeys.length === 0 || runKeys[runKeys.length - 1] !== key) {
      runKeys.push(key);
    }
  }
  return crypto.createHash('sha1')
    .update(runKeys.join('|'))
    .digest('hex').slice(0, 12);
}
```

**3. Restructure `main()` to dispatch on hookEvent first:**

At the top of the `process.stdin.on('end', async () => {` callback, after `JSON.parse(raw)` and extracting `cwd`:

```js
const hookEvent = input.hook_event_name || input.hookEventName || 'PreToolUse';
const toolName = input.tool_name || input.toolName || '';
```

Load `config` and `gitRoot` early (before the if-branch), since both handlers need them:
```js
const gitRoot = getGitRoot(cwd);
if (!gitRoot) process.exit(0);

const config = loadConfig(gitRoot);
const logPath = getOscillationLogPath(gitRoot);
```

**4. PostToolUse block (add before existing PreToolUse logic):**

```js
if (hookEvent === 'PostToolUse' && toolName === 'Bash') {
  const log = readOscillationLog(logPath);
  const activeKeys = Object.keys(log).filter(k => !log[k].resolvedAt);
  if (activeKeys.length === 0) process.exit(0);

  const toolOutput = (input.tool_response &&
    (input.tool_response.output || input.tool_response.stdout)) || '';
  const lastCommitResult = spawnSync('git', ['log', '--oneline', '-1'], {
    cwd: gitRoot, encoding: 'utf8', timeout: 5000,
  });
  const lastCommit = (lastCommitResult.stdout || '').trim();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) process.exit(0);

  const activeEntry = log[activeKeys[0]];
  const haikuPrompt =
    `You are a circuit breaker monitor. An oscillation was detected on files: ${activeEntry.files.join(', ')}.\n\n` +
    `A Bash command just completed. Output (truncated):\n${toolOutput.slice(0, 2000)}\n\n` +
    `Last git commit: ${lastCommit}\n\n` +
    `Does this output indicate the oscillation has been resolved (e.g. tests passing, fix committed)?\n` +
    `Reply with exactly one word: YES or NO`;

  const requestBody = JSON.stringify({
    model: config.circuit_breaker.haiku_model,
    max_tokens: 10,
    messages: [{ role: 'user', content: haikuPrompt }],
  });

  const nodeScript = `
const https = require('https');
const body = process.env.HAIKU_BODY;
const apiKey = process.env.ANTHROPIC_API_KEY;
const req = https.request({
  hostname: 'api.anthropic.com',
  path: '/v1/messages',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Length': Buffer.byteLength(body),
  },
  timeout: 12000,
}, (res) => {
  let d = '';
  res.on('data', c => { d += c; });
  res.on('end', () => {
    try {
      const p = JSON.parse(d);
      process.stdout.write(((p.content||[])[0]||{}).text||'NO');
    } catch { process.stdout.write('NO'); }
  });
});
req.on('error', () => process.stdout.write('NO'));
req.on('timeout', () => { req.destroy(); process.stdout.write('NO'); });
req.write(body);
req.end();
`;

  try {
    const spawnResult = spawnSync('node', ['-e', nodeScript], {
      env: { ...process.env, HAIKU_BODY: requestBody },
      encoding: 'utf8',
      timeout: 15000,
    });
    const verdict = (spawnResult.stdout || '').trim().toUpperCase();

    if (verdict.startsWith('YES')) {
      const resolvedHashResult = spawnSync('git', ['log', '--format=%H', '-1'], {
        cwd: gitRoot, encoding: 'utf8', timeout: 5000,
      });
      const resolvedCommit = (resolvedHashResult.stdout || '').trim() || null;
      const now = new Date().toISOString();
      for (const k of activeKeys) {
        log[k].resolvedAt = now;
        log[k].resolvedByCommit = resolvedCommit;
        log[k].haikuRationale = `Haiku YES on Bash output; last commit: ${lastCommit}`;
      }
      writeOscillationLog(logPath, log);
      // Clear state file so PreToolUse stops warning
      const statePath = path.join(gitRoot, '.claude', 'circuit-breaker-state.json');
      try { if (fs.existsSync(statePath)) fs.rmSync(statePath); } catch {}
      process.stderr.write(`[qgsd] INFO: Oscillation resolved by Haiku — circuit breaker cleared.\n`);
    }
  } catch (e) {
    process.stderr.write(`[qgsd] WARNING: PostToolUse Haiku check failed: ${e.message}\n`);
  }
  process.exit(0);
}
```

**5. PreToolUse suppression in the existing detection flow:**

After `const result = detectOscillation(...)` returns detected=true, and AFTER the Haiku verdict check (so only when we would actually write state and warn), add:

```js
// Log-based suppression: if this exact oscillation was already resolved, skip
const fileSetHash = makeFileSetHash(result.fileSet);
const patternHash = makePatternHash(fileSets);
const logKey = `${fileSetHash}:${patternHash}`;
const log = readOscillationLog(logPath);
if (log[logKey] && log[logKey].resolvedAt) {
  // Already resolved — suppress warning entirely
  process.exit(0);
}
// Upsert log entry
log[logKey] = {
  files: result.fileSet.slice().sort(),
  pattern: fileSets.map(s => s.slice().sort().join(',')).join(' | '),
  firstSeen: (log[logKey] && log[logKey].firstSeen) ? log[logKey].firstSeen : new Date().toISOString(),
  lastSeen: new Date().toISOString(),
  resolvedAt: null,
  resolvedByCommit: null,
  haikuRationale: null,
  manualResetAt: (log[logKey] && log[logKey].manualResetAt) ? log[logKey].manualResetAt : null,
};
writeOscillationLog(logPath, log);
```

Place this block immediately before the `writeState(statePath, ...)` call.

Also in the early `state.active` branch (lines ~397-407), add suppression using the stored file_set (patternHash='legacy' since we don't have fileSets there):

```js
if (state && state.active) {
  // Check if already resolved in log
  const fileSetHash = makeFileSetHash(state.file_set || []);
  const logKey = `${fileSetHash}:legacy`;
  const log = readOscillationLog(logPath);
  if (log[logKey] && log[logKey].resolvedAt) {
    process.exit(0); // Already resolved
  }
  // Emit warning as before
  process.stdout.write(JSON.stringify({ ... }));
  process.exit(0);
}
```

Remove the `loadConfig` call from its current position (just before `getCommitHashes`) since it was moved to the top of the handler.
  </action>
  <verify>
node -e "const m = require('./hooks/qgsd-circuit-breaker.js'); console.log(typeof m.buildWarningNotice)"
# Must print: function

cd /Users/jonathanborduas/code/QGSD && grep -c "makeFileSetHash\|makePatternHash\|writeOscillationLog\|readOscillationLog\|PostToolUse" hooks/qgsd-circuit-breaker.js
# Must print 5 or more
  </verify>
  <done>
Module loads without syntax error. All five helper functions exist in the file. PostToolUse branch present. Suppression check present in both the state.active branch and the fresh-detection branch.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update --reset-breaker in install.js, add .gitignore entry, run install sync</name>
  <files>bin/install.js, .gitignore</files>
  <action>
**A. Update --reset-breaker block in bin/install.js (around line 2165):**

After the existing block that removes `.claude/circuit-breaker-state.json`, add code to stamp `manualResetAt` on all active oscillation-log entries. Insert after the `console.log` that prints "Circuit breaker state cleared":

```js
// Stamp manualResetAt on all active oscillation-log.json entries
const oscLogFile = path.join(projectRoot, '.planning', 'oscillation-log.json');
if (fs.existsSync(oscLogFile)) {
  try {
    const oscLog = JSON.parse(fs.readFileSync(oscLogFile, 'utf8'));
    const now = new Date().toISOString();
    let touched = 0;
    for (const key of Object.keys(oscLog)) {
      if (!oscLog[key].resolvedAt) {
        oscLog[key].manualResetAt = now;
        touched++;
      }
    }
    fs.writeFileSync(oscLogFile, JSON.stringify(oscLog, null, 2), 'utf8');
    if (touched > 0) {
      console.log(`  ${green}✓${reset} Stamped manualResetAt on ${touched} active oscillation log entr${touched === 1 ? 'y' : 'ies'}.`);
    }
  } catch (e) {
    console.log(`  ${dim}Could not update oscillation log: ${e.message}${reset}`);
  }
}
```

Also handle the case where the state file did NOT exist (the else branch currently logs "No active circuit breaker state found") — the oscillation log update should still run. Move the `oscLogFile` block outside the `if (fs.existsSync(stateFile))` condition so it always runs.

Note: `manualResetAt` does NOT set `resolvedAt`. It is an audit trail field only. The PreToolUse suppression only checks `resolvedAt`, so manual reset does not suppress future warnings — it is an escape hatch for knowing when a human intervened.

**B. Add entry to .gitignore:**

In the `# Internal planning documents` section of `.gitignore`, add:
```
.planning/oscillation-log.json
```

**C. Run install sync:**

```
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```
  </action>
  <verify>
grep "oscillation-log.json" /Users/jonathanborduas/code/QGSD/.gitignore
# Must print the entry

grep -n "oscLogFile\|manualResetAt" /Users/jonathanborduas/code/QGSD/bin/install.js
# Must show lines in the reset-breaker block

ls ~/.claude/hooks/qgsd-circuit-breaker.js && echo "installed"
# Must print: installed

node -e "
const fs = require('fs'), os = require('os');
const src = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/qgsd-circuit-breaker.js','utf8');
const dst = fs.readFileSync(os.homedir()+'/.claude/hooks/qgsd-circuit-breaker.js','utf8');
console.log(src === dst ? 'IN SYNC' : 'OUT OF SYNC');
"
# Must print: IN SYNC
  </verify>
  <done>
.gitignore has .planning/oscillation-log.json. --reset-breaker stamps manualResetAt on active log entries (separate from resolvedAt). Installed hook at ~/.claude/hooks/qgsd-circuit-breaker.js is byte-for-byte identical to source.
  </done>
</task>

</tasks>

<verification>
1. `node -e "require('./hooks/qgsd-circuit-breaker.js')"` — no crash.
2. `grep "oscillation-log.json" .gitignore` — entry present.
3. `grep -c "makeFileSetHash\|makePatternHash\|writeOscillationLog\|PostToolUse\|resolvedAt" hooks/qgsd-circuit-breaker.js` — 5+ matches.
4. `grep -n "oscLogFile" bin/install.js` — present in reset-breaker block.
5. Installed hook matches source (IN SYNC check).
</verification>

<success_criteria>
- .planning/oscillation-log.json created on first oscillation detection, keyed fileSetHash:patternHash, with fields: files, pattern, firstSeen, lastSeen, resolvedAt, resolvedByCommit, haikuRationale, manualResetAt
- PreToolUse exits 0 without warning when log[key].resolvedAt is non-null
- PostToolUse on Bash tool: calls Haiku via spawnSync node -e when activeKeys.length > 0; on YES verdict writes resolvedAt+resolvedByCommit+haikuRationale and removes circuit-breaker-state.json
- --reset-breaker stamps manualResetAt on active entries (does not set resolvedAt)
- .planning/oscillation-log.json gitignored
- ~/.claude/hooks/qgsd-circuit-breaker.js in sync with source
</success_criteria>

<output>
After completion, create `.planning/quick/77-oscillation-memory-log-persist-each-dete/77-SUMMARY.md`
</output>
