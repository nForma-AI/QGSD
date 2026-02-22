# Phase 25: Identity Tool and Shared Utilities - Research

**Researched:** 2026-02-22
**Domain:** TypeScript MCP server standardization — identity tool response schema, constants.ts, Logger utility
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STD-04 | All 6 repos expose an `identity` tool returning `{name, version, model, available_models, install_method}` | Gap analysis complete: 2 repos (claude, openhands) have no identity tool; 4 repos (codex, copilot, gemini, opencode) have identity but with a different response shape (`server/version/llm` not `name/version/model/available_models/install_method`) — all 6 need schema upgrade |
| STD-08 | All 6 repos have `constants.ts` and `src/utils/logger.ts` | Gap analysis complete: gemini and opencode already have both; claude, codex, copilot, openhands are missing both |
</phase_requirements>

---

## Summary

Phase 25 has two parallel workstreams: (1) ensure all 6 MCP server repos expose an `identity` tool with the exact 5-field schema `{name, version, model, available_models, install_method}`, and (2) add `src/constants.ts` and `src/utils/logger.ts` to the 4 repos that currently lack them (claude, codex, copilot, openhands).

After Phase 24's Gen2 port, the current state is: **codex, copilot, gemini, opencode** all have an `identityTool` registered, but its response shape is wrong for STD-04 — it returns `{server, version, mcp_server_name, llm}` not `{name, version, model, available_models, install_method}`. **claude and openhands** have no identity tool at all. For STD-08, **gemini and opencode** already have both `constants.ts` and `logger.ts`; the other 4 repos need both created. The Logger in gemini and opencode is the canonical reference — identical implementation, only `LOG_PREFIX` differs.

The identity tool response is the data source for Phase 26's `/qgsd:mcp-status` command, so the schema must be locked and consistent across all 6 repos. The `install_method` field requires detecting how the server is installed (npm global / brew / binary). `available_models` must list all supported model strings for that agent. Version must be read dynamically from `package.json` (STD-03 already mandated this in Phase 23; codex already implements it).

**Primary recommendation:** Implement in 3 plans: Plan 1 = define the canonical identity response schema and update all 6 `simple-tools.ts` identity tools simultaneously; Plan 2 = add `constants.ts` to the 4 missing repos; Plan 3 = add `logger.ts` to the 4 missing repos and replace direct `console.log` calls in each.

---

## Gap Analysis Per Repo

| Repo | Has identity tool | Identity shape correct | Has constants.ts | Has logger.ts |
|------|-------------------|------------------------|------------------|----------------|
| claude-mcp-server | NO | N/A | NO | NO |
| codex-mcp-server | YES | NO (wrong fields) | NO | NO |
| copilot-mcp-server | YES | NO (wrong fields) | NO | NO |
| openhands-mcp-server | NO | N/A | NO | NO |
| gemini-mcp-server | YES | NO (wrong fields) | YES | YES |
| opencode-mcp-server | YES | NO (wrong fields) | YES | YES |

**Key finding:** No repo currently returns the Phase 25 required schema `{name, version, model, available_models, install_method}`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `zod` | ^4.x (already in all repos) | Schema validation for identity tool args | Already present — no new install needed |
| `fs.readFileSync` | Node built-in | Read package.json for dynamic version | Already used in codex/copilot simple-tools.ts |
| `path.join` | Node built-in | Construct package.json path | Already used in codex/copilot simple-tools.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `chalk` | already in all repos | Console color in Logger | Logger uses console.warn internally — chalk for error output in index.ts only |

**Installation:** No new packages needed. All repos already have the correct dependencies.

---

## Architecture Patterns

### Identity Tool Response Schema (the target for STD-04)

The Phase 25 success criteria defines the exact 5-field schema. This is what ALL 6 repos must return:

```typescript
// Target schema for identity tool execute():
{
  name: string,            // e.g. "claude-mcp-server"
  version: string,         // dynamic from package.json, e.g. "1.4.0"
  model: string,           // current active model (env var ?? default constant)
  available_models: string[], // all supported model strings for this agent
  install_method: string,  // "npm" | "brew" | "binary" | "unknown"
}
```

