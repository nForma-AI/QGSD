---
phase: quick-42
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/code/claude-mcp-server/src/types.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/tools/handlers.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/tools/definitions.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/session/storage.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/index.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/server.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/utils/command.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/index.test.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/resume-functionality.test.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/default-model.test.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/mcp-stdio.test.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/context-building.test.ts
  - /Users/jonathanborduas/code/claude-mcp-server/package.json
autonomous: true
requirements: [QUICK-42]

must_haves:
  truths:
    - "The MCP server binary is named claude-mcp-server and invokes the claude CLI"
    - "The claude tool accepts prompt, model, sessionId, resetSession, workingDirectory, allowedTools, dangerouslySkipPermissions, outputFormat, maxTurns, routerBaseUrl"
    - "Session resume uses --resume <session-id> and extracts session_id from JSON output"
    - "The review tool sends a prompt to claude -p instead of codex review subcommand"
    - "No codex references remain in any source file (src/ tree)"
  artifacts:
    - path: /Users/jonathanborduas/code/claude-mcp-server/src/types.ts
      provides: "TOOLS.CLAUDE constant, ClaudeToolSchema, DEFAULT_CLAUDE_MODEL, AVAILABLE_CLAUDE_MODELS"
    - path: /Users/jonathanborduas/code/claude-mcp-server/src/tools/handlers.ts
      provides: "ClaudeToolHandler invoking claude CLI with correct args"
    - path: /Users/jonathanborduas/code/claude-mcp-server/src/tools/definitions.ts
      provides: "Tool definitions using TOOLS.CLAUDE, new param set"
    - path: /Users/jonathanborduas/code/claude-mcp-server/src/session/storage.ts
      provides: "Renamed codexConversationId -> claudeSessionId throughout"
    - path: /Users/jonathanborduas/code/claude-mcp-server/src/server.ts
      provides: "ClaudeMcpServer class (renamed from CodexMcpServer)"
    - path: /Users/jonathanborduas/code/claude-mcp-server/src/index.ts
      provides: "Imports ClaudeMcpServer, sets name to claude-mcp-server"
    - path: /Users/jonathanborduas/code/claude-mcp-server/package.json
      provides: "name: claude-mcp-server, bin: claude-mcp-server"
  key_links:
    - from: handlers.ts ClaudeToolHandler
      to: claude CLI
      via: "executeCommand('claude', ['-p', prompt, '--model', model, '--output-format', 'json'])"
      pattern: "executeCommand\\('claude'"
    - from: handlers.ts session resume
      to: "--resume flag"
      via: "cmdArgs.push('--resume', claudeSessionId)"
      pattern: "--resume"
    - from: handlers.ts session ID extraction
      to: "JSON output parsing"
      via: "JSON.parse(result.stdout).session_id"
      pattern: "session_id"
    - from: definitions.ts
      to: "TOOLS.CLAUDE"
      via: "name: TOOLS.CLAUDE"
      pattern: "TOOLS\\.CLAUDE"
    - from: index.ts
      to: "server.ts ClaudeMcpServer"
      via: "import { ClaudeMcpServer } from './server.js'"
      pattern: "ClaudeMcpServer"
---

<objective>
Replace all Codex CLI references with Claude CLI across the claude-mcp-server fork.

Purpose: The fork was originally built for OpenAI Codex. Adapting it to Claude Code CLI makes it usable as an MCP wrapper for Claude, enabling other agents to invoke claude -p programmatically via MCP.

Output: All TypeScript source files, test files, and package.json rewritten — no codex references remain anywhere in src/, claude CLI invocation is correct, new Claude-specific params are wired end-to-end.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md

Target repo: /Users/jonathanborduas/code/claude-mcp-server/
All file writes are in that repo, NOT in the QGSD repo.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite types.ts — replace Codex constants and schemas with Claude equivalents</name>
  <files>/Users/jonathanborduas/code/claude-mcp-server/src/types.ts</files>
  <action>
