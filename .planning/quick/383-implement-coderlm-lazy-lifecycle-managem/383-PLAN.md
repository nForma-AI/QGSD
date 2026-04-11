---
phase: quick-383
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/coderlm-lifecycle.cjs
  - bin/coderlm-lifecycle.test.cjs
  - bin/nf-solve.cjs
  - bin/coderlm-adapter.cjs
  - commands/nf/coderlm.md
  - docs/coderlm-integration.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts:
  - module: installer
    invariants_checked:
      - OverridesPreserved
    relevance: "ensureBinary downloads a binary to ~/.claude/nf-bin/coderlm; must not overwrite user-placed binary or user config (NF_CODERLM_HOST override). The idempotent download-if-missing pattern preserves user overrides."
  - module: stop-hook
    invariants_checked:
      - LivenessProperty1
    relevance: "stop() and idle auto-stop must eventually terminate the coderlm process (bounded liveness). PID file cleanup must complete -- a dangling PID file would cause ensureRunning to believe the process is alive when it is not."

must_haves:
  truths:
    - "coderlm binary is automatically downloaded from GitHub Releases on first use if not present at ~/.claude/nf-bin/coderlm"
    - "coderlm server is auto-started on first nf-solve run without requiring NF_CODERLM_ENABLED=true"
    - "If coderlm binary is unavailable or download fails, nf-solve falls through to heuristic waves with no error (fail-open)"
    - "coderlm process stops after 5 minutes of idle (no queries)"
    - "/nf:coderlm start|stop|status|update subcommands control the lifecycle manually"
  artifacts:
    - path: "bin/coderlm-lifecycle.cjs"
      provides: "ensureBinary, ensureRunning, stop, status, touchLastQuery, checkIdleStop exports"
      exports: ["ensureBinary", "ensureRunning", "stop", "status", "touchLastQuery", "checkIdleStop"]
      min_lines: 120
    - path: "bin/coderlm-lifecycle.test.cjs"
      provides: "Unit tests for lifecycle module — ensureBinary idempotency, PID management, idle timeout, fail-open"
      min_lines: 60
    - path: "commands/nf/coderlm.md"
      provides: "/nf:coderlm skill with start, stop, status, update subcommands"
      contains: "nf:coderlm"
  key_links:
    - from: "bin/nf-solve.cjs"
      to: "bin/coderlm-lifecycle.cjs:ensureRunning"
      via: "require + call before adapter.healthSync()"
      pattern: "ensureRunning"
    - from: "bin/coderlm-lifecycle.cjs:ensureBinary"
      to: "https://github.com/nForma-AI/coderlm/releases"
      via: "gh release download or HTTPS GET"
      pattern: "nForma-AI/coderlm"
    - from: "bin/coderlm-lifecycle.cjs:ensureRunning"
      to: "bin/coderlm-lifecycle.cjs:ensureBinary"
      via: "ensureRunning calls ensureBinary before spawn"
      pattern: "ensureBinary"
    - from: "bin/coderlm-lifecycle.cjs:stop"
      to: "~/.claude/nf-bin/coderlm.pid"
      via: "reads PID file, sends SIGTERM, cleans up PID file"
      pattern: "coderlm\\.pid"
  consumers:
    - artifact: "bin/coderlm-lifecycle.cjs"
      consumed_by: "bin/nf-solve.cjs"
      integration: "require('./coderlm-lifecycle.cjs') replacing NF_CODERLM_ENABLED gate"
      verify_pattern: "coderlm-lifecycle"
    - artifact: "bin/coderlm-lifecycle.cjs"
      consumed_by: "commands/nf/coderlm.md"
      integration: "Skill invokes node bin/coderlm-lifecycle.cjs --start|--stop|--status|--update"
      verify_pattern: "coderlm-lifecycle"
---

<objective>
Create a lazy lifecycle manager for the coderlm binary server that auto-downloads, auto-starts, and auto-stops the process, then wire it into nf-solve.cjs to replace the manual NF_CODERLM_ENABLED gate, and expose lifecycle operations via /nf:coderlm skill.