**Why this differs from current:** All 4 repos with existing identity return `{server, version, mcp_server_name, llm}` — field names are different and `available_models` and `install_method` are absent.

### install_method Detection Pattern

```typescript
// Source: derived from STD-04 requirement and Phase 26 (mcp-status) consumer needs
function detectInstallMethod(): string {
  // npm global install: executable is in a path containing node_modules/.bin or npm prefix
  const execPath = process.execPath; // node binary path
  if (execPath.includes('nvm') || execPath.includes('node_modules')) {
    return 'npm';
  }
  // brew install: path contains /homebrew/ or /opt/homebrew/
  if (execPath.includes('homebrew') || execPath.includes('/opt/homebrew')) {
    return 'brew';
  }
  return 'binary';
}
```

Note: A simpler approach that is sufficient for Phase 26 consumption: check `process.env.npm_config_prefix` (set by npm during global installs). If present, return `'npm'`. If `process.argv[0]` path contains `homebrew`, return `'brew'`. Otherwise `'binary'`.

### Version-from-package.json Pattern (already established in Phase 23/24)

Codex already implements this. Use this exact pattern in all repos:

```typescript
// Source: /Users/jonathanborduas/code/codex-mcp-server/src/tools/simple-tools.ts (live)
import { readFileSync } from 'fs';
import { join } from 'path';

function loadPackageVersion(): string {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const data = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return data.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
const pkgVersion = loadPackageVersion();
```

Note: `process.cwd()` approach works in both ESM runtime and ts-jest. `__dirname` does NOT work in ESM. Keep the `try/catch` fallback.

### constants.ts Pattern (canonical: gemini and opencode)

The gemini and opencode `constants.ts` files are the canonical reference. Each repo's `constants.ts` must define at minimum:
- `LOG_PREFIX` — unique per repo (e.g., `'[CMCP]'` for claude, `'[CDMCP]'` for codex, `'[CPMCP]'` for copilot, `'[OHMCP]'` for openhands)
- `ERROR_MESSAGES` — standard error strings
- `STATUS_MESSAGES` — standard status strings
- `PROTOCOL` — MCP protocol constants (roles, content types, status, keepalive interval)
- Re-export of `ToolArguments` from `./types.js`

**Also required:** Each `constants.ts` should define `SERVER_NAME` and `DEFAULT_MODEL` constants so `index.ts` and tool files have no magic strings:

```typescript
// Minimum required constants for STD-08 compliance
export const SERVER_NAME = 'claude-mcp-server' as const;
export const DEFAULT_MODEL = DEFAULT_CLAUDE_MODEL; // re-exported from types.ts
export const LOG_PREFIX = '[CMCP]';
```

### Logger Pattern (canonical: gemini and opencode)

The Logger in both gemini and opencode is **identical** (same class, same methods). Only `LOG_PREFIX` import source differs. Copy verbatim from opencode (simpler, no `toolParsedArgs` with gemini-specific `changeMode` param):

```typescript
// Source: /Users/jonathanborduas/code/opencode-mcp-server/src/utils/logger.ts (live)
import { LOG_PREFIX } from '../constants.js';

export class Logger {
  private static formatMessage(message: string): string {
    return `${LOG_PREFIX} ${message}` + '\n';
  }
  static log(message: string, ...args: unknown[]): void { console.warn(this.formatMessage(message), ...args); }
  static warn(message: string, ...args: unknown[]): void { console.warn(this.formatMessage(message), ...args); }
  static error(message: string, ...args: unknown[]): void { console.error(this.formatMessage(message), ...args); }
  static debug(message: string, ...args: unknown[]): void { console.warn(this.formatMessage(message), ...args); }
  static toolInvocation(toolName: string, args: unknown): void { this.warn('Raw:', JSON.stringify(args, null, 2)); }
  static commandExecution(command: string, args: string[], startTime: number): void { ... }
  static commandComplete(startTime: number, exitCode: number | null, outputLength?: number): void { ... }
}
```

Note: Logger uses `console.warn` internally (not `console.log`) — this is intentional. MCP servers write JSON to stdout; using `console.warn` routes diagnostic output to stderr, avoiding MCP protocol corruption.