Rewrite the file completely. Keep all unchanged interfaces (ToolAnnotations, ToolDefinition, ToolResult, ServerConfig, ProgressToken, ToolHandlerContext, CommandResult). Replace:

1. TOOLS constant: change CODEX: 'codex' to CLAUDE: 'claude'. Keep REVIEW, PING, HELP, LIST_SESSIONS.

2. Model constants:
   - Remove DEFAULT_CODEX_MODEL, CODEX_DEFAULT_MODEL_ENV_VAR, AVAILABLE_CODEX_MODELS
   - Add: `export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6' as const;`
   - Add: `export const CLAUDE_DEFAULT_MODEL_ENV_VAR = 'CLAUDE_DEFAULT_MODEL' as const;`
   - Add: `export const AVAILABLE_CLAUDE_MODELS = ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'] as const;`

3. getModelDescription: update to reference Claude models and DEFAULT_CLAUDE_MODEL. Change param type from 'codex' | 'review' to 'claude' | 'review'.

4. Remove SandboxMode enum entirely.

5. Rename CodexToolSchema to ClaudeToolSchema and rewrite its fields:
   - Keep: prompt (string), sessionId (string with same validation), resetSession (boolean optional), model (string optional), workingDirectory (string optional)
   - Remove: reasoningEffort, sandbox, fullAuto, callbackUri
   - Add: allowedTools (z.string().optional() — comma-separated tool names for --allowedTools flag)
   - Add: dangerouslySkipPermissions (z.boolean().optional())
   - Add: outputFormat (z.enum(['text', 'json', 'stream-json']).optional())
   - Add: maxTurns (z.number().int().positive().optional())
   - Add: routerBaseUrl (z.string().url().optional() — overrides ANTHROPIC_BASE_URL)

6. ReviewToolSchema: keep as-is (prompt, uncommitted, base, commit, title, model, workingDirectory).

7. Update type aliases: rename CodexToolArgs to ClaudeToolArgs (= z.infer<typeof ClaudeToolSchema>). Keep ReviewToolArgs, PingToolArgs, ListSessionsToolArgs.

8. Export ClaudeToolSchema and ClaudeToolArgs (not CodexToolSchema/CodexToolArgs).
  </action>
  <verify>cd /Users/jonathanborduas/code/claude-mcp-server && npx tsc --noEmit 2>&1 | head -30</verify>
  <done>tsc reports no errors in types.ts; grep confirms no 'codex' or 'CODEX' strings remain in the file (case-insensitive)</done>
</task>

<task type="auto">
  <name>Task 2: Rewrite handlers.ts — replace CodexToolHandler with ClaudeToolHandler, update CLI invocation</name>
  <files>
    /Users/jonathanborduas/code/claude-mcp-server/src/tools/handlers.ts
    /Users/jonathanborduas/code/claude-mcp-server/src/session/storage.ts
  </files>
  <action>
**storage.ts changes:**
In SessionData interface rename `codexConversationId?: string` to `claudeSessionId?: string`.
Rename all methods: `setCodexConversationId` -> `setClaudeSessionId`, `getCodexConversationId` -> `getClaudeSessionId`.
In ensureSession, the ValidationError reference uses TOOLS.CODEX — change to TOOLS.CLAUDE.
In resetSession, change `session.codexConversationId = undefined` to `session.claudeSessionId = undefined`.
Update SessionStorage interface to match renamed methods.

**handlers.ts changes:**
1. Update imports: replace DEFAULT_CODEX_MODEL/CODEX_DEFAULT_MODEL_ENV_VAR with DEFAULT_CLAUDE_MODEL/CLAUDE_DEFAULT_MODEL_ENV_VAR. Replace CodexToolSchema/CodexToolArgs with ClaudeToolSchema/ClaudeToolArgs.

2. Rename class CodexToolHandler to ClaudeToolHandler.

