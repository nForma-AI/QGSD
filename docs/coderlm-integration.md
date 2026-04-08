# coderlm Integration in nf:solve

## Overview

coderlm is an indexed symbol and call graph server that provides precise inter-file dependency edges. nf:solve optionally integrates with coderlm to enable graph-driven remediation wave scheduling, which orders layer transitions based on actual source code dependencies rather than heuristic layer groupings.

When coderlm is unavailable, nf:solve falls back seamlessly to existing hypothesis-driven wave computation using `LAYER_DEPS` heuristics.

## Environment Variables

### `NF_CODERLM_ENABLED` (DEPRECATED)

> **Deprecated as of task #383.** coderlm now self-enables via the lifecycle module.
> The `NF_CODERLM_ENABLED` env var is no longer required. The adapter defaults to
> `enabled=true` and the lifecycle module handles binary download and process management.
> This variable is retained for backward compatibility but has no effect.

- **Default:** Ignored (adapter defaults to enabled)
- **Previous behavior:** When `'true'`, nf:solve attempted to connect to the coderlm server
- **Current behavior:** coderlm auto-starts on first nf:solve run; set `enabled: false` in adapter options to disable programmatically

### `NF_CODERLM_HOST`

The HTTP URL of the coderlm server.

- **Default:** `http://localhost:8787`
- **Format:** Full URL including protocol (http or https)
- **Example:** `http://coderlm-server:8787` or `https://coderlm.internal:443`

Example:
```bash
export NF_CODERLM_HOST='http://coderlm-prod:8787'
node bin/nf-solve.cjs
```

## Running a Local coderlm Server

### Automatic Lifecycle (Recommended)

coderlm is now managed automatically by nf:solve. On first run, the binary is
downloaded from GitHub Releases to `~/.claude/nf-bin/coderlm`. The server starts
on-demand and stops after 5 minutes of idle.

Manual control:
- `/nf:coderlm start`  -- Start the server
- `/nf:coderlm stop`   -- Stop the server
- `/nf:coderlm status` -- Check status
- `/nf:coderlm update` -- Update to latest release

The manual build-from-source workflow below is still supported for development.

### Build from Source