### Recommended Project Structure After Phase 25

```
src/
├── __tests__/           # Existing tests — add identity tests
├── constants.ts         # NEW (claude, codex, copilot, openhands) / UPDATED (gemini, opencode)
│                        # Must define: LOG_PREFIX, SERVER_NAME, DEFAULT_MODEL, ERROR_MESSAGES, etc.
├── tools/
│   ├── simple-tools.ts  # UPDATED: add identity tool (claude, openhands) or update schema (codex, copilot)
│   ├── index.ts         # UPDATED (claude, openhands): register identityTool
│   └── ...              # Other tools unchanged
├── types.ts             # UPDATED (claude, openhands): add TOOLS.IDENTITY constant
└── utils/
    ├── logger.ts        # NEW (claude, codex, copilot, openhands)
    └── command.ts       # UPDATED: replace console.log calls with Logger
```

### Anti-Patterns to Avoid

- **Hardcoding version in identity tool:** Use `loadPackageVersion()` pattern — never `version: '1.4.0'`. Gemini currently hardcodes `'1.1.1'` — this is a defect to fix.
- **Using console.log for operational output:** Logger routes to stderr (console.warn) to protect stdout JSON protocol. Direct `console.log` in non-startup code breaks MCP.
- **Mismatch between field names:** The required schema is `name/version/model/available_models/install_method`. Not `server/llm/mcp_server_name`. Phase 26 reads these exact keys.
- **Adding TOOLS.IDENTITY but not registering in index.ts:** Must add the constant to types.ts AND add identityTool to `toolRegistry.push()` in index.ts.
- **Replacing startup console.error calls with Logger:** The `index.ts` startup error pattern (`console.error(chalk.red(...))`) is acceptable to keep — it fires before the server starts, not during MCP protocol operation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Install method detection | Complex process inspection logic | Simple 3-branch check on `process.env.npm_config_prefix` and `process.argv[0]` | Phase 26 needs a string, not perfect accuracy |
| Structured logging | Custom log formatter | Logger class copied from opencode/gemini | Already works, tested, routes to stderr correctly |
| Version reading | Parsing npm ls or other CLI output | `readFileSync(join(process.cwd(), 'package.json'))` | Already established pattern in codex/copilot |
| available_models list | Dynamic CLI interrogation | Static array from types.ts `AVAILABLE_X_MODELS` constant | Models don't change at runtime; CLI interrogation is fragile |

**Key insight:** All patterns are already implemented in at least one repo — this phase is mechanical propagation, not invention.

---

## Common Pitfalls

### Pitfall 1: Identity Schema Field Name Mismatch

**What goes wrong:** Phase 26 `/qgsd:mcp-status` reads `response.name`, `response.model`, `response.available_models`, `response.install_method`. If any repo returns `server`, `llm`, or `mcp_server_name`, mcp-status silently gets `undefined`.
**Why it happens:** 4 repos already have identity tools with different field names. Copying from them produces wrong output.
**How to avoid:** Use only the Phase 25 target schema. Never copy field names from existing identity implementations.
**Warning signs:** `npm-status` shows undefined values for any agent.

### Pitfall 2: Version Hardcoded in Identity (gemini, opencode)

**What goes wrong:** Gemini and opencode currently hardcode `version: '1.1.1'` in identity. After npm publish, the version drifts from `package.json`.
**Why it happens:** The dynamic version pattern (`loadPackageVersion()`) was implemented in codex/copilot but not backported to gemini/opencode.
**How to avoid:** Apply `loadPackageVersion()` to all 6 repos, including gemini and opencode.
**Warning signs:** Identity returns version `1.1.1` even after the package is bumped.

### Pitfall 3: constants.ts Breaks Existing Types Imports

**What goes wrong:** Adding `constants.ts` that re-exports `ToolArguments` from `./types.js` creates a circular import if `types.ts` also imports from `constants.ts`.
**Why it happens:** Gemini's `constants.ts` does `export { ToolArguments, MODELS } from './types.js'`. If constants.ts later imports from types.ts that imports from constants.ts, circular reference breaks Node ESM.
**How to avoid:** constants.ts may re-export FROM types.ts, but types.ts must NEVER import from constants.ts. Keep model constants (`DEFAULT_X_MODEL`, `AVAILABLE_X_MODELS`) in types.ts, mirror them in constants.ts via re-export.
**Warning signs:** TypeScript compile error about circular references.