3. In ClaudeToolHandler.execute, update destructured args from ClaudeToolArgs:
   - Remove: reasoningEffort, sandbox, fullAuto, callbackUri
   - Add: allowedTools, dangerouslySkipPermissions, outputFormat, maxTurns, routerBaseUrl

4. Session logic: replace getCodexConversationId/setCodexConversationId with getClaudeSessionId/setClaudeSessionId. Rename local variable codexConversationId to claudeSessionId.

5. Model selection: change CODEX_DEFAULT_MODEL_ENV_VAR to CLAUDE_DEFAULT_MODEL_ENV_VAR, DEFAULT_CODEX_MODEL to DEFAULT_CLAUDE_MODEL.

6. Remove effectiveCallbackUri and envOverride logic for CODEX_MCP_CALLBACK_URI.

7. Build cmdArgs for non-resume mode:
   ```
   cmdArgs = ['-p', enhancedPrompt, '--model', selectedModel];
   if (outputFormat) cmdArgs.push('--output-format', outputFormat);
   else cmdArgs.push('--output-format', 'json');   // default to json for session_id extraction
   if (maxTurns) cmdArgs.push('--max-turns', String(maxTurns));
   if (dangerouslySkipPermissions) cmdArgs.push('--dangerously-skip-permissions');
   if (allowedTools) cmdArgs.push('--allowedTools', allowedTools);
   if (workingDirectory) cmdArgs.push('--cwd', workingDirectory);   // NOT -C
   ```

8. Build cmdArgs for resume mode:
   ```
   cmdArgs = ['-p', enhancedPrompt, '--resume', claudeSessionId, '--model', selectedModel];
   if (outputFormat) cmdArgs.push('--output-format', outputFormat);
   else cmdArgs.push('--output-format', 'json');
   if (workingDirectory) cmdArgs.push('--cwd', workingDirectory);
   ```

9. Execute command: change 'codex' to 'claude' in all executeCommand/executeCommandStreaming calls. Remove envOverride parameter (no longer needed).

10. Response extraction: claude --output-format json returns JSON on stdout. Parse it:
    ```ts
    let response: string;
    let extractedSessionId: string | undefined;
    try {
      const parsed = JSON.parse(result.stdout);
      response = parsed.result ?? result.stdout;
      extractedSessionId = parsed.session_id;
    } catch {
      response = result.stdout || result.stderr || 'No output from Claude';
    }
    ```
    Remove the old regex-based conversationIdMatch and threadIdMatch from stderr.

11. Session ID storage: use extractedSessionId instead of conversationIdMatch[2]. Call setClaudeSessionId.

12. metadata object: remove threadId, keep model, sessionId. Add routerBaseUrl to env override when present: before executeCommand call, if routerBaseUrl is set, pass envOverride `{ ANTHROPIC_BASE_URL: routerBaseUrl }` to executeCommand/executeCommandStreaming.

13. Progress message: change 'Starting Codex execution...' to 'Starting Claude execution...'.

14. Error handlers: change TOOLS.CODEX to TOOLS.CLAUDE. Change error message from 'Failed to execute codex command' to 'Failed to execute claude command'.

15. ReviewToolHandler changes:
    - Update imports: DEFAULT_CLAUDE_MODEL, CLAUDE_DEFAULT_MODEL_ENV_VAR.
    - Implement review as prompt-based: instead of codex review subcommand, build:
      ```
      const reviewContext = [];
      if (uncommitted) reviewContext.push('Review staged, unstaged, and untracked changes (working tree diff).');
      if (base) reviewContext.push(`Review changes against base branch: ${base}.`);
      if (commit) reviewContext.push(`Review changes introduced by commit: ${commit}.`);
      const reviewPrompt = prompt
        ? `${reviewContext.join(' ')} ${prompt}`
        : reviewContext.length > 0
          ? reviewContext.join(' ') + ' Please provide a detailed code review.'
          : 'Please review the current code changes and provide feedback.';
      cmdArgs = ['-p', reviewPrompt, '--model', selectedModel, '--output-format', 'json'];
      if (workingDirectory) cmdArgs.push('--cwd', workingDirectory);
      ```
    - Remove the old -C flag for workingDirectory in review (codex used it as global option before subcommand; claude uses --cwd).
    - Remove uncommitted/base/commit/title flags (no native review subcommand; they are embedded in the prompt instead).
    - Execute: `executeCommand('claude', cmdArgs)` / `executeCommandStreaming('claude', cmdArgs, ...)`.
    - Response extraction: same JSON parse pattern as ClaudeToolHandler.
    - Change error message to 'Failed to execute claude review'.

