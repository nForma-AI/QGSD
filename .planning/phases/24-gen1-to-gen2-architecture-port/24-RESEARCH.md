# Phase 24: Gen1 to Gen2 Architecture Port - Research

**Researched:** 2026-02-22
**Domain:** TypeScript MCP server refactoring — monolithic tool files to per-tool file + registry pattern
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STD-02 | All 4 Gen1 repos (claude, codex, copilot, openhands) use Gen2 per-tool `*.tool.ts` + `registry.ts` architecture | Full Gen2 pattern documented below from live gemini-mcp-server and opencode-mcp-server source; exact Gen1 tool inventory catalogued per repo |
</phase_requirements>

---

## Summary

This phase is a structural refactoring of four Gen1 MCP server repos (`claude-mcp-server`, `codex-mcp-server`, `copilot-mcp-server`, `openhands-mcp-server`). Each currently stores all tool definitions in `src/tools/definitions.ts` and all handler class implementations in `src/tools/handlers.ts`, wired into a single `toolHandlers` object. The Gen2 pattern (already live in `gemini-mcp-server` and `opencode-mcp-server`) splits each tool into its own `*.tool.ts` file that exports a single `UnifiedTool` object, registered in `src/tools/index.ts` via a push into a shared `toolRegistry` array defined in `src/tools/registry.ts`.

The Gen1 and Gen2 `server.ts` files differ in how they dispatch calls: Gen1 uses `toolHandlers[name].execute(args, context)` (class-per-tool handler registry), while Gen2 uses `executeTool(toolName, args, onProgress)` (registry function with Zod validation inside). The `server.ts` in each Gen1 repo must be updated to call the Gen2 dispatch path. The `index.ts` entrypoint is identical in both generations and requires no changes.

The biggest per-repo complexity is in `claude-mcp-server` and `codex-mcp-server`, which have session storage (`src/session/storage.ts`), streaming execution, and fallback provider logic. These must be preserved exactly in the per-tool files. `copilot-mcp-server` and `openhands-mcp-server` are simpler. `openhands-mcp-server` currently has only 3 tools and its `ReviewToolHandler` throws "not yet implemented" — that stub must be preserved.

**Primary recommendation:** Port each repo independently and in full (registry.ts + per-tool files + updated server.ts) in one plan per repo. Verify `npm run build` passes in each repo after the port. Reuse the gemini-mcp-server `registry.ts` verbatim as the Gen2 template — it is the canonical implementation.

---

## Gen1 vs Gen2 Architecture Comparison

### Gen1 Architecture (claude, codex, copilot, openhands)

```
src/tools/
├── definitions.ts    # Array of ToolDefinition objects (inputSchema, annotations)
└── handlers.ts       # Class per tool (ClaudeToolHandler, PingToolHandler, etc.)
                      # toolHandlers = { [TOOLS.X]: new XHandler() }
```

**Dispatch path in server.ts:**
```typescript
// server.ts imports:
import { toolDefinitions } from './tools/definitions.js';
import { toolHandlers } from './tools/handlers.js';

// ListTools: returns toolDefinitions array directly
// CallTool: calls toolHandlers[name].execute(args, context)
// isValidToolName(): checks Object.values(TOOLS).includes(name)
```

**Gen1 tool result shape:** `{ content: [{ type: 'text', text: string, _meta? }], structuredContent?, isError? }`

### Gen2 Architecture (gemini, opencode) — The Target

```
src/tools/
├── registry.ts         # UnifiedTool interface + toolRegistry[] + executeTool() + getToolDefinitions()
├── index.ts            # Imports all *.tool.ts, pushes to toolRegistry, re-exports registry
├── simple-tools.ts     # ping, help, identity tools (no complex executor needed)
├── {name}.tool.ts      # One file per domain tool
└── test-tool.example.ts  # Dev/testing only
```

**Dispatch path in server.ts:**
```typescript
// server.ts imports:
import { getToolDefinitions, executeTool, toolExists, getPromptDefinitions, getPromptMessage } from './tools/index.js';

// ListTools: calls getToolDefinitions()
// CallTool: validates toolExists(), then calls executeTool(toolName, args, onProgress)
// No isValidToolName() check — toolExists() replaces it
```

**Gen2 tool result shape from server.ts:** `{ content: [{ type: 'text', text: result }], isError: false }`
Note: Gen2 server.ts returns a simpler shape — the UnifiedTool.execute() returns `Promise<string>`, not `Promise<ToolResult>`.