Purpose: Currently coderlm requires the user to manually build the Rust binary, start the server, and set NF_CODERLM_ENABLED=true. This task makes coderlm fully self-managing -- it downloads the binary from GitHub Releases on first use, auto-starts the server when nf-solve needs it, auto-stops after 5 minutes idle, and provides a skill for manual lifecycle control. Fail-open semantics are preserved throughout: if any lifecycle step fails, nf-solve falls through to heuristic wave computation.

Output: bin/coderlm-lifecycle.cjs (lifecycle module), updated bin/nf-solve.cjs (auto-start wiring), updated bin/coderlm-adapter.cjs (remove enabled gate), commands/nf/coderlm.md (skill), bin/coderlm-lifecycle.test.cjs (tests), updated docs/coderlm-integration.md.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/coderlm-adapter.cjs
@bin/nf-solve.cjs (lines 55-65 imports, lines 155-200 queryEdgesSync, lines 5870-5925 coderlm integration block)
@bin/install-formal-tools.cjs (lines 48-87 downloadFile pattern)
@docs/coderlm-integration.md
@.planning/formal/spec/installer/invariants.md
@.planning/formal/spec/stop-hook/invariants.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/coderlm-lifecycle.cjs — binary download and process lifecycle</name>
  <files>bin/coderlm-lifecycle.cjs, bin/coderlm-lifecycle.test.cjs</files>
  <action>
Create bin/coderlm-lifecycle.cjs as a CommonJS module (`'use strict'`) exporting lifecycle functions. Follow the project's bin/ script conventions: CommonJS, `'use strict'`, fail-open (never throw to callers), stderr for diagnostics.

**Constants:**
```
BINARY_DIR = path.join(os.homedir(), '.claude', 'nf-bin')
BINARY_PATH = path.join(BINARY_DIR, 'coderlm')
PID_PATH = path.join(BINARY_DIR, 'coderlm.pid')
LASTQUERY_PATH = path.join(BINARY_DIR, 'coderlm.lastquery')
DEFAULT_PORT = 8787
IDLE_TIMEOUT_MS = 5 * 60 * 1000  // 5 minutes
GITHUB_REPO = 'nForma-AI/coderlm'
HEALTH_URL = 'http://localhost:8787/health'
STARTUP_WAIT_MS = 3000  // max wait for server to become healthy after spawn
```

**Platform detection:**
```javascript
function getPlatformBinaryName() {
  const platform = process.platform;  // 'darwin', 'linux'
  const arch = process.arch;          // 'arm64', 'x64'
  if (platform === 'darwin' && arch === 'arm64') return 'coderlm-darwin-arm64';
  if (platform === 'darwin' && arch === 'x64') return 'coderlm-darwin-x64';
  if (platform === 'linux' && arch === 'x64') return 'coderlm-linux-x64';
  if (platform === 'linux' && arch === 'arm64') return 'coderlm-linux-arm64';
  return null;  // unsupported platform
}
```

**ensureBinary()** — Idempotent binary download:
1. If BINARY_PATH exists and is executable, return `{ ok: true, path: BINARY_PATH, source: 'cached' }`. This preserves user-placed binaries (OverridesPreserved invariant).
2. Determine platform binary name via getPlatformBinaryName(). If null, return `{ ok: false, error: 'unsupported-platform' }`.
3. Try `gh release download --repo GITHUB_REPO --pattern BINARY_NAME --output BINARY_PATH --clobber` via spawnSync (10s timeout). The `gh` CLI handles authentication and redirects.
4. If gh succeeds, `fs.chmodSync(BINARY_PATH, 0o755)`, return `{ ok: true, path: BINARY_PATH, source: 'downloaded' }`.
5. If gh fails (not installed, auth issues, network), return `{ ok: false, error: 'download-failed', detail: stderr snippet }`.
6. Create BINARY_DIR with `{ recursive: true }` before download attempt.
7. Wrap entire function in try/catch, return `{ ok: false, error: 'unexpected', detail: e.message }` on any exception.