16. toolHandlers registry: change `[TOOLS.CODEX]: new CodexToolHandler(sessionStorage)` to `[TOOLS.CLAUDE]: new ClaudeToolHandler(sessionStorage)`.

17. Progress message in review: change 'Starting code review...' stays as-is (fine).

18. HelpToolHandler: change `executeCommand('codex', ['--help'])` to `executeCommand('claude', ['--help'])`.
  </action>
  <verify>cd /Users/jonathanborduas/code/claude-mcp-server && npx tsc --noEmit 2>&1 | head -40</verify>
  <done>tsc reports zero errors; grep -ri 'codex' src/tools/handlers.ts src/session/storage.ts returns no matches</done>
</task>

<task type="auto">
  <name>Task 3: Rewrite definitions.ts and package.json — update tool definitions and package metadata</name>
  <files>
    /Users/jonathanborduas/code/claude-mcp-server/src/tools/definitions.ts
    /Users/jonathanborduas/code/claude-mcp-server/package.json
  </files>
  <action>
**definitions.ts changes:**
1. TOOLS.CLAUDE tool definition (was TOOLS.CODEX):
   - name: TOOLS.CLAUDE
   - description: 'Execute Claude Code CLI in non-interactive mode for AI assistance'
   - inputSchema properties — remove: reasoningEffort, sandbox, fullAuto, callbackUri. Add:
     ```
     allowedTools: { type: 'string', description: 'Comma-separated list of tools to allow (e.g. "Bash,Read,Write"). Passed via --allowedTools flag.' }
     dangerouslySkipPermissions: { type: 'boolean', description: 'Skip permission prompts. Use with caution.' }
     outputFormat: { type: 'string', enum: ['text', 'json', 'stream-json'], description: 'Output format for the claude CLI response (default: json)' }
     maxTurns: { type: 'number', description: 'Maximum number of agentic turns before stopping' }
     routerBaseUrl: { type: 'string', description: 'Override ANTHROPIC_BASE_URL for this call (e.g. for claude-code-router)' }
     ```
   - Keep: prompt, sessionId, resetSession, model, workingDirectory (update workingDirectory description: 'passed via --cwd flag').
   - Update sessionId description: remove mention of sandbox/fullAuto limitation; say "when resuming a session, allowedTools and workingDirectory are applied normally".
   - annotations.title: 'Execute Claude Code CLI'
   - outputSchema: remove threadId property (no longer extracted); keep as `{ type: 'object', properties: { sessionId: { type: 'string' } } }`

2. TOOLS.REVIEW tool definition:
   - description: 'Run a code review using Claude Code CLI by passing review context as a prompt'
   - Keep inputSchema as-is (prompt, uncommitted, base, commit, title, model, workingDirectory) — these params still exist in ReviewToolSchema and are valid; handler embeds them in prompt text.
   - Update workingDirectory description: 'Working directory to run the review in (passed via --cwd flag)'
   - annotations stay as-is.

3. TOOLS.HELP:
   - description: 'Get Claude Code CLI help information'
   - annotations.title: 'Get Help'

4. Update getModelDescription call: change 'codex' argument to 'claude' in model property of both TOOLS.CLAUDE and TOOLS.REVIEW.