---

## Standard Stack

No new dependencies required. All repos already have:

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `zod` | ^4.x | Schema validation inside `executeTool()` | Gen2 validates in registry, Gen1 validates in handler class |
| `@modelcontextprotocol/sdk` | ^1.24.0 | MCP server, types | Same in all repos |
| `typescript` | ^5.x | Build | Same in all repos |

The Gen2 pattern adds no new npm packages. It only reorganizes existing TypeScript files.

**Installation:** No new installs needed. All repos already have the correct dependencies.

---

## Architecture Patterns

### The UnifiedTool Interface (from gemini-mcp-server/src/tools/registry.ts)

Every tool in Gen2 exports a single `UnifiedTool` object conforming to this interface:

```typescript
// Source: /Users/jonathanborduas/code/gemini-mcp-server/src/tools/registry.ts (live)
export interface UnifiedTool {
  name: string;
  description: string;
  zodSchema: ZodTypeAny;          // Used for validation in executeTool()
  inputSchema: Tool['inputSchema']; // MCP-compatible JSON Schema for ListTools response
  annotations?: ToolAnnotations;
  prompt?: {                       // Optional: for ListPrompts support
    description: string;
    arguments?: Array<{ name: string; description: string; required: boolean }>;
  };
  execute: (
    args: ToolArguments,
    onProgress?: (newOutput: string) => void
  ) => Promise<string>;            // Returns string, not ToolResult
  category?: 'simple' | 'gemini' | 'utility'; // Adapt per-repo
}
```

Key difference: `execute` returns `Promise<string>` (not `Promise<ToolResult>`). The Gen2 server.ts wraps this into `{ content: [{ type: 'text', text: result }] }`.

### The registry.ts (copy verbatim from gemini-mcp-server)

```typescript
// Source: /Users/jonathanborduas/code/gemini-mcp-server/src/tools/registry.ts (live)
export const toolRegistry: UnifiedTool[] = [];

export function toolExists(toolName: string): boolean { ... }
export function getToolDefinitions(): Tool[] { ... }
export async function executeTool(toolName, args, onProgress?): Promise<string> {
  // 1. Find tool in registry
  // 2. Validate with tool.zodSchema.parse(args) — ZodError → throw formatted error
  // 3. Call tool.execute(validatedArgs, onProgress)
}
```

The `registry.ts` in each Gen2 repo is **identical** except for the `category` field in `UnifiedTool` (e.g., `'simple' | 'gemini' | 'utility'` for gemini, `'simple' | 'opencode' | 'utility'` for opencode). Adapt the category union per repo.

### index.ts Pattern (registration)

```typescript
// Source: /Users/jonathanborduas/code/gemini-mcp-server/src/tools/index.ts (live)
import { toolRegistry } from './registry.js';
import { askGeminiTool } from './ask-gemini.tool.js';
import { pingTool, helpTool, identityTool } from './simple-tools.js';
// ... other imports

toolRegistry.push(
  askGeminiTool,    // main domain tool(s)
  pingTool,
  helpTool,
  identityTool,
);

export * from './registry.js';
```

### Per-Tool File Pattern (*.tool.ts)

```typescript
// Source: /Users/jonathanborduas/code/gemini-mcp-server/src/tools/ask-gemini.tool.ts (live)
import { z } from 'zod';
import { UnifiedTool } from './registry.js';
// ... domain-specific imports

const myArgsSchema = z.object({
  prompt: z.string().describe('...'),
  // ... other args
});

export const myTool: UnifiedTool = {
  name: 'tool-name',
  description: '...',
  zodSchema: myArgsSchema,
  inputSchema: { type: 'object', properties: { ... }, required: ['prompt'] },
  annotations: { title: '...', readOnlyHint: false, ... },
  category: 'domain-category',
  execute: async (args, onProgress) => {
    // ... implementation
    return 'string result';
  },
};
```

### server.ts Update Pattern

Gen1 `server.ts` uses `toolDefinitions` + `toolHandlers` + `isValidToolName()`. Gen2 uses `getToolDefinitions()` + `executeTool()` + `toolExists()`.