The coderlm server is a Rust binary maintained in the [coderlm repository](https://github.com/nForma-AI/coderlm). To run it locally:

1. **Build the coderlm server** (requires Rust):
   ```bash
   git clone https://github.com/nForma-AI/coderlm.git
   cd coderlm
   cargo build --release
   ```

2. **Start the server**:
   ```bash
   ./target/release/coderlm --port 8787 --index-path /path/to/project
   ```

3. **Verify the server is running**:
   ```bash
   curl http://localhost:8787/health
   # Expected response: {"status":"healthy"}
   ```

4. **Run nf:solve** (coderlm auto-detects the running server):
   ```bash
   node bin/nf-solve.cjs
   ```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 nf:solve (bin/nf-solve.cjs)        │
│  - Wave computation orchestration                    │
│  - Residual vector analysis                         │
│  - Auto-close with fallback support                 │
└──────────────────────┬──────────────────────────────┘
                       │ uses
       ┌───────────────┼────────────────┐
       │               │                │
┌──────▼──────────┐ ┌──▼──────────────┐ ┌▼─────────────────────┐
│ coderlm-        │ │ coderlm-adapter │ │ solve-wave-dag       │
│ lifecycle       │ │ (bin/coderlm-   │ │ (bin/solve-wave-dag  │
│ (bin/coderlm-   │ │  adapter.cjs)   │ │  .cjs)               │
│  lifecycle.cjs) │ │ - HTTP client   │ │ - computeWaves:      │
│ - ensureRunning │ │ - Health checks │ │   hypothesis-driven  │
│ - ensureBinary  │ │ - Query methods │ │ - computeWavesFromGraph│
│ - stop          │ │   * getCallers  │ │   graph-driven (SCC) │
│ - checkIdleStop │ │   * findTests   │ └──────────────────────┘
└──────┬──────────┘ └──────┬──────────┘
       │ spawn/stop        │ HTTP
       │                   │
┌──────▼───────────────────▼──────────────┐
│        coderlm Server (Rust binary)     │
│ ~/.claude/nf-bin/coderlm                │
│ - Indexed symbol/call graph             │
│ - Query endpoints (/callers, etc.)      │
│ - Health endpoint (/health)             │
│ - PID: ~/.claude/nf-bin/coderlm.pid     │
└─────────────────────────────────────────┘

Flow: nf:solve -> coderlm-lifecycle (ensureRunning) -> coderlm-adapter (queries)
                                                    -> coderlm binary (spawn/stop)
```

## Fallback Behavior

When coderlm is unavailable, nf:solve uses `LAYER_DEPS` heuristics:

1. **Binary unavailable** (download failed, unsupported platform): coderlm is skipped, falls back to heuristic waves
2. **Unhealthy** (health check fails after start): Falls back to hypothesis-driven waves
3. **Error** (exception during integration): Falls back to hypothesis-driven waves

The existing `computeWaves()` function is unchanged and remains the fallback path for all scenarios.

## Lifecycle Management

The `coderlm-lifecycle.cjs` module manages the full lifecycle of the coderlm binary and server process.

### File Locations

| File | Path | Purpose |
|---|---|---|
| Binary | `~/.claude/nf-bin/coderlm` | The coderlm server executable |
| PID file | `~/.claude/nf-bin/coderlm.pid` | Tracks running server process |
| Last-query | `~/.claude/nf-bin/coderlm.lastquery` | Timestamp of last query (for idle detection) |

### Auto-download

On first use (or after `update`), the binary is downloaded from the [nForma-AI/coderlm](https://github.com/nForma-AI/coderlm/releases) GitHub Releases via the `gh` CLI. Platform detection selects the correct binary:

| Platform | Architecture | Asset Name |
|---|---|---|
| macOS | Apple Silicon (arm64) | `coderlm-darwin-arm64` |
| macOS | Intel (x64) | `coderlm-darwin-x64` |
| Linux | x86_64 | `coderlm-linux-x64` |
| Linux | ARM64 | `coderlm-linux-arm64` |

### Idle Timeout

The server automatically stops after **5 minutes** of inactivity (no queries). The idle timer is reset each time nf:solve successfully queries the coderlm server. The `checkIdleStop()` function runs at the end of each nf:solve iteration.

### Exported Functions

| Function | Description |
|---|---|
| `ensureBinary()` | Idempotent binary download; preserves user-placed binaries |
| `ensureRunning(opts)` | Start server if not running; handles stale PIDs and zombie processes |
| `stop()` | Graceful shutdown with SIGTERM, escalating to SIGKILL after 3s |
| `status()` | Report binary, process, health, and idle state |
| `touchLastQuery()` | Reset the idle timer |
| `checkIdleStop()` | Stop server if idle > 5 minutes |

## Testing

### Adapter Tests

Run the coderlm adapter tests to verify HTTP connectivity and error handling:

```bash
node --test bin/coderlm-adapter.test.cjs
```

Expected output:
```
✔ Module exports
✔ createAdapter
✔ healthCheck — standalone function
✔ adapter.health() — async
✔ adapter.healthSync()
✔ adapter.getCallers()
✔ adapter.getImplementation()
✔ adapter.findTests()
✔ adapter.peek()
✔ Timeout behavior
tests 21, pass 21, fail 0
```

### Wave Scheduler Tests

Run the wave scheduler tests to verify graph-driven scheduling:

```bash
node --test bin/solve-wave-dag.test.cjs
```

Expected output includes:
```
✔ computeWavesFromGraph — graph-driven scheduling
✔ returns empty array for empty graph
✔ SCC/cycle detection collapses A -> B -> C -> A
✔ MAX_PER_WAVE enforcement: 5 independent nodes splits into waves
✔ priority weights influence intra-wave ordering
✔ Regression parity: existing computeWaves tests still pass
```

### End-to-End Testing

coderlm auto-starts during nf:solve. To test with a specific server:

```bash
export NF_CODERLM_HOST='http://localhost:8787'
node bin/nf-solve.cjs --report-only
```

Check stderr output for:
```
[nf-solve] coderlm graph-driven wave ordering available (server healthy)
[nf-solve] Wave ordering (N waves, M hypothesis transition(s) applied): ...
```

Or, if coderlm is unavailable:
```
[nf-solve] coderlm unhealthy (timeout), falling back to heuristic waves
[nf-solve] Wave ordering (N waves, M hypothesis transition(s) applied): ...
```

## API Methods

### createAdapter(opts)

Factory function that returns an adapter instance.

```javascript
const { createAdapter } = require('./bin/coderlm-adapter.cjs');

const adapter = createAdapter({
  host: 'http://localhost:8787',
  timeout: 5000,
  healthTimeout: 2000,
  enabled: true
});
```

**Options:**
- `host` (string): Server URL, defaults to `process.env.NF_CODERLM_HOST` or `http://localhost:8787`
- `timeout` (number): Query timeout in ms, default 5000
- `healthTimeout` (number): Health check timeout in ms, default 2000
- `enabled` (boolean): Enable adapter, defaults to `true` (lifecycle module manages availability)

### adapter.health()

Async health check.

```javascript
const result = await adapter.health();
// Returns: { healthy: boolean, latencyMs: number, error?: string }
```

### adapter.healthSync()

Synchronous health check (uses `spawnSync` pattern).

```javascript
const result = adapter.healthSync();
// Returns: { healthy: boolean, latencyMs: number, error?: string }
// Note: Returns synchronously, not a Promise
```

### adapter.getCallers(symbol, file)

Get all callers of a symbol.

```javascript
const result = await adapter.getCallers('myFunction', 'src/module.js');
// Returns: { callers?: string[], error?: string }
```

### adapter.getImplementation(symbol)

Get the file and line number where a symbol is defined.

```javascript
const result = await adapter.getImplementation('myFunction');
// Returns: { file?: string, line?: number, error?: string }
```

### adapter.findTests(file)

Get test files associated with a source file.

```javascript
const result = await adapter.findTests('src/module.js');
// Returns: { tests?: string[], error?: string }
```

### adapter.peek(file, startLine, endLine)

Get source code lines from a file.

```javascript
const result = await adapter.peek('src/module.js', 10, 20);
// Returns: { lines?: string[], error?: string }
```

## Error Handling

All adapter methods follow a fail-open pattern:

- **Never throw**: All methods return result objects with optional `error` property
- **Timeout**: `{ error: 'timeout' }` after the configured timeout expires
- **HTTP 4xx/5xx**: `{ error: 'HTTP {statusCode}' }`
- **Connection refused**: `{ error: 'ECONNREFUSED' }`
- **Disabled**: `{ error: 'disabled' }` when `enabled: false`

Example:
```javascript
const result = await adapter.getCallers('sym', 'file.js');
if (result.error) {
  console.error('Query failed:', result.error);
  // Use fallback logic
} else {
  console.log('Callers:', result.callers);
}
```

## Integration with nf:solve

In `bin/nf-solve.cjs`, the coderlm integration happens during wave computation via the lifecycle module:

```javascript
// INSIDE THE AUTO-CLOSE LOOP
// coderlm auto-start lifecycle (replaces NF_CODERLM_ENABLED gate)
const lifecycle = ensureRunning({ port: 8787, indexPath: ROOT });
if (lifecycle.ok) {
  const adapter = createAdapter({ enabled: true });
  const healthResult = adapter.healthSync();
  if (healthResult.healthy) {
    touchLastQuery();  // Reset idle timer
    // Query for inter-layer edges and call computeWavesFromGraph
    const edges = queryEdgesSync(adapter, activeLayerKeys);
    const graphWaves = computeWavesFromGraph(graph, priorityWeights);
  }
}

// Fallback: always use hypothesis-driven waves if coderlm unavailable
if (!waveOrder) {
  const computedWaves = computeWaves(residual, priorityWeights);
}

// After wave dispatch
checkIdleStop();  // Stop coderlm if idle > 5 min
```

## Performance Considerations

- **Health checks**: Default 2000ms timeout, suitable for local/internal servers
- **Query timeouts**: Default 5000ms timeout for symbol and code queries
- **Synchronous health checks**: Use `spawnSync` pattern, blocking but suitable for CLI context
- **No caching**: Each nf:solve iteration queries coderlm fresh (consider adding cache if latency becomes an issue)

## Troubleshooting

### Connection Refused

```
[nf-solve] coderlm unhealthy (ECONNREFUSED), falling back to heuristic waves
```

**Fix**: Ensure coderlm server is running on the specified host/port:
```bash
curl http://localhost:8787/health
# Should return 200 OK with {"status":"ok"} or similar
```

### Timeout

```
[nf-solve] coderlm unhealthy (timeout), falling back to heuristic waves
```

**Fix**: Check network latency or increase timeout via adapter options in nf-solve.cjs.

### Binary Download Failed

If the coderlm binary cannot be downloaded (network issues, `gh` not installed, auth required):

```
[nf-solve] coderlm lifecycle: download-failed, falling back to heuristic waves
```

**Fix**: Ensure `gh` CLI is installed and authenticated:
```bash
gh auth status
gh release download --repo nForma-AI/coderlm --pattern "coderlm-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')"
```

## Binary Distribution

Pre-built coderlm binaries are published to GitHub Releases in the [coderlm repository](https://github.com/nForma-AI/coderlm/releases) via CI. The release workflow cross-compiles for four platforms:

| Binary Asset | Target | Runner |
|---|---|---|
| `coderlm-darwin-arm64` | macOS Apple Silicon (aarch64) | macos-latest |
| `coderlm-darwin-x64` | macOS Intel (x86_64) | macos-13 |
| `coderlm-linux-x64` | Linux x86_64 | ubuntu-latest |
| `coderlm-linux-arm64` | Linux ARM64 (aarch64) | ubuntu-latest + cross |

Releases are triggered automatically when a version tag (`v*`) is pushed to the coderlm repo.

To download the binary for your platform:

```bash
# Determine platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')

# Download latest release
gh release download --repo nForma-AI/coderlm --pattern "coderlm-${OS}-${ARCH}" --output coderlm
chmod +x coderlm
```

Each binary is accompanied by a SHA256 checksum file for integrity verification:

```bash
sha256sum -c coderlm-darwin-arm64.sha256
```

## Future Enhancements

1. **Full graph-driven integration**: Implement `computeWavesFromGraph` call with actual inter-layer edge queries
2. **Result caching**: Cache query results for the duration of a solve iteration
3. **Metrics**: Track coderlm health/latency in solve telemetry
4. **Partial indexing**: Support coderlm on subsets of the codebase (e.g., specific packages)