**package.json changes:**
- "name": "claude-mcp-server"
- "bin": { "claude-mcp-server": "dist/index.js" }
- "description": "MCP server wrapper for Claude Code CLI"
- "keywords": replace "codex" and "openai" with "claude-code", "anthropic"; keep "mcp", "claude", "ai", "cli"
- Leave repository/bugs/homepage URLs unchanged (user can update those separately)
  </action>
  <verify>cd /Users/jonathanborduas/code/claude-mcp-server && npx tsc --noEmit 2>&1 | head -20 && echo "---" && grep -ri 'codex' src/tools/definitions.ts || echo "No codex refs in definitions.ts"</verify>
  <done>tsc exits 0; no codex references remain in definitions.ts; package.json name is "claude-mcp-server"; bin entry is "claude-mcp-server"</done>
</task>

<task type="auto">
  <name>Task 4: Update server.ts and index.ts — rename CodexMcpServer to ClaudeMcpServer</name>
  <files>
    /Users/jonathanborduas/code/claude-mcp-server/src/server.ts
    /Users/jonathanborduas/code/claude-mcp-server/src/index.ts
    /Users/jonathanborduas/code/claude-mcp-server/src/utils/command.ts
  </files>
  <action>
**server.ts changes:**
Rename the exported class from `CodexMcpServer` to `ClaudeMcpServer`. No other logic changes needed — the class body is already generic (uses config.name, delegates to toolHandlers/toolDefinitions).

**index.ts changes:**
1. Change the import: `import { CodexMcpServer } from './server.js'` -> `import { ClaudeMcpServer } from './server.js'`
2. Update SERVER_CONFIG.name: `'codex-mcp-server'` -> `'claude-mcp-server'`
3. Instantiate the renamed class: `new ClaudeMcpServer(SERVER_CONFIG)`

**utils/command.ts changes (comment-only):**
Two comments reference the codex CLI. Update them:
- Line ~89: `// Note: codex CLI writes most output to stderr, so we must check both` -> `// Note: claude CLI writes output to stdout as JSON when --output-format json is used`
- Line ~193: `// Also send stderr as progress - codex outputs to stderr` -> `// Also send stderr as progress for real-time feedback`
  </action>
  <verify>cd /Users/jonathanborduas/code/claude-mcp-server && npx tsc --noEmit 2>&1 | head -20 && echo "---" && grep -ri 'codex' src/index.ts src/server.ts src/utils/command.ts || echo "No codex refs in entry files"</verify>
  <done>tsc exits 0; no codex references remain in index.ts, server.ts, or command.ts</done>
</task>

<task type="auto">
  <name>Task 5: Update all test files — replace Codex-specific assertions with Claude equivalents</name>
  <files>
    /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/index.test.ts
    /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/resume-functionality.test.ts
    /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/default-model.test.ts
    /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/mcp-stdio.test.ts
    /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/context-building.test.ts
  </files>
  <action>
These tests were written for the Codex fork. Update them to match the Claude implementation. Rewrite each file as follows:

**index.test.ts:**
- Import `ClaudeToolHandler` instead of `CodexToolHandler` (from '../tools/handlers.js')
- Import `ClaudeMcpServer` instead of `CodexMcpServer` (from '../server.js')
- Replace `TOOLS.CODEX` -> `TOOLS.CLAUDE` in all assertions
- Replace `CodexToolHandler` -> `ClaudeToolHandler` in `toBeInstanceOf` assertion
- Update `describe` block name: 'Codex MCP Server' -> 'Claude MCP Server'
- In tool definition tests: update `tool.name === TOOLS.CODEX` -> `tool.name === TOOLS.CLAUDE`; update description assertion: `'Execute Codex CLI'` -> `'Execute Claude Code CLI'`
- In help tool test: update description assertion: `'Get Codex CLI help'` -> `'Get Claude Code CLI help'`
- In MCP schema compatibility test: remove the `_meta: { model: 'gpt-5.3-codex' }` and `structuredContent: { threadId: 'th_123' }` (threadId is no longer in outputSchema). Use `_meta: { model: 'claude-sonnet-4-6' }` if needed, or simplify to just test `content`.
- In Server Initialization test: `new CodexMcpServer(config)` -> `new ClaudeMcpServer(config)`; update `toBeInstanceOf(CodexMcpServer)` -> `toBeInstanceOf(ClaudeMcpServer)`