```typescript
// Gen2 server.ts CallTool handler:
import {
  getToolDefinitions,
  executeTool,
  toolExists,
} from './tools/index.js';

// In setupHandlers():
this.server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: getToolDefinitions() as unknown as Tool[] };
});

this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  if (!toolExists(toolName)) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  const args = (request.params.arguments as ToolArguments) || {};
  const result = await executeTool(toolName, args, (newOutput) => {
    // optional: update latestOutput for progress
  });
  return { content: [{ type: 'text', text: result }], isError: false };
});
```

Note: The Gen1 `server.ts` has progress notification infrastructure (MCP `extra.sendNotification`). The Gen2 `server.ts` has a polling interval pattern. For the port, the Gen1 progress infrastructure can be replaced with the Gen2 pattern, or simplified — the key correctness requirement is that tools respond correctly, not that progress notifications are identical.

### Recommended Project Structure After Port

```
src/
├── __tests__/           # Existing tests — update imports but preserve behavior
├── session/             # Preserved as-is (claude, codex only)
│   └── storage.ts
├── tools/
│   ├── registry.ts      # NEW: UnifiedTool interface + toolRegistry + helpers
│   ├── index.ts         # NEW: imports all *.tool.ts, pushes to registry
│   ├── simple-tools.ts  # NEW: ping, help, identity (lightweight, no executor)
│   ├── {name}.tool.ts   # NEW: one file per domain tool
│   │                    # (e.g., claude.tool.ts, review.tool.ts)
│   │                    # definitions.ts and handlers.ts are DELETED
├── utils/               # Preserved as-is
├── constants.ts         # Preserved as-is (or created if missing)
├── errors.ts            # Preserved as-is
├── index.ts             # Preserved as-is (no changes needed)
├── server.ts            # UPDATED: switch from Gen1 to Gen2 dispatch
└── types.ts             # UPDATED: add ToolArguments type if needed
```

### Anti-Patterns to Avoid

- **Preserving `definitions.ts` and `handlers.ts` alongside new files:** Delete them. Having both causes import confusion and TypeScript errors.
- **Making `execute()` return `ToolResult` instead of `string`:** The Gen2 registry expects `Promise<string>`. If you return a `ToolResult` object, `executeTool()` will stringify it incorrectly.
- **Forgetting `export * from './registry.js'` in index.ts:** The server.ts imports `getToolDefinitions`, `executeTool`, `toolExists` from `./tools/index.js`. If the re-export is missing, the server won't compile.
- **Not updating `ToolArguments` type:** Gen2 tools use `ToolArguments` from `../constants.js` or `../types.js` — each repo needs this type available. Check what the repo's `types.ts` currently exports and add `ToolArguments` if missing.

---

## Per-Repo Tool Inventory

### claude-mcp-server (5 tools, has session storage)

| Tool Name | File | Complexity |
|-----------|------|------------|
| `claude` | `claude.tool.ts` | HIGH — streaming, fallback providers, session storage, Zod schema |
| `review` | `review.tool.ts` | MEDIUM — streaming, model selection |
| `ping` | `simple-tools.ts` | LOW |
| `help` | `simple-tools.ts` | LOW |
| `listSessions` | `simple-tools.ts` or `list-sessions.tool.ts` | LOW-MEDIUM — needs sessionStorage ref |

**Session storage challenge:** `ClaudeToolHandler` and `ListSessionsToolHandler` share an `InMemorySessionStorage` instance. In Gen2, this shared state must be created once (e.g., at module level in `claude.tool.ts` or in a new `src/session/index.ts`) and imported into both tool files.

**Types not in Gen1 `types.ts`:** Gen2 `UnifiedTool.execute()` takes `ToolArguments` — claude's `types.ts` doesn't export `ToolArguments`. Either add it to `types.ts` (as `Record<string, unknown>`) or inline the type in `registry.ts`.

### codex-mcp-server (6 tools, has session storage)

| Tool Name | File | Complexity |
|-----------|------|------------|
| `codex` | `codex.tool.ts` | HIGH — session storage, soft timeout, sandbox mode, Zod schema |
| `review` | `review.tool.ts` | MEDIUM |
| `ping` | `simple-tools.ts` | LOW |
| `help` | `simple-tools.ts` | LOW |
| `listSessions` | `simple-tools.ts` or `list-sessions.tool.ts` | LOW-MEDIUM |
| `identity` | `simple-tools.ts` | LOW |

Same session storage challenge as claude-mcp-server.

### copilot-mcp-server (5 tools, NO session storage)