**ensureRunning(opts)** — Start server if not already running. opts: `{ port, indexPath }`.
1. Check if process is already running: read PID_PATH, if exists, check `process.kill(pid, 0)` to verify process is alive. If alive, do a quick health check via HTTP GET to HEALTH_URL (use the existing httpGet-like pattern from adapter or spawnSync curl). If healthy, return `{ ok: true, pid, source: 'already-running' }`. **If PID alive but health check fails (zombie PID):** clean up PID file and fall through to spawn a fresh process (addresses LivenessProperty1 — zombie processes must not block restart).
2. If PID file exists but process is dead (kill returns ESRCH), clean up stale PID file (LivenessProperty1 — no dangling PID).
3. Call ensureBinary(). If not ok, return its error.
4. Determine indexPath: `opts.indexPath || process.cwd()`.
5. Spawn: `child_process.spawn(BINARY_PATH, ['--port', String(port || DEFAULT_PORT), '--index-path', indexPath], { detached: true, stdio: ['ignore', 'ignore', 'ignore'] })`. Call `child.unref()`.
6. Write PID to PID_PATH: `fs.writeFileSync(PID_PATH, String(child.pid))`.
7. Touch LASTQUERY_PATH: `fs.writeFileSync(LASTQUERY_PATH, String(Date.now()))`.
8. Wait for server to become healthy: poll HEALTH_URL up to STARTUP_WAIT_MS in 500ms intervals using spawnSync curl or node HTTP (synchronous pattern). If healthy within timeout, return `{ ok: true, pid: child.pid, source: 'started' }`. If not, return `{ ok: true, pid: child.pid, source: 'started-unhealthy', warning: 'server spawned but health check timed out' }` (still ok=true because process was spawned -- caller should retry health check).

**stop()** — Graceful shutdown:
1. Read PID_PATH. If missing, return `{ ok: true, status: 'not-running' }`.
2. Try `process.kill(pid, 'SIGTERM')`. If ESRCH (no such process), clean up PID file and lastquery file, return `{ ok: true, status: 'already-dead' }`.
3. Wait up to 3 seconds for process to exit (poll with `process.kill(pid, 0)` in 200ms intervals).
4. If still alive after 3s, `process.kill(pid, 'SIGKILL')`.
5. Clean up PID_PATH and LASTQUERY_PATH. Return `{ ok: true, status: 'stopped' }`.
6. Wrap in try/catch, return `{ ok: false, error: e.message }` on unexpected failure.
7. CRITICAL (LivenessProperty1): PID file MUST be cleaned up in ALL exit paths (stopped, already-dead, error). Use a finally block or ensure cleanup in each branch.

**status()** — Report current state:
1. Check binary: exists at BINARY_PATH? executable?
2. Check PID: read PID_PATH, verify process alive with `process.kill(pid, 0)`.
3. Check health: quick HTTP GET to HEALTH_URL (spawnSync pattern, 1s timeout).
4. Check idle: read LASTQUERY_PATH timestamp, compute idle duration.
5. Return `{ binary: { installed, path }, process: { running, pid }, health: { healthy, latencyMs }, idle: { lastQueryMs, idleDurationMs, idleTimeoutMs: IDLE_TIMEOUT_MS } }`.

**touchLastQuery()** — Update last-query timestamp:
`fs.writeFileSync(LASTQUERY_PATH, String(Date.now()))`.
Return nothing. Wrap in try/catch (fail-open).

**checkIdleStop()** — Auto-stop if idle:
1. Read LASTQUERY_PATH. If missing, return (no-op).
2. If `Date.now() - lastQuery > IDLE_TIMEOUT_MS`, call stop().
3. Return the stop result or null if not idle.

**CLI interface** (when run directly):
```javascript
if (require.main === module) {
  const cmd = process.argv[2];
  // --start, --stop, --status, --update, --check-idle
  // Output JSON to stdout for each command
}
```

The --update subcommand should: call stop() if running, delete BINARY_PATH, call ensureBinary() to re-download latest, then optionally start if --start is also passed.

**Test file bin/coderlm-lifecycle.test.cjs:**

Create tests using node:test. Since we cannot actually download or spawn coderlm in tests, focus on:

1. **Module exports**: Verify ensureBinary, ensureRunning, stop, status, touchLastQuery, checkIdleStop are all exported functions.
2. **getPlatformBinaryName**: Verify it returns a string matching `/^coderlm-(darwin|linux)-(arm64|x64)$/` on supported platforms, or null on unsupported.
3. **ensureBinary idempotency**: If BINARY_PATH already exists (mock by checking the logic flow), the function should return `{ ok: true, source: 'cached' }` without attempting download. Test by creating a temp file at the expected path and verifying the cached path.
4. **PID file lifecycle**: Write a PID file, verify status() reads it; delete PID file, verify status() reports not-running. Verify stop() cleans up PID file even if the process does not exist (ESRCH handling).
5. **touchLastQuery and checkIdleStop**: Write a lastquery timestamp, verify checkIdleStop does NOT stop when within timeout. Write an old timestamp (Date.now() - 6 * 60 * 1000), verify checkIdleStop WOULD trigger stop (mock the actual kill).
6. **Zombie PID handling**: Test the case where PID file exists, process.kill(pid, 0) succeeds (process alive), but HTTP health check fails. ensureRunning() should clean up the stale PID and spawn a fresh process instead of returning success.
7. **CLI dispatch**: Verify `require.main === module` guard exists (grep test).
7. **Fail-open contracts**: Each exported function wrapped in try/catch and returns error object rather than throwing.

Use temp directories (os.tmpdir) for test isolation where PID/binary paths are involved. Override paths via an internal `_setPaths(dir)` test helper if needed, or use environment variable overrides for test isolation.
  </action>
  <verify>
1. `node -e "const m = require('./bin/coderlm-lifecycle.cjs'); console.log(Object.keys(m).sort().join(','))"` — outputs `checkIdleStop,ensureBinary,ensureRunning,status,stop,touchLastQuery`
2. `node --test bin/coderlm-lifecycle.test.cjs` — all tests pass
3. `grep "'use strict'" bin/coderlm-lifecycle.cjs` — confirms strict mode
4. `grep 'module.exports' bin/coderlm-lifecycle.cjs` — confirms CommonJS exports
5. `grep 'nForma-AI/coderlm' bin/coderlm-lifecycle.cjs` — confirms GitHub repo reference
6. `grep 'coderlm.pid' bin/coderlm-lifecycle.cjs` — confirms PID file management
7. `grep 'IDLE_TIMEOUT' bin/coderlm-lifecycle.cjs` — confirms idle timeout constant
  </verify>
  <done>
bin/coderlm-lifecycle.cjs exists with all 6 exported functions (ensureBinary, ensureRunning, stop, status, touchLastQuery, checkIdleStop). Module follows fail-open pattern (never throws to callers). Tests pass. CLI interface (--start, --stop, --status, --update, --check-idle) works when run directly. Binary download uses `gh release download`. PID file cleanup is guaranteed in all exit paths (LivenessProperty1). Existing binary at BINARY_PATH is preserved on re-run (OverridesPreserved).
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire lifecycle into nf-solve.cjs and update coderlm-adapter.cjs</name>
  <files>bin/nf-solve.cjs, bin/coderlm-adapter.cjs</files>
  <action>
Two files need targeted edits:

**A. bin/nf-solve.cjs — Replace NF_CODERLM_ENABLED gate with auto-start lifecycle:**

1. Add import at line 59 (after the coderlm-adapter require):
```javascript
const { ensureRunning, touchLastQuery, checkIdleStop } = require('./coderlm-lifecycle.cjs');
```

2. Replace the coderlm integration block (lines 5875-5920). The current code:
```javascript
if (process.env.NF_CODERLM_ENABLED === 'true') {
  try {
    const adapter = createAdapter();
    const healthResult = adapter.healthSync();
    if (healthResult.healthy) {
      // ... graph-driven wave ordering ...
    } else {
      process.stderr.write(TAG + ' coderlm unhealthy ...');
    }
  } catch (e) {
    process.stderr.write(TAG + ' WARNING: coderlm integration failed ...');
  }
}
```