**resume-functionality.test.ts:**
- Replace `import { CodexToolHandler }` -> `import { ClaudeToolHandler }` throughout
- Replace `handler = new CodexToolHandler(sessionStorage)` -> `handler = new ClaudeToolHandler(sessionStorage)`
- Replace `handler: CodexToolHandler` type annotation -> `ClaudeToolHandler`
- `describe('Codex Resume Functionality')` -> `describe('Claude Resume Functionality')`
- Remove `delete process.env.CODEX_MCP_CALLBACK_URI` from beforeEach (env var no longer exists)
- Replace all `executeCommand('codex', [...])` expected call matchers with `executeCommand('claude', ['-p', prompt, '--model', 'claude-sonnet-4-6', '--output-format', 'json'])` patterns. The new CLI args format is completely different — remove the old `exec`, `--skip-git-repo-check`, `-c model="..."`, `resume subcommand` patterns.
- New session without claudeSessionId: expect `executeCommand('claude', ['-p', 'First message', '--model', 'claude-sonnet-4-6', '--output-format', 'json'])`
- Resume with existing claudeSessionId: expect `executeCommand('claude', ['-p', 'Continue the task', '--resume', 'existing-codex-session-id', '--model', 'claude-sonnet-4-6', '--output-format', 'json'])`
- Replace `sessionStorage.getCodexConversationId` -> `sessionStorage.getClaudeSessionId`; `setCodexConversationId` -> `setClaudeSessionId`
- Mock responses: instead of `stderr: 'conversation id: abc-123-def'`, use `stdout: JSON.stringify({ result: 'Test response', session_id: 'abc-123-def' })`
- Remove the callbackUri test entirely (CODEX_MCP_CALLBACK_URI is gone; routerBaseUrl is the replacement but via a different mechanism)
- Remove threadId assertions from `_meta` and `structuredContent` (threadId is no longer in output)
- For "fall back to manual context" test: update prompt index — new cmdArgs are `['-p', enhancedPrompt, '--model', ...]`, so prompt is at index 1

**default-model.test.ts:**
- Replace `import { CodexToolHandler }` -> `import { ClaudeToolHandler }`
- Replace `handler = new CodexToolHandler(...)` -> `handler = new ClaudeToolHandler(...)`
- Replace `handler: CodexToolHandler` type -> `ClaudeToolHandler`
- `describe('Default Model Configuration')` stays as-is
- Remove `delete process.env.CODEX_MCP_CALLBACK_URI` from beforeEach
- Update all `executeCommand('codex', ['exec', '--model', 'gpt-5.3-codex', '--skip-git-repo-check', ...])` matchers to `executeCommand('claude', ['-p', ..., '--model', 'claude-sonnet-4-6', '--output-format', 'json'])`
- Test name 'should use gpt-5.3-codex as default model...' -> 'should use claude-sonnet-4-6 as default model when no model specified'
- `expect(result.content[0]._meta?.model).toBe('gpt-5.3-codex')` -> `toBe('claude-sonnet-4-6')`
- `expect(result.structuredContent?.model).toBe('gpt-5.3-codex')` -> `toBe('claude-sonnet-4-6')`
- Remove `expect(result._meta?.callbackUri).toBeUndefined()` (callbackUri is gone entirely)
- Remove the `reasoningEffort` test ('should combine default model with reasoning effort') — reasoningEffort no longer exists in ClaudeToolSchema
- Rename `CODEX_DEFAULT_MODEL` env var tests to `CLAUDE_DEFAULT_MODEL`. Update `process.env.CODEX_DEFAULT_MODEL` -> `process.env.CLAUDE_DEFAULT_MODEL` in all set/delete operations and test descriptions
- Resume test: update expected args from codex resume subcommand format to `['-p', ..., '--resume', 'existing-conv-id', '--model', 'claude-sonnet-4-6', '--output-format', 'json']`

