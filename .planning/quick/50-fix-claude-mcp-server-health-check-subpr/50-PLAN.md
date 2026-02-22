---
phase: quick-50
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/code/claude-mcp-server/src/tools/simple-tools.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/index.test.ts
autonomous: true
requirements:
  - QUICK-50

must_haves:
  truths:
    - "health_check spawns claude subprocess with ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY explicitly in the env"
    - "health_check subprocess reaches the configured provider URL, not api.anthropic.com"
    - "The fix works even if Claude Code's MCP runtime filters process.env before passing to Node"
    - "TypeScript compiles without errors after the change"
    - "Existing tests pass (tool count updated to 7)"
  artifacts:
    - path: "/Users/jonathanborduas/code/claude-mcp-server/src/tools/simple-tools.ts"
      provides: "health_check execute() passes explicit env override to executeCommand"
      contains: "ANTHROPIC_BASE_URL"
    - path: "/Users/jonathanborduas/code/claude-mcp-server/dist/tools/simple-tools.js"
      provides: "Compiled output used by running MCP servers"
    - path: "/Users/jonathanborduas/code/claude-mcp-server/src/__tests__/index.test.ts"
      provides: "Updated tool count assertion (6 -> 7)"
  key_links:
    - from: "healthCheckTool.execute()"
      to: "executeCommand()"
      via: "explicit envOverride arg with ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY"
      pattern: "ANTHROPIC_BASE_URL.*process\\.env"
    - from: "executeCommand()"
      to: "spawn() env option"
      via: "{ ...process.env, ...envOverride } merge"
      pattern: "envOverride.*process\\.env"
---

<objective>
Fix claude-mcp-server health_check so its claude subprocess explicitly receives ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY via the envOverride parameter, guaranteeing the subprocess reaches the configured provider rather than api.anthropic.com.

Purpose: health_check is used by bin/check-mcp-health.cjs before quorum calls to fast-fail on dead providers. A timeout (10s) because the subprocess tries api.anthropic.com defeats the purpose entirely.

Output: Patched simple-tools.ts, rebuilt dist/, updated test assertion for tool count 7.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md

# Root cause
The health_check execute() calls:
  executeCommand('claude', [...args], undefined, HEALTH_TIMEOUT_MS)

executeCommand()'s spawn() uses:
  env: envOverride ? { ...process.env, ...envOverride } : process.env

With envOverride=undefined it falls back to process.env. However Claude Code's MCP
stdio transport may not guarantee that the env block from ~/.claude.json is present
in the node process's process.env by the time spawn() is called. The explicit fix is
to pass the critical vars as an envOverride so they are definitely merged in.

# executeCommand signature (command.ts lines 36-41)
  export async function executeCommand(
    file: string,
    args: string[] = [],
    envOverride?: ProcessEnv,      // <-- third param
    timeoutMs: number = TIMEOUT_MS
  ): Promise<CommandResult>

When envOverride is provided, spawn() uses { ...process.env, ...envOverride }.
The override entries WIN over process.env, which is exactly what we want.

# Test stale assertion
index.test.ts line 43: expect(toolDefs).toHaveLength(6)
healthCheckTool was added to the registry (tools/index.ts line 6) so the real
count is 7. Update assertion to 7.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pass explicit env override in health_check subprocess spawn</name>
  <files>/Users/jonathanborduas/code/claude-mcp-server/src/tools/simple-tools.ts</files>
  <action>
In the healthCheckTool.execute() function (around line 163), replace the
executeCommand call that passes undefined as envOverride with one that
explicitly passes ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY from process.env.

Current code:
  await executeCommand(
    'claude',
    ['-p', 'Reply with exactly one word: ok', '--model', model, '--max-turns', '1', '--output-format', 'json'],
    undefined,
    HEALTH_TIMEOUT_MS
  );