Replace with (preserving the surrounding try/catch and fallback structure):
```javascript
// coderlm auto-start lifecycle (replaces NF_CODERLM_ENABLED gate)
// Fail-open: if ensureRunning fails, falls through to heuristic waves
try {
  const lifecycle = ensureRunning({ port: 8787, indexPath: ROOT });
  if (lifecycle.ok) {
    const adapter = createAdapter();
    const healthResult = adapter.healthSync();
    if (healthResult.healthy) {
      touchLastQuery();  // Update idle timer
      process.stderr.write(TAG + ' coderlm server healthy, attempting graph-driven wave ordering\n');

      // Collect active layers (residual > 0)
      const activeLayerKeys = [];
      for (const [key, val] of Object.entries(residual)) {
        if (val && typeof val === 'object' && val.residual > 0) {
          activeLayerKeys.push(key);
        }
      }

      if (activeLayerKeys.length > 0) {
        const discoveredEdges = queryEdgesSync(adapter, activeLayerKeys);
        process.stderr.write(TAG + ' coderlm discovered ' + discoveredEdges.length + ' inter-layer edge(s)\n');

        const graph = {
          nodes: activeLayerKeys,
          edges: discoveredEdges
        };

        const transitions = loadHypothesisTransitions(ROOT);
        const priorityWeights = computeLayerPriorityWeights(transitions);
        const graphWaves = computeWavesFromGraph(graph, priorityWeights);

        if (graphWaves.length > 0) {
          waveOrder = graphWaves;
          process.stderr.write(TAG + ' coderlm graph-driven wave ordering (' + graphWaves.length + ' waves): ' +
            graphWaves.map(w => 'W' + w.wave + '[' + w.layers.join(',') + ']' + (w.sequential ? '(seq)' : '')).join(' -> ') + '\n');
        }
      }
    } else {
      process.stderr.write(TAG + ' coderlm unhealthy after start (' + healthResult.error + '), falling back to heuristic waves\n');
    }
  } else {
    process.stderr.write(TAG + ' coderlm lifecycle: ' + (lifecycle.error || 'unavailable') + ', falling back to heuristic waves\n');
  }
} catch (e) {
  process.stderr.write(TAG + ' WARNING: coderlm integration failed: ' + e.message + ', falling back\n');
}
```

Key changes vs current code:
- REMOVED: `if (process.env.NF_CODERLM_ENABLED === 'true')` gate — coderlm now self-enables
- ADDED: `ensureRunning()` call to auto-download + auto-start before health check
- ADDED: `touchLastQuery()` call on successful health check to reset idle timer
- ADDED: `createAdapter({ enabled: true })` — always pass enabled:true since lifecycle manages enablement
- PRESERVED: The graph-driven wave ordering logic (activeLayerKeys, queryEdgesSync, computeWavesFromGraph) is unchanged
- PRESERVED: The outer try/catch and fallback to heuristic waves on ANY failure

3. Add idle check after the auto-close loop completes (after the waveOrder dispatch section, near the end of the iteration). Add a single line:
```javascript
checkIdleStop();  // Stop coderlm if idle > 5 min
```
Place this after the wave computation and dispatch section, so it runs at the end of each iteration. This is a fire-and-forget call (fail-open).

**B. bin/coderlm-adapter.cjs — Remove enabled gate from createAdapter default:**

Currently line 100: `const enabled = opts.enabled !== undefined ? opts.enabled : (process.env.NF_CODERLM_ENABLED === 'true');`

Change to: `const enabled = opts.enabled !== undefined ? opts.enabled : true;`

This makes the adapter default to enabled=true. The lifecycle module manages availability -- if the server is not running, health checks will fail and the adapter returns errors (which nf-solve handles via fail-open). The NF_CODERLM_ENABLED env var becomes unnecessary.

Keep the `opts.enabled` override so tests and callers can still explicitly disable. Add a comment:
```javascript
// Default: enabled=true — lifecycle module manages server availability.
// NF_CODERLM_ENABLED env var is no longer required (self-enabling with fail-open).
// Pass enabled:false explicitly to disable for testing.
const enabled = opts.enabled !== undefined ? opts.enabled : true;
```

**IMPORTANT constraints:**
- Do NOT modify the fallback heuristic wave computation (lines 5922-5930) — it remains the always-available fallback.
- Do NOT modify queryEdgesSync or LAYER_SCRIPT_MAP — those are unchanged from task #381.
- Do NOT modify computeWavesFromGraph or solve-wave-dag.cjs.
- Fail-open semantics MUST be preserved: any lifecycle failure results in graceful fallback, never a thrown exception to the caller.
- The `enabled` parameter on createAdapter MUST still accept explicit false (for tests) — only the DEFAULT changes.
  </action>
  <verify>