| Tool Name | File | Complexity |
|-----------|------|------------|
| `ask` | `ask.tool.ts` | MEDIUM — buildCopilotArgs, soft timeout, error classification |
| `suggest` | `suggest.tool.ts` | MEDIUM — prompt building, same copilot execution |
| `explain` | `explain.tool.ts` | MEDIUM — prompt building, same copilot execution |
| `ping` | `simple-tools.ts` | LOW |
| `identity` | `simple-tools.ts` | LOW |

**Shared helper note:** `buildCopilotArgs`, `validateAddDir`, `classifyCommandError`, `extractResponse`, `buildTimeBudgetPrefix` are currently in `handlers.ts`. These should move to a shared helper file (e.g., `src/utils/copilotExecutor.ts`) or into `simple-tools.ts` if small. Each tool file imports them.

### openhands-mcp-server (3 tools, NO session storage, review is stub)

| Tool Name | File | Complexity |
|-----------|------|------------|
| `review` | `review.tool.ts` | LOW — stub that throws "not yet implemented" |
| `ping` | `simple-tools.ts` | LOW |
| `help` | `simple-tools.ts` | LOW |

Simplest repo to port. The stub `ReviewToolHandler` must become an `execute()` that throws `ToolExecutionError` (same behavior).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zod validation in execute() | Custom arg validation | `zodSchema.parse(args)` in `registry.ts`'s `executeTool()` | Already done by Gen2 registry — each tool's zodSchema is validated before execute() is called |
| Tool lookup/dispatch | Switch statement in server.ts | `toolExists()` + `executeTool()` from registry | Registry already handles unknown tool errors |
| Converting ToolResult to string | Manual serialization | Return string directly from execute() | Gen2 execute() returns string; server.ts wraps it |

**Key insight:** All complexity is in the per-tool `execute()` implementation. The registry, dispatch, and validation are mechanical copies from gemini-mcp-server.

---

## Common Pitfalls

### Pitfall 1: Session Storage Singleton Broken by Module Split

**What goes wrong:** In Gen1, `handlers.ts` creates one `InMemorySessionStorage()` shared by `ClaudeToolHandler` and `ListSessionsToolHandler`. When split into `claude.tool.ts` and a separate `list-sessions` tool, each file could create its own instance, breaking session continuity.
**Why it happens:** JavaScript module scope — naive copy-paste creates two instances.
**How to avoid:** Create a module-level singleton in one file (e.g., `src/session/index.ts` exporting `export const sessionStorage = new InMemorySessionStorage()`) and import it in both tool files.
**Warning signs:** `listSessions` always returns "No active sessions" even after a `claude` call with a sessionId.

### Pitfall 2: ToolArguments Type Missing in Gen1 Types

**What goes wrong:** Gen2 `registry.ts` and `UnifiedTool.execute()` use `ToolArguments` as the args type. Gen1 `types.ts` files don't export `ToolArguments` — only specific tool arg types (e.g., `ClaudeToolArgs`).
**Why it happens:** Gen1 uses Zod `.parse()` inside handler classes to get strongly-typed args. Gen2 parses in the registry and passes the result as `ToolArguments` (a wide type).
**How to avoid:** Add `export type ToolArguments = Record<string, unknown>` to each repo's `types.ts`, or define it in `constants.ts` following gemini-mcp-server's pattern.

### Pitfall 3: inputSchema and zodSchema Duplication

**What goes wrong:** Each Gen2 tool must define both `inputSchema` (JSON Schema for MCP) and `zodSchema` (Zod schema for validation). They must match or Zod validation will reject valid inputs.
**Why it happens:** MCP protocol uses JSON Schema; runtime validation uses Zod. They're kept in sync manually.
**How to avoid:** Write the Zod schema first, then write `inputSchema` to match. Use the existing Gen1 `definitions.ts` `inputSchema` as the JSON Schema — it's already correct. Then write the matching Zod schema from the Gen1 handler's `.parse()` call.

### Pitfall 4: Tests Import from definitions.ts and handlers.ts

**What goes wrong:** Existing tests import `{ toolDefinitions }` from `'../tools/definitions.js'` and named handler classes from `'../tools/handlers.js'`. After deleting those files, tests break even if the server works.
**Why it happens:** Tests were written against Gen1 file structure.
**How to avoid:** Update test imports as part of each repo's port. The key test assertions (tool names, required fields, handler behavior) must still pass — the implementation paths just change.