### Pitfall 4: Logger console.warn vs console.log (MCP stdout safety)

**What goes wrong:** Any `console.log()` in the MCP server writes to stdout, which is the JSON-RPC stream. An extra line of text corrupts the protocol and breaks Claude's MCP connection.
**Why it happens:** Developers habitually use `console.log`. The Logger class uses `console.warn` (stderr).
**How to avoid:** Replace all `console.log` calls with `Logger.log()`. Leave `console.error` in `index.ts` startup handler (stderr is safe).
**Warning signs:** MCP server connects then immediately fails with parse errors; Claude shows "MCP server disconnected."

### Pitfall 5: TOOLS.IDENTITY Missing from types.ts Causes TypeScript Error

**What goes wrong:** Adding `identityTool` to simple-tools.ts that references `TOOLS.IDENTITY` fails to compile because `TOOLS` object in types.ts doesn't have the `IDENTITY` key yet (claude and openhands).
**Why it happens:** The TOOLS constant drives TypeScript's `ToolName` union type — missing key causes type error on `TOOLS.IDENTITY` access.
**How to avoid:** Add `IDENTITY: 'identity'` to the `TOOLS` object in types.ts BEFORE writing the identity tool.
**Warning signs:** TypeScript error: `Property 'IDENTITY' does not exist on type '{ ... }'`.

### Pitfall 6: install_method Detection Unreliable in Some Environments

**What goes wrong:** `process.env.npm_config_prefix` is set during `npm install` but may not be set when the installed binary is invoked via `claude-mcp-server` CLI.
**Why it happens:** npm sets `npm_config_prefix` during lifecycle scripts, not during normal process execution.
**How to avoid:** Use `process.argv[1]` path inspection as primary signal (contains `node_modules` for npm global), fall back to `'npm'` if detection is ambiguous. Return `'unknown'` rather than a wrong value.
**Warning signs:** All agents return `'binary'` even when installed via npm.

---

## Code Examples

### Target Identity Tool (apply to all 6 repos)

```typescript
// Pattern for all 6 repos — field names MUST match exactly
import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { UnifiedTool, ToolArguments } from './registry.js';

// Reuse loadPackageVersion from codex/copilot pattern
function loadPackageVersion(): string {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const data = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return data.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function detectInstallMethod(): string {
  const argv1 = process.argv[1] ?? '';
  if (argv1.includes('node_modules')) return 'npm';
  if (argv1.includes('homebrew') || argv1.includes('/opt/homebrew')) return 'brew';
  if (process.env['npm_config_prefix']) return 'npm';
  return 'binary';
}

const identityArgsSchema = z.object({});

export const identityTool: UnifiedTool = {
  name: 'identity',  // or TOOLS.IDENTITY if constant is defined
  description: 'Get server identity: name, version, active model, available models, and install method. Used by QGSD mcp-status.',
  zodSchema: identityArgsSchema,
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  annotations: {
    title: 'Server Identity',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  category: 'simple',
  execute: async (_args: ToolArguments): Promise<string> => {
    return JSON.stringify({
      name: 'claude-mcp-server',                     // server name constant
      version: loadPackageVersion(),                   // dynamic from package.json
      model: process.env['CLAUDE_DEFAULT_MODEL'] ?? 'claude-sonnet-4-6',  // env ?? default
      available_models: [                              // static list from types.ts
        'claude-sonnet-4-6',
        'claude-opus-4-6',
        'claude-haiku-4-5-20251001',
      ],
      install_method: detectInstallMethod(),           // 'npm' | 'brew' | 'binary'
    }, null, 2);
  },
};
```

### constants.ts for Gen1-ported repos (minimal version)