Replace with:
  const healthEnv: Record<string, string | undefined> = {
    ANTHROPIC_BASE_URL: process.env['ANTHROPIC_BASE_URL'],
    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'],
  };
  await executeCommand(
    'claude',
    ['-p', 'Reply with exactly one word: ok', '--model', model, '--max-turns', '1', '--output-format', 'json'],
    healthEnv,
    HEALTH_TIMEOUT_MS
  );

This change is safe: executeCommand merges envOverride with process.env
({ ...process.env, ...envOverride }), so all other env vars are still present.
The explicit keys simply guarantee ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY
survive even if the MCP runtime strips custom env vars from process.env.

Do NOT change the function signature, the HEALTH_TIMEOUT_MS constant, or anything
outside the execute() body of healthCheckTool.
  </action>
  <verify>
Run from /Users/jonathanborduas/code/claude-mcp-server:
  npm run build
TypeScript must compile with zero errors.
Then grep to confirm the fix is present:
  grep -n "ANTHROPIC_BASE_URL" /Users/jonathanborduas/code/claude-mcp-server/src/tools/simple-tools.ts
Must show at least 1 hit inside healthCheckTool.execute().
  </verify>
  <done>
simple-tools.ts healthCheckTool.execute() passes healthEnv object containing
ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY as the third argument to executeCommand.
npm run build exits 0.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update stale tool count assertion and rebuild dist</name>
  <files>/Users/jonathanborduas/code/claude-mcp-server/src/__tests__/index.test.ts</files>
  <action>
Update the tool count assertion in index.test.ts to reflect that healthCheckTool
is now registered (it was added to tools/index.ts toolRegistry.push() call but the
test was never updated).

Find this line (around line 43):
  expect(toolDefs).toHaveLength(6);

Change it to:
  expect(toolDefs).toHaveLength(7);

Also add TOOLS.HEALTH_CHECK to the toolNames assertions block immediately after
the existing six toContain checks:
  expect(toolNames).toContain(TOOLS.HEALTH_CHECK);

This documents that health_check is a real registered tool.

After editing the test, run the full test suite from
/Users/jonathanborduas/code/claude-mcp-server:
  npm test -- --passWithNoTests 2>&1 | tail -20

The test that checks build (should build successfully) will recompile. All tests
must pass. If any test other than the count assertion was already failing before
this change, note it in the summary but do not fix unrelated failures.

Then rebuild dist one final time to ensure the installed binary matches source:
  npm run build
  </action>
  <verify>
From /Users/jonathanborduas/code/claude-mcp-server:
  npm test 2>&1 | grep -E "PASS|FAIL|Tests:"
All test files must show PASS. Grep confirms:
  grep "toHaveLength(7)" /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/index.test.ts
  grep "HEALTH_CHECK" /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/index.test.ts
Both must return hits.
  </verify>
  <done>
index.test.ts asserts toHaveLength(7) and includes TOOLS.HEALTH_CHECK in the
toolNames check. npm test exits 0 with all suites PASS. dist/ reflects both Task 1
and Task 2 changes.
  </done>
</task>

</tasks>

<verification>
1. grep -n "ANTHROPIC_BASE_URL" /Users/jonathanborduas/code/claude-mcp-server/src/tools/simple-tools.ts
   — must show hit inside healthCheckTool.execute()

2. grep "toHaveLength(7)" /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/index.test.ts
   — must return a match

3. cd /Users/jonathanborduas/code/claude-mcp-server && npm run build && npm test
   — build 0 errors, all tests PASS
</verification>

<success_criteria>
- health_check subprocess receives ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY explicitly via envOverride
- TypeScript compiles cleanly (npm run build exits 0)
- All existing tests pass with updated tool count of 7
- dist/ is rebuilt and matches source changes
</success_criteria>

<output>
After completion, create `/Users/jonathanborduas/code/QGSD/.planning/quick/50-fix-claude-mcp-server-health-check-subpr/50-SUMMARY.md` using the standard summary template.
</output>