### Pitfall 5: server.ts Still Has isValidToolName() Type Guard

**What goes wrong:** Gen1 `server.ts` has `private isValidToolName(name: string): name is ToolName` which uses `Object.values(TOOLS).includes(name as ToolName)`. After switching to Gen2 dispatch, this check is still present but `toolHandlers[name]` no longer exists.
**Why it happens:** Mechanical port that updates dispatch but forgets to remove Gen1 validation.
**How to avoid:** Replace `isValidToolName()` with `toolExists()` from the registry. Remove `TOOLS` import from server.ts if it was only used for this check.

---

## Code Examples

### registry.ts (copy verbatim, adapt category union)

```typescript
// Source: /Users/jonathanborduas/code/gemini-mcp-server/src/tools/registry.ts
import { Tool, Prompt } from '@modelcontextprotocol/sdk/types.js';
import { ToolArguments } from '../types.js'; // or constants.js — check per repo
import { ToolAnnotations } from '../types.js';
import { ZodTypeAny, ZodError } from 'zod';

export interface UnifiedTool {
  name: string;
  description: string;
  zodSchema: ZodTypeAny;
  inputSchema: Tool['inputSchema'];
  annotations?: ToolAnnotations;
  prompt?: { description: string; arguments?: Array<{ name: string; description: string; required: boolean }> };
  execute: (args: ToolArguments, onProgress?: (newOutput: string) => void) => Promise<string>;
  category?: 'simple' | 'claude' | 'utility'; // adapt per repo
}

export const toolRegistry: UnifiedTool[] = [];

export function toolExists(toolName: string): boolean {
  return toolRegistry.some((t) => t.name === toolName);
}

export function getToolDefinitions(): Tool[] {
  return toolRegistry.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(tool.annotations && { annotations: tool.annotations }),
  }));
}

export async function executeTool(
  toolName: string,
  args: ToolArguments,
  onProgress?: (newOutput: string) => void
): Promise<string> {
  const tool = toolRegistry.find((t) => t.name === toolName);
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);
  try {
    const validatedArgs = tool.zodSchema.parse(args) as ToolArguments;
    return tool.execute(validatedArgs, onProgress);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`Invalid arguments for ${toolName}: ${issues}`);
    }
    throw error;
  }
}
```

### Simple Tool Pattern (ping, help, identity in simple-tools.ts)

```typescript
// Source: /Users/jonathanborduas/code/opencode-mcp-server/src/tools/simple-tools.ts
import { z } from 'zod';
import { UnifiedTool } from './registry.js';

const pingArgsSchema = z.object({
  message: z.string().optional(),
});

export const pingTool: UnifiedTool = {
  name: 'ping',
  description: 'Test MCP server connection',
  zodSchema: pingArgsSchema,
  annotations: { title: 'Ping Server', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: {
    type: 'object',
    properties: { message: { type: 'string', description: 'Message to echo back' } },
    required: [],
  },
  category: 'simple',
  execute: async (args) => {
    return String(args.message ?? 'pong');
  },
};
```

### Handling Session Storage Singleton (claude/codex specific)

```typescript
// src/session/index.ts (new file)
import { InMemorySessionStorage } from './storage.js';
export const sessionStorage = new InMemorySessionStorage();

// src/tools/claude.tool.ts
import { sessionStorage } from '../session/index.js';
// ... use sessionStorage in execute()

// src/tools/simple-tools.ts (listSessions)
import { sessionStorage } from '../session/index.js';
export const listSessionsTool: UnifiedTool = {
  name: 'listSessions',
  execute: async () => {
    const sessions = sessionStorage.listSessions();
    // ...
    return JSON.stringify(sessionInfo, null, 2) || 'No active sessions';
  },
};
```

---

## State of the Art

| Old Approach (Gen1) | Current Approach (Gen2) | Impact |
|---------------------|------------------------|--------|
| `definitions.ts` + `handlers.ts` | `*.tool.ts` files + `registry.ts` | Adding a new tool = one new `*.tool.ts` file + one line in `index.ts` |
| Handler class with `execute(args, context)` | `UnifiedTool.execute(args, onProgress?)` | Simpler interface; progress is a callback not a context object |
| `toolHandlers[name].execute()` in server.ts | `executeTool(name, args)` from registry | Validation is centralized; server.ts is thinner |
| `ToolResult` returned from handlers | `string` returned from tools | Gen2 server wraps string; simpler tool contract |
| One TS type per tool args | Zod schema + `ToolArguments` wide type | Validation at registry boundary, typed narrowly inside execute() |