```typescript
// Source pattern: /Users/jonathanborduas/code/opencode-mcp-server/src/constants.ts (live)
// Adapt LOG_PREFIX and re-exported constants per repo

export { ToolArguments } from './types.js';

// Server identity constants (eliminates magic strings)
export const SERVER_NAME = 'claude-mcp-server' as const;
export const LOG_PREFIX = '[CMCP]';

// Error messages
export const ERROR_MESSAGES = {
  TOOL_NOT_FOUND: 'not found in registry',
  NO_PROMPT_PROVIDED: 'Please provide a prompt.',
} as const;

// Status messages
export const STATUS_MESSAGES = {
  PROCESSING_START: 'Starting Claude analysis...',
  PROCESSING_COMPLETE: 'Analysis completed successfully',
} as const;

// MCP Protocol Constants
export const PROTOCOL = {
  ROLES: { USER: 'user', ASSISTANT: 'assistant' },
  CONTENT_TYPES: { TEXT: 'text' },
  STATUS: { SUCCESS: 'success', ERROR: 'error', FAILED: 'failed', REPORT: 'report' },
  NOTIFICATIONS: { PROGRESS: 'notifications/progress' },
  KEEPALIVE_INTERVAL: 25000,
} as const;
```

### logger.ts (copy verbatim from opencode, only LOG_PREFIX import source changes)

```typescript
// Source: /Users/jonathanborduas/code/opencode-mcp-server/src/utils/logger.ts (live)
import { LOG_PREFIX } from '../constants.js';

export class Logger {
  private static formatMessage(message: string): string {
    return `${LOG_PREFIX} ${message}` + '\n';
  }

  static log(message: string, ...args: unknown[]): void {
    console.warn(this.formatMessage(message), ...args);
  }

  static warn(message: string, ...args: unknown[]): void {
    console.warn(this.formatMessage(message), ...args);
  }

  static error(message: string, ...args: unknown[]): void {
    console.error(this.formatMessage(message), ...args);
  }

  static debug(message: string, ...args: unknown[]): void {
    console.warn(this.formatMessage(message), ...args);
  }

  static toolInvocation(toolName: string, args: unknown): void {
    this.warn('Raw:', JSON.stringify(args, null, 2));
  }

  private static _commandStartTimes = new Map<
    number,
    { command: string; args: string[]; startTime: number }
  >();

  static commandExecution(command: string, args: string[], startTime: number): void {
    this.warn(`[${startTime}] Starting: ${command} ${args.map((arg) => `"${arg}"`).join(' ')}`);
    this._commandStartTimes.set(startTime, { command, args, startTime });
  }

  static commandComplete(startTime: number, exitCode: number | null, outputLength?: number): void {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.warn(`[${elapsed}s] Process finished with exit code: ${exitCode}`);
    if (outputLength !== undefined) {
      this.warn(`Response: ${outputLength} chars`);
    }
    this._commandStartTimes.delete(startTime);
  }
}
```

### Test Pattern for Identity Tool

```typescript
// Add to each repo's index.test.ts
describe('Identity Tool', () => {
  test('identity tool returns all 5 required fields', async () => {
    const result = await executeTool('identity', {});
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.name).toBeTruthy();
    expect(parsed.version).toBeTruthy();
    expect(parsed.model).toBeTruthy();
    expect(Array.isArray(parsed.available_models)).toBe(true);
    expect((parsed.available_models as string[]).length).toBeGreaterThan(0);
    expect(parsed.install_method).toBeTruthy();
  });

  test('identity tool version reads from package.json', async () => {
    const result = await executeTool('identity', {});
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.version).not.toBe('0.0.0');  // ensure real version loaded
    expect(parsed.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
```

---

## Per-Repo Work Items

### claude-mcp-server

**Identity tool:** Create from scratch. No `TOOLS.IDENTITY` constant exists — add to types.ts. No identity in simple-tools.ts — add. No identity in index.ts — add to `toolRegistry.push()`.

**constants.ts:** Create from scratch. LOG_PREFIX = `'[CMCP]'`. Re-export `ToolArguments` from types.ts. Define `SERVER_NAME = 'claude-mcp-server'`.

**logger.ts:** Copy from opencode verbatim. Update LOG_PREFIX import to `'../constants.js'`.

