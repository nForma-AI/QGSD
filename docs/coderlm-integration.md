# coderlm Integration in nf:solve

## Overview

coderlm is an indexed symbol and call graph server that provides precise inter-file dependency edges. nf:solve optionally integrates with coderlm to enable graph-driven remediation wave scheduling, which orders layer transitions based on actual source code dependencies rather than heuristic layer groupings.

When coderlm is unavailable, nf:solve falls back seamlessly to existing hypothesis-driven wave computation using `LAYER_DEPS` heuristics.

## Environment Variables

### `NF_CODERLM_ENABLED`

Enables coderlm integration in nf:solve.

- **Default:** `false` (unset)
- **Accepted values:** `'true'`, `'false'` (case-sensitive string, not boolean)
- **Effect:** When `'true'`, nf:solve attempts to connect to the coderlm server during wave computation

Example:
```bash
export NF_CODERLM_ENABLED='true'
node bin/nf-solve.cjs
```

### `NF_CODERLM_HOST`

The HTTP URL of the coderlm server.

- **Default:** `http://localhost:8787`
- **Format:** Full URL including protocol (http or https)
- **Example:** `http://coderlm-server:8787` or `https://coderlm.internal:443`

Example:
```bash
export NF_CODERLM_ENABLED='true'
export NF_CODERLM_HOST='http://coderlm-prod:8787'
node bin/nf-solve.cjs
```

## Running a Local coderlm Server

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

4. **Enable in nf:solve**:
   ```bash
   export NF_CODERLM_ENABLED='true'
   export NF_CODERLM_HOST='http://localhost:8787'
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
       ┌───────────────┴────────────────┐
       │                                │
┌──────▼──────────────────┐  ┌──────────▼────────────────┐
│  coderlm-adapter        │  │  solve-wave-dag          │
│ (bin/coderlm-adapter    │  │  (bin/solve-wave-dag     │
│  .cjs)                  │  │   .cjs)                  │
│ - HTTP client           │  │ - computeWaves:          │
│ - Health checks         │  │   hypothesis-driven      │
│ - Query methods:        │  │ - computeWavesFromGraph: │
│   * getCallers          │  │   graph-driven (via SCC  │
│   * getImplementation   │  │   collapsing)            │
│   * findTests           │  └──────────┬───────────────┘
│   * peek                │             │
└──────┬─────────────────┘             │
       │                               │
       │ HTTP                    Returns
       │                          wave objects
┌──────▼──────────────────────────────────┐
│        coderlm Server (Rust binary)     │
│ - Indexed symbol/call graph             │
│ - Query endpoints (/callers, etc.)      │
│ - Health endpoint (/health)             │
└─────────────────────────────────────────┘
```

## Fallback Behavior

When coderlm is unavailable or disabled, nf:solve uses `LAYER_DEPS` heuristics:

1. **Disabled** (`NF_CODERLM_ENABLED` not set or `'false'`): coderlm check is skipped
2. **Unhealthy** (health check fails): Falls back to hypothesis-driven waves
3. **Error** (exception during integration): Falls back to hypothesis-driven waves

The existing `computeWaves()` function is unchanged and remains the fallback path for all scenarios.

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

With a local coderlm server running on port 8787:

```bash
export NF_CODERLM_ENABLED='true'
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
- `enabled` (boolean): Enable adapter, defaults to `process.env.NF_CODERLM_ENABLED === 'true'`

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

In `bin/nf-solve.cjs`, the coderlm integration happens during wave computation:

```javascript
// INSIDE THE AUTO-CLOSE LOOP
if (process.env.NF_CODERLM_ENABLED === 'true') {
  const adapter = createAdapter();
  const healthResult = adapter.healthSync();
  if (healthResult.healthy) {
    // coderlm server is available
    // TODO: Query for inter-layer edges and call computeWavesFromGraph
    process.stderr.write(TAG + ' coderlm graph-driven wave ordering available\n');
  } else {
    // Fall back to hypothesis-driven waves
    process.stderr.write(TAG + ' coderlm unhealthy, falling back\n');
  }
}

// Fallback: always use hypothesis-driven waves
const computedWaves = computeWaves(residual, priorityWeights);
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

### Disabled

If `NF_CODERLM_ENABLED` is not `'true'` (e.g., `'false'`, unset, or any other value), coderlm is silently skipped.

**Fix**: Set the env var explicitly:
```bash
export NF_CODERLM_ENABLED='true'
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