---

## Open Questions

1. **Progress notification parity**
   - What we know: Gen1 `server.ts` uses `extra.sendNotification` (MCP SDK) for per-message progress. Gen2 `server.ts` uses a polling interval. The Gen1 claude-mcp-server has sophisticated streaming with `executeCommandStreaming`.
   - What's unclear: Should the Gen2-ported `server.ts` preserve the exact Gen1 progress mechanism (streaming via `extra.sendNotification`) or adopt the Gen2 polling pattern?
   - Recommendation: Preserve the Gen1 progress mechanism in the ported `server.ts` — it is more correct (streaming) than the Gen2 polling interval. Only the tool dispatch path changes; progress infrastructure stays Gen1-style.

2. **ToolArguments vs specific Zod types inside execute()**
   - What we know: execute() receives `ToolArguments` (wide type), but the Zod schema validates before calling execute(). The validated result is cast back to `ToolArguments`.
   - What's unclear: Claude and Codex tools need specific typed args (ClaudeToolArgs, CodexToolArgs) inside execute(). Is the cast `args as z.infer<typeof schema>` sufficient?
   - Recommendation: Yes — this is how `opencode-tool.ts` does it: `const typed = args as z.infer<typeof openCodeArgsSchema>`. Use the same pattern.

3. **Test update scope**
   - What we know: Tests import handler class names (`ClaudeToolHandler`, `ReviewToolHandler`) and `toolDefinitions` from specific files that will be deleted.
   - What's unclear: How much test rewriting is required vs. simple import path updates?
   - Recommendation: Update imports to point to the new tool file exports. The behavioral assertions (tool names, required fields, handler responses) remain valid — only the import paths and instantiation patterns change.

---

## Sources

### Primary (HIGH confidence)
- `/Users/jonathanborduas/code/gemini-mcp-server/src/tools/registry.ts` — canonical Gen2 registry interface
- `/Users/jonathanborduas/code/gemini-mcp-server/src/tools/index.ts` — canonical registration pattern
- `/Users/jonathanborduas/code/gemini-mcp-server/src/tools/ask-gemini.tool.ts` — canonical per-tool file pattern
- `/Users/jonathanborduas/code/gemini-mcp-server/src/tools/simple-tools.ts` — canonical simple-tools pattern
- `/Users/jonathanborduas/code/opencode-mcp-server/src/tools/registry.ts` — second Gen2 reference implementation
- `/Users/jonathanborduas/code/opencode-mcp-server/src/tools/opencode-tool.ts` — args-cast pattern example
- `/Users/jonathanborduas/code/claude-mcp-server/src/tools/definitions.ts` — Gen1 claude tool inventory
- `/Users/jonathanborduas/code/claude-mcp-server/src/tools/handlers.ts` — Gen1 claude handler logic to preserve
- `/Users/jonathanborduas/code/codex-mcp-server/src/tools/definitions.ts` — Gen1 codex tool inventory
- `/Users/jonathanborduas/code/codex-mcp-server/src/tools/handlers.ts` — Gen1 codex handler logic
- `/Users/jonathanborduas/code/copilot-mcp-server/src/tools/definitions.ts` — Gen1 copilot tool inventory
- `/Users/jonathanborduas/code/copilot-mcp-server/src/tools/handlers.ts` — Gen1 copilot handlers
- `/Users/jonathanborduas/code/openhands-mcp-server/src/tools/definitions.ts` — Gen1 openhands tool inventory
- `/Users/jonathanborduas/code/openhands-mcp-server/src/tools/handlers.ts` — Gen1 openhands handlers

### Secondary (MEDIUM confidence)
- `claude-mcp-server`, `codex-mcp-server` server.ts — Gen1 dispatch pattern; confirmed via direct source read
- All Gen1 `types.ts` files — confirmed `ToolArguments` is absent, must be added

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps, all repos use identical TypeScript/Zod/MCP SDK versions
- Architecture: HIGH — both Gen1 and Gen2 source read directly; patterns are concrete, not inferred
- Pitfalls: HIGH — identified from direct structural comparison of live source files
- Per-repo inventory: HIGH — read all 4 Gen1 repos' definitions.ts and handlers.ts

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable — TypeScript refactor pattern, no external API dependencies)