**console replacement:** 12 `console.*` calls in non-test src files. Replace operational ones with Logger. Keep startup `console.error` in index.ts.

**Available models:** `AVAILABLE_CLAUDE_MODELS` already defined in types.ts — use it.

---

### codex-mcp-server

**Identity tool:** EXISTS but wrong schema. Update `execute()` to return `{name, version, model, available_models, install_method}`. `loadPackageVersion()` already present. `TOOLS.IDENTITY` already in types.ts.

**constants.ts:** Create from scratch. LOG_PREFIX = `'[CDMCP]'`.

**logger.ts:** Copy from opencode verbatim.

**console replacement:** 16 `console.*` calls. Replace operational ones.

**Available models:** `AVAILABLE_CODEX_MODELS` already defined in types.ts — use it.

---

### copilot-mcp-server

**Identity tool:** EXISTS but wrong schema. Update `execute()`. `loadPackageVersion()` already present. `TOOLS.IDENTITY` already in types.ts. No `AVAILABLE_COPILOT_MODELS` constant yet — add to types.ts.

**constants.ts:** Create from scratch. LOG_PREFIX = `'[CPMCP]'`.

**logger.ts:** Copy from opencode verbatim.

**console replacement:** 12 `console.*` calls.

**Available models:** Not yet defined — must add `AVAILABLE_COPILOT_MODELS` array to types.ts. Copilot CLI supports gpt-4.1, gpt-4o, claude models — check copilot CLI docs or use `['gpt-4.1', 'gpt-4o', 'claude-3.5-sonnet']` as reasonable list (LOW confidence on exact list).

---

### openhands-mcp-server

**Identity tool:** Missing entirely. `TOOLS` object has only `REVIEW/PING/HELP` — add `IDENTITY`. Add identityTool to simple-tools.ts. Add to index.ts `toolRegistry.push()`. No model constants exist — must add `DEFAULT_OPENHANDS_MODEL` and `AVAILABLE_OPENHANDS_MODELS` to types.ts (openhands is a framework, not a specific model — identity.model should reflect the underlying LLM or 'framework-managed').

**constants.ts:** Create from scratch. LOG_PREFIX = `'[OHMCP]'`.

**logger.ts:** Copy from opencode verbatim.

**console replacement:** 12 `console.*` calls.

---

### gemini-mcp-server

**Identity tool:** EXISTS but wrong schema AND hardcoded version. Update `execute()` to return correct 5-field schema. Apply `loadPackageVersion()`. Add `AVAILABLE_GEMINI_MODELS` to types.ts if not present (MODELS.PRO/FLASH already defined in types.ts).

**constants.ts:** ALREADY EXISTS. May need `SERVER_NAME` added as a new constant.

**logger.ts:** ALREADY EXISTS. No changes needed.

**console replacement:** Already using Logger (40 calls). Few remaining `console.*` calls are in changeModeParser and startup — acceptable.

---

### opencode-mcp-server

**Identity tool:** EXISTS but wrong schema AND hardcoded version. Update `execute()`. Apply `loadPackageVersion()`.

**constants.ts:** ALREADY EXISTS. May need `SERVER_NAME` added.

**logger.ts:** ALREADY EXISTS. No changes needed.

**console replacement:** Already using Logger. Few remaining acceptable.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `{server, version, mcp_server_name, llm}` identity | `{name, version, model, available_models, install_method}` identity | Phase 26 mcp-status can read all fields without guessing |
| Hardcoded version string in identity | `loadPackageVersion()` reads package.json | Version stays accurate after npm publish |
| Direct `console.log` calls | `Logger.log()` routed to stderr | Prevents MCP stdout protocol corruption |
| Magic strings for server name and default model | Constants in `constants.ts` | Single source of truth; no drift between files |

---

## Open Questions

1. **Copilot available_models list**
   - What we know: copilot-mcp-server uses `gpt-4.1` as default. GitHub Copilot CLI supports multiple models.
   - What's unclear: The exact model identifiers supported by the `gh copilot` CLI (not GitHub Copilot Chat).
   - Recommendation: Use `['gpt-4.1', 'gpt-4o', 'claude-3.5-sonnet', 'o3-mini']` as a starting list. Mark as LOW confidence. Can be corrected in a follow-up quick task after testing with actual CLI.