**mcp-stdio.test.ts:**
- Rename `createCodexStub()` -> `createClaudeStub()`; the stub file name changes from `codex` to `claude` (the actual binary name on PATH):
  ```
  const stubPath = path.join(stubDir, 'claude')
  const stubDir = mkdtempSync(path.join(tmpdir(), 'claude-mcp-test-'))
  ```
- The stub script: update to output JSON on stdout matching claude --output-format json format:
  ```sh
  #!/bin/sh
  printf '{"result":"ok","session_id":"sess_stub_123"}\n'
  exit 0
  ```
  (Remove the `thread id:` stderr output since threadId is no longer extracted)
- Remove `CODEX_MCP_CALLBACK_URI: 'http://localhost/callback'` from spawn env
- In the tools/list assertion: change `tool.name === 'codex'` -> `tool.name === 'claude'`; update outputSchema properties check: `{ sessionId: { type: 'string' } }` (not threadId)
- In tools/call: change `name: 'codex'` -> `name: 'claude'`; remove `_meta?.callbackUri` assertion; remove `threadId` assertions; add `structuredContent?.sessionId` assertion checking `'sess_stub_123'`

**context-building.test.ts:**
- Replace `import { CodexToolHandler }` -> `import { ClaudeToolHandler }`
- Replace `handler = new CodexToolHandler(...)` -> `handler = new ClaudeToolHandler(...)`
- Replace `handler: CodexToolHandler` type -> `ClaudeToolHandler`
- `describe('Context Building Analysis')` stays as-is
- Update comment: `// Check what prompt was sent to Codex` -> `// Check what prompt was sent to Claude`
- Update prompt index: old code checked index 4 (`exec, --model, gpt-5.3-codex, --skip-git-repo-check, prompt`). New cmdArgs are `['-p', enhancedPrompt, '--model', ...]` so enhanced prompt is at index 1 (`call?.[1]?.[1]`)
- Mock responses: use `stdout: JSON.stringify({ result: 'Test response' })` so `result.content[0].text` equals `'Test response'`
  </action>
  <verify>cd /Users/jonathanborduas/code/claude-mcp-server && grep -ri 'codex' src/__tests__/ || echo "No codex refs in tests"</verify>
  <done>No codex references remain in any test file; grep returns nothing (or the "No codex refs" echo)</done>
</task>

</tasks>

<verification>
After all five tasks:

```bash
cd /Users/jonathanborduas/code/claude-mcp-server

# Full TypeScript compile check
npx tsc --noEmit

# Confirm no codex references remain anywhere in src/ (source + tests)
grep -ri 'codex' src/

# Confirm package.json name and bin
node -e "const p = require('./package.json'); console.log(p.name, Object.keys(p.bin))"

# Build to confirm dist compiles
npm run build
```

Expected: tsc exits 0, grep returns nothing, package name is "claude-mcp-server", build succeeds.
</verification>

<success_criteria>
- All source files, test files, and package.json modified with no codex references remaining in src/
- TypeScript compiles without errors
- The main tool is named 'claude' (TOOLS.CLAUDE = 'claude')
- CLI args use: claude -p prompt --model model --output-format json --cwd dir --resume session-id
- Session ID extracted from JSON stdout field session_id
- routerBaseUrl overrides ANTHROPIC_BASE_URL env var
- package.json name is "claude-mcp-server", bin entry is "claude-mcp-server"
- Server class is ClaudeMcpServer; index.ts SERVER_CONFIG.name is 'claude-mcp-server'
- Test files reference ClaudeToolHandler, ClaudeMcpServer, TOOLS.CLAUDE, claude-sonnet-4-6
</success_criteria>

<output>
After completion, create `/Users/jonathanborduas/code/QGSD/.planning/quick/42-adapt-claude-mcp-server-fork-replace-cod/42-SUMMARY.md`
</output>