1. `grep 'coderlm-lifecycle' bin/nf-solve.cjs` — returns the require line
2. `grep 'ensureRunning' bin/nf-solve.cjs` — returns the call site
3. `grep 'touchLastQuery' bin/nf-solve.cjs` — returns the call site
4. `grep 'checkIdleStop' bin/nf-solve.cjs` — returns the call site
5. `grep 'NF_CODERLM_ENABLED' bin/nf-solve.cjs` — should return NO matches (gate removed)
6. `grep 'enabled.*true' bin/coderlm-adapter.cjs | head -3` — shows the new default
7. `node -e "const {createAdapter} = require('./bin/coderlm-adapter.cjs'); const a = createAdapter(); console.log(JSON.stringify(a.healthSync()))"` — returns a health result (not `{ error: 'disabled' }`)
8. `npm run test:ci` — all existing tests pass (fail-open means no breakage when coderlm is not running)
  </verify>
  <done>
nf-solve.cjs no longer requires NF_CODERLM_ENABLED=true. The coderlm server is auto-started via ensureRunning() before health check. If lifecycle fails (binary unavailable, download fails, server won't start), nf-solve falls through to heuristic waves. touchLastQuery() resets idle timer on successful query. checkIdleStop() runs at end of each iteration. coderlm-adapter.cjs defaults to enabled=true. All existing tests pass unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create /nf:coderlm skill and update docs</name>
  <files>commands/nf/coderlm.md, docs/coderlm-integration.md</files>
  <action>
**A. Create commands/nf/coderlm.md:**

Follow the project's skill file convention (YAML frontmatter with name, description, argument-hint, allowed-tools). Reference the commands/nf/debug.md format as a template for structure.

```yaml
---
name: nf:coderlm
description: Manage the coderlm symbol server lifecycle — start, stop, status, update. The server auto-starts during nf:solve, but this skill provides manual control.
argument-hint: "<start|stop|status|update>"
allowed-tools:
  - Bash
  - Read
---
```

Process section:

**Subcommand parsing:**
Parse the first argument as the subcommand. Valid: `start`, `stop`, `status`, `update`. If missing or invalid, show usage help.

**start:**
```bash
node bin/coderlm-lifecycle.cjs --start
```
Parse JSON output. Report: binary path, PID, whether it was already running or freshly started. If failed, show error and suggest checking `gh auth status` (for download issues) or disk space.

**stop:**
```bash
node bin/coderlm-lifecycle.cjs --stop
```
Parse JSON output. Report: stopped, already-dead, or not-running.

**status:**
```bash
node bin/coderlm-lifecycle.cjs --status
```
Parse JSON output. Render a formatted status table:
```
coderlm Status
  Binary:  installed at ~/.claude/nf-bin/coderlm (or: not installed)
  Process: running (PID 12345) (or: not running)
  Health:  healthy, 12ms latency (or: unhealthy — ECONNREFUSED)
  Idle:    2m 30s since last query (auto-stop at 5m)
```

**update:**
```bash
node bin/coderlm-lifecycle.cjs --update
```
This stops the running server (if any), deletes the cached binary, and re-downloads the latest release. Parse JSON output and report the result.

**Help (no argument or invalid argument):**
Display:
```
/nf:coderlm — Manage the coderlm symbol server

Usage:
  /nf:coderlm start    Start the server (downloads binary if needed)
  /nf:coderlm stop     Stop the running server
  /nf:coderlm status   Show server status (binary, process, health, idle)
  /nf:coderlm update   Update to the latest release (stop + re-download + start)

The server auto-starts during nf:solve runs. Manual control is optional.
```

**B. Update docs/coderlm-integration.md:**

Make the following targeted edits:

1. In the "Environment Variables" section, update `NF_CODERLM_ENABLED`:
   - Mark it as DEPRECATED. The coderlm lifecycle module now auto-starts the server.
   - Note: "As of task #383, coderlm self-enables. The NF_CODERLM_ENABLED env var is no longer required. The adapter defaults to enabled=true and the lifecycle module handles binary download and process management."

2. In the "Running a Local coderlm Server" section, add a new subsection at the top:
   ```
   ### Automatic Lifecycle (Recommended)
   
   coderlm is now managed automatically by nf:solve. On first run, the binary is
   downloaded from GitHub Releases to ~/.claude/nf-bin/coderlm. The server starts
   on-demand and stops after 5 minutes of idle.
   
   Manual control:
     /nf:coderlm start    — Start the server
     /nf:coderlm stop     — Stop the server  
     /nf:coderlm status   — Check status
     /nf:coderlm update   — Update to latest release
   
   The manual build-from-source workflow below is still supported for development.
   ```

3. In the "Architecture" section, add `coderlm-lifecycle` to the diagram between nf:solve and coderlm-adapter:
   ```
   nf:solve -> coderlm-lifecycle (ensureRunning) -> coderlm-adapter (queries)
                                                 -> coderlm binary (spawn/stop)
   ```

4. In the "Fallback Behavior" section, update item 1:
   - OLD: "Disabled (NF_CODERLM_ENABLED not set or 'false'): coderlm check is skipped"
   - NEW: "Binary unavailable (download failed, unsupported platform): coderlm is skipped, falls back to heuristic waves"

5. Add a new section "Lifecycle Management" after "Fallback Behavior" documenting:
   - Binary location: ~/.claude/nf-bin/coderlm
   - PID file: ~/.claude/nf-bin/coderlm.pid
   - Last-query timestamp: ~/.claude/nf-bin/coderlm.lastquery
   - Idle timeout: 5 minutes
   - Auto-download: from nForma-AI/coderlm GitHub Releases via `gh` CLI
   - Platform detection: darwin-arm64, darwin-x64, linux-x64, linux-arm64

Do NOT rewrite the entire document. Make surgical edits to the sections listed above. Preserve all other content (API Methods, Error Handling, Testing, Performance, Troubleshooting, Binary Distribution sections) unchanged.
  </action>
  <verify>
1. `test -f commands/nf/coderlm.md && echo exists` — file exists
2. `grep 'nf:coderlm' commands/nf/coderlm.md` — confirms skill name
3. `grep 'start.*stop.*status.*update' commands/nf/coderlm.md` — confirms all subcommands documented
4. `grep 'coderlm-lifecycle' commands/nf/coderlm.md` — confirms lifecycle module reference
5. `grep -i 'deprecated\|no longer required' docs/coderlm-integration.md` — confirms NF_CODERLM_ENABLED deprecation note
6. `grep 'Automatic Lifecycle' docs/coderlm-integration.md` — confirms new section
7. `grep 'coderlm-lifecycle' docs/coderlm-integration.md` — confirms lifecycle module in architecture
  </verify>
  <done>
commands/nf/coderlm.md exists with start/stop/status/update subcommands. docs/coderlm-integration.md updated with NF_CODERLM_ENABLED deprecation, automatic lifecycle section, updated architecture diagram, and updated fallback behavior. All existing doc sections preserved.
  </done>
</task>

</tasks>

<verification>
1. Full lifecycle works end-to-end: `node bin/coderlm-lifecycle.cjs --status` returns valid JSON status
2. Fail-open preserved: `NF_CODERLM_ENABLED` env var is NOT referenced in nf-solve.cjs (removed)
3. `npm run test:ci` passes — no regressions from adapter default change or lifecycle wiring
4. `node --test bin/coderlm-lifecycle.test.cjs` passes — lifecycle module unit tests
5. Skill file parseable: `grep 'name: nf:coderlm' commands/nf/coderlm.md` matches
6. `grep 'ensureRunning\|touchLastQuery\|checkIdleStop' bin/nf-solve.cjs` — all three lifecycle functions referenced
7. No dangling NF_CODERLM_ENABLED gate: `grep 'NF_CODERLM_ENABLED' bin/nf-solve.cjs` returns NO matches
</verification>

<success_criteria>
- bin/coderlm-lifecycle.cjs exists with 6 exports (ensureBinary, ensureRunning, stop, status, touchLastQuery, checkIdleStop)
- bin/coderlm-lifecycle.test.cjs passes all tests
- nf-solve.cjs imports and calls lifecycle functions, NF_CODERLM_ENABLED gate removed
- coderlm-adapter.cjs defaults to enabled=true
- commands/nf/coderlm.md skill file exists with 4 subcommands
- docs/coderlm-integration.md updated with lifecycle documentation
- npm run test:ci passes (no regressions)
</success_criteria>

<output>
After completion, create `.planning/quick/383-implement-coderlm-lazy-lifecycle-managem/383-SUMMARY.md`
</output>