2. **openhands available_models**
   - What we know: openhands-mcp-server's review tool is a stub that throws "not yet implemented." There is no actual CLI to wrap.
   - What's unclear: What model should `identity.model` return for a stub server?
   - Recommendation: Return `model: 'not-configured'` and `available_models: []` for openhands until Phase 3 of its implementation. This is truthful and non-empty (string is non-empty per success criteria).

3. **install_method accuracy**
   - What we know: `process.argv[1]` path is available at runtime. npm global installs put binaries in `{prefix}/bin/` and the actual script in `{prefix}/lib/node_modules/`.
   - What's unclear: Whether `process.argv[1]` contains `node_modules` for all npm global install scenarios across nvm, system node, etc.
   - Recommendation: Check both `process.argv[1]` (contains `node_modules`) and `process.argv[1]` path includes `homebrew`/`opt/homebrew`. Fall back to `'npm'` if `process.env.npm_config_prefix` is set. Return `'unknown'` otherwise. Document LOW confidence on this detection.

4. **Logger console replacement scope**
   - What we know: Each Gen1-ported repo has ~12 `console.*` calls. Some are legitimate (startup, error reporting). Some are operational logging that should use Logger.
   - What's unclear: STD-08 says "direct console.log calls for operational output are replaced" — this implies startup `console.error` calls are acceptable to keep.
   - Recommendation: Replace all `console.log` with `Logger.log`. Keep `console.error` in `index.ts` startup handler (outside MCP protocol). Keep `console.error` in `server.ts` for failed progress notifications (these are already stderr).

---

## Sources

### Primary (HIGH confidence)
- `/Users/jonathanborduas/code/gemini-mcp-server/src/constants.ts` — canonical constants.ts structure
- `/Users/jonathanborduas/code/opencode-mcp-server/src/constants.ts` — canonical constants.ts (simpler reference)
- `/Users/jonathanborduas/code/gemini-mcp-server/src/utils/logger.ts` — canonical Logger implementation
- `/Users/jonathanborduas/code/opencode-mcp-server/src/utils/logger.ts` — canonical Logger implementation
- `/Users/jonathanborduas/code/gemini-mcp-server/src/tools/simple-tools.ts` — existing identity tool (wrong schema, correct structure)
- `/Users/jonathanborduas/code/codex-mcp-server/src/tools/simple-tools.ts` — `loadPackageVersion()` pattern + existing identity
- `/Users/jonathanborduas/code/copilot-mcp-server/src/tools/simple-tools.ts` — existing identity (wrong schema)
- All 6 repos `src/types.ts` — AVAILABLE_X_MODELS constants presence
- All 6 repos `src/tools/index.ts` — which tools are registered
- REQUIREMENTS.md STD-04 and STD-08 — exact field requirements
- Phase 25 success criteria — `{name, version, model, available_models, install_method}` schema definition

### Secondary (MEDIUM confidence)
- Phase 24 RESEARCH.md — Gen2 registry pattern details
- Phase 24 SUMMARY files — confirmed which repos are Gen2 after Phase 24

### Tertiary (LOW confidence)
- Copilot available_models list — inferred from CLI usage, not official docs
- install_method detection via `process.argv[1]` — reasonable heuristic, not tested across all install scenarios

---

## Metadata

**Confidence breakdown:**
- Gap analysis (what's missing): HIGH — direct source inspection of all 6 repos
- Identity schema: HIGH — directly from REQUIREMENTS.md and success criteria
- constants.ts pattern: HIGH — canonical source in gemini and opencode
- Logger pattern: HIGH — canonical source in gemini and opencode; identical between both
- loadPackageVersion pattern: HIGH — live in codex and copilot, works in ts-jest
- install_method detection: LOW — reasonable heuristic, needs empirical validation
- Copilot available_models: LOW — no authoritative source checked
- openhands model handling: MEDIUM — logical inference from stub implementation

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable — TypeScript pattern propagation, no external API dependencies)
