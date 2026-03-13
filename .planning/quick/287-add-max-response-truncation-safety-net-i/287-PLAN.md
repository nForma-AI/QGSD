---
phase: quick-287
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/unified-mcp-server.mjs
autonomous: true
requirements: [SAFETY-NET-01]
formal_artifacts: none

must_haves:
  truths:
    - "MCP tool responses from runProvider() are capped at 25KB before being sent to Claude Code"
    - "MCP tool responses from runHttpProvider() are capped at 25KB before being sent to Claude Code"
    - "MCP tool responses from runSlotHttpProvider() are capped at 25KB before being sent to Claude Code"
    - "Truncated responses include a [TRUNCATED] suffix indicating the original size"
    - "The existing MAX_BUFFER (10MB) internal buffering is unchanged"
  artifacts:
    - path: "bin/unified-mcp-server.mjs"
      provides: "MAX_RESPONSE truncation safety net"
      contains: "MAX_RESPONSE"
  key_links:
    - from: "bin/unified-mcp-server.mjs"
      to: "handleRequest tools/call"
      via: "truncateResponse() applied before sendResult"
      pattern: "truncateResponse"
---

<objective>
Add a MAX_RESPONSE truncation safety net in unified-mcp-server.mjs to cap MCP tool responses at 25KB before they are returned via JSON-RPC sendResult().

Purpose: Direct MCP calls (e.g. mcp__codex-1__review) bypass quorum-slot-dispatch.cjs (which caps at 50KB) and go through unified-mcp-server.mjs, which currently buffers up to 10MB (MAX_BUFFER). A codex-1 review call returned 116,507 characters which overflowed Claude Code's MCP result size limit. This adds a truncation check mirroring the pattern from quorum-slot-dispatch.cjs.

Output: Modified unified-mcp-server.mjs with response-level truncation.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/unified-mcp-server.mjs
@bin/quorum-slot-dispatch.cjs (lines 1007-1035 for truncation pattern reference)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add MAX_RESPONSE truncation to unified-mcp-server.mjs</name>
  <files>bin/unified-mcp-server.mjs</files>
  <action>
Add a response-level truncation function to unified-mcp-server.mjs that caps tool output at 25KB before it reaches sendResult(). This is distinct from the existing MAX_BUFFER (10MB) which controls internal buffering during subprocess execution -- MAX_RESPONSE controls the final response size sent back over the MCP JSON-RPC channel.

1. Add a constant near the existing MAX_BUFFER constant (line 247):
   ```
   const MAX_RESPONSE = 25 * 1024; // 25KB — MCP result size safety net
   ```

2. Add a truncateResponse() helper function right after the MAX_RESPONSE constant:
   ```
   function truncateResponse(text) {
     if (typeof text !== 'string' || text.length <= MAX_RESPONSE) return text;
     const originalLen = text.length;
     return text.slice(0, MAX_RESPONSE) +
       `\n\n[TRUNCATED by unified-mcp-server: ${originalLen} chars -> ${MAX_RESPONSE} chars]`;
   }
   ```

3. Apply truncateResponse() at the two MCP response emission points in handleRequest() (the tools/call handler):

   a. In the slot-mode dispatch block (~line 845), change:
      ```
      content: [{ type: 'text', text: typeof output === 'string' ? output : JSON.stringify(output) }],
      ```
      to:
      ```
      content: [{ type: 'text', text: truncateResponse(typeof output === 'string' ? output : JSON.stringify(output)) }],
      ```

   b. In the all-providers mode dispatch block (~line 869), change:
      ```
      content: [{ type: 'text', text: output }],
      ```
      to:
      ```
      content: [{ type: 'text', text: truncateResponse(output) }],
      ```

Do NOT modify the internal MAX_BUFFER buffering logic in runProvider() — that controls how much data is read from the subprocess, which is a separate concern. MAX_RESPONSE is the final gate before data leaves the MCP server.

Do NOT apply truncation to error responses (isError: true) — those are already short.

Do NOT apply truncation to health_check, ping, or identity responses — those are inherently small and structured JSON. The truncation is applied at the sendResult layer so it naturally covers all tool types including those.

Formal invariants: The mcp-calls EventualDecision invariant is unaffected — truncation does not change whether a quorum decision is reached. The safety AllTransitionsValid invariant is unaffected — truncation does not change state machine transitions.
  </action>
  <verify>
    1. `grep -n 'MAX_RESPONSE' bin/unified-mcp-server.mjs` shows the constant definition and truncateResponse function
    2. `grep -n 'truncateResponse' bin/unified-mcp-server.mjs` shows at least 3 occurrences (definition + 2 call sites)
    3. `node -e "import('./bin/unified-mcp-server.mjs')" 2>&1 | head -5` — no syntax errors (will fail on missing stdin but should not show SyntaxError)
    4. Verify MAX_BUFFER (10MB) constant is still present and unchanged
  </verify>
  <done>
    - MAX_RESPONSE constant set to 25KB (25 * 1024)
    - truncateResponse() function defined and applied at both sendResult emission points in tools/call handler
    - Truncated responses include suffix: "[TRUNCATED by unified-mcp-server: {original} chars -> {max} chars]"
    - MAX_BUFFER (10MB) internal buffering is unchanged
    - No syntax errors in the modified file
  </done>
</task>

</tasks>

<verification>
- `grep 'MAX_RESPONSE' bin/unified-mcp-server.mjs` returns the constant
- `grep -c 'truncateResponse' bin/unified-mcp-server.mjs` returns 3+
- `grep 'MAX_BUFFER' bin/unified-mcp-server.mjs` still returns the 10MB constant (unchanged)
- File parses without syntax errors
</verification>

<success_criteria>
MCP tool responses from unified-mcp-server.mjs are capped at 25KB with a descriptive [TRUNCATED] suffix. The fix prevents 100K+ responses from overflowing Claude Code's MCP result size limit on direct MCP calls that bypass quorum-slot-dispatch.cjs.
</success_criteria>

<output>
After completion, create `.planning/quick/287-add-max-response-truncation-safety-net-i/287-SUMMARY.md`
</output>
