---
phase: quick-282
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/providers.json
  - bin/unified-mcp-server.mjs
  - commands/nf/mcp-repair.md
autonomous: true
requirements: [QUICK-282]
formal_artifacts: none

must_haves:
  truths:
    - "Every provider in providers.json has a deep_probe config with prompt, expect, and timeout_ms"
    - "Only claude-1..6 slots have a service lifecycle block (start/stop/status commands)"
    - "CLI slots (codex, gemini, opencode, copilot) do NOT have a service block"
    - "deep_health_check MCP tool is available in slot mode and returns { healthy, latencyMs, layer, error }"
    - "deep_health_check spawns the CLI with the probe prompt and checks stdout for the expected string"
    - "MCP repair skill uses a 4-step diagnostic: shallow check, service status, deep probe, final verdict"
    - "MCP repair auto-starts downed services via service.start command before deep probe"
    - "Existing health_check tool remains unchanged for fast dashboards"
  artifacts:
    - path: "bin/providers.json"
      provides: "service and deep_probe config for all slots"
      contains: "deep_probe"
    - path: "bin/unified-mcp-server.mjs"
      provides: "deep_health_check MCP tool implementation"
      contains: "deep_health_check"
    - path: "commands/nf/mcp-repair.md"
      provides: "Updated repair flow with 4-step diagnostic"
      contains: "deep_health_check"
  key_links:
    - from: "bin/unified-mcp-server.mjs"
      to: "bin/providers.json"
      via: "reads deep_probe config at startup"
      pattern: "deep_probe"
    - from: "commands/nf/mcp-repair.md"
      to: "bin/unified-mcp-server.mjs"
      via: "calls deep_health_check MCP tool"
      pattern: "mcp__.*__deep_health_check"
    - from: "commands/nf/mcp-repair.md"
      to: "bin/providers.json"
      via: "reads service.status/start commands for auto-start"
      pattern: "service"
---

<objective>
Add service lifecycle management and deep inference probing to the nForma MCP infrastructure.

Purpose: Current health checks only verify CLI binary availability (shallow). This adds: (1) service lifecycle commands (start/stop/status) for ccr-based slots so downed background services can be auto-started, and (2) a deep_health_check tool that sends a real inference prompt through the full CLI pipeline to classify failures as BINARY_MISSING, SERVICE_DOWN, AUTH_EXPIRED, QUOTA_EXCEEDED, INFERENCE_TIMEOUT, or INFERENCE_OK.

Output: Updated providers.json schema, new deep_health_check MCP tool in unified-mcp-server.mjs, updated mcp-repair.md with 4-step diagnostic flow.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/providers.json
@bin/unified-mcp-server.mjs
@commands/nf/mcp-repair.md
@.planning/formal/spec/mcp-calls/invariants.md
</context>

<formal_note>
The mcp-calls invariant (EventualDecision) governs quorum reaching DECIDED state via WF_vars on QuorumProcessOutcomes, QuorumDecide, and TimeoutAction. The new deep_health_check tool is a diagnostic/observational tool invoked outside the quorum decision path — it does not affect quorum round processing, timeout semantics, or the DECIDED state transition. No invariant violation.
</formal_note>

<tasks>

<task type="auto">
  <name>Task 1: Add service lifecycle and deep_probe fields to providers.json</name>
  <files>bin/providers.json</files>
  <action>
Add two new optional fields to each provider entry in providers.json:

1. **`service`** — ONLY for claude-1 through claude-6 (ccr-based slots). These use background `ccr` services. Add to each claude-N entry:
```json
"service": {
  "start": ["ccr", "start"],
  "stop": ["ccr", "stop"],
  "status": ["ccr", "status"]
}
```
Do NOT add `service` to codex-1, codex-2, gemini-1, gemini-2, opencode-1, or copilot-1 — these are stateless CLI binaries with no background service.

2. **`deep_probe`** — Add to ALL provider entries (every slot). The probe sends a trivial prompt through the real inference path:
```json
"deep_probe": {
  "prompt": "respond with: PROBE_OK",
  "expect": "PROBE_OK",
  "timeout_ms": 20000
}
```

Place `service` (when present) after `display_type` or `env` and before end of object. Place `deep_probe` after `service` (or after `display_type`/`env` for CLI slots).

Ensure valid JSON after edits — no trailing commas, proper nesting.
  </action>
  <verify>
Run: `node -e 'const p = JSON.parse(require("fs").readFileSync("bin/providers.json","utf8")); const slots = p.providers; const claude = slots.filter(s => s.name.startsWith("claude-")); const cli = slots.filter(s => !s.name.startsWith("claude-")); console.log("All have deep_probe:", slots.every(s => s.deep_probe && s.deep_probe.prompt && s.deep_probe.expect && s.deep_probe.timeout_ms)); console.log("All claude have service:", claude.every(s => s.service && s.service.start && s.service.stop && s.service.status)); console.log("No CLI has service:", cli.every(s => !s.service)); console.log("Total slots:", slots.length);'`

Expected: All true, Total slots: 12.
  </verify>
  <done>All 12 providers have deep_probe config. Only claude-1..6 have service lifecycle. CLI slots (codex, gemini, opencode, copilot) have no service block. JSON parses without error.</done>
</task>

<task type="auto">
  <name>Task 2: Add deep_health_check tool to unified-mcp-server.mjs</name>
  <files>bin/unified-mcp-server.mjs</files>
  <action>
Add a `deep_health_check` MCP tool to the slot-mode tool set. This tool performs a real inference probe through the CLI.

**1. Register the tool in `buildSlotTools()`:**

After the existing `health_check` tool registration block (around line 148), add a `deep_health_check` tool registration for subprocess and ccr provider types:

```javascript
tools.push({
  name: 'deep_health_check',
  description: 'Deep inference probe: sends a trivial prompt through the full CLI pipeline and classifies the result. Returns { healthy, latencyMs, layer, error } where layer is BINARY_MISSING | SERVICE_DOWN | AUTH_EXPIRED | QUOTA_EXCEEDED | INFERENCE_TIMEOUT | INFERENCE_OK.',
  inputSchema: NO_ARGS_SCHEMA,
});
```

Add this inside both the `subprocess` and `ccr` type blocks (after health_check). Also add for `http` type block.

**2. Implement `runDeepHealthCheck(provider)` function:**

Add a new async function after `runSubprocessHealthCheck()` (~line 539):

```javascript
async function runDeepHealthCheck(provider) {
  const probe = provider.deep_probe;
  if (!probe) {
    return JSON.stringify({ healthy: false, latencyMs: 0, layer: 'BINARY_MISSING', error: 'No deep_probe config' });
  }

  const timeoutMs = probe.timeout_ms ?? 20000;

  // Step 1: Check binary exists
  try {
    fs.accessSync(provider.cli, fs.constants.X_OK);
  } catch (_) {
    return JSON.stringify({ healthy: false, latencyMs: 0, layer: 'BINARY_MISSING', error: `CLI not found: ${provider.cli}` });
  }

  // Step 2: If service config exists, check service status
  if (provider.service?.status) {
    const statusOutput = await runSubprocessWithArgs(
      { cli: provider.service.status[0], env: provider.env ?? {} },
      provider.service.status.slice(1),
      5000
    );
    // If status command indicates service is not running, report SERVICE_DOWN
    const down = statusOutput.toLowerCase().includes('not running') ||
                 statusOutput.toLowerCase().includes('stopped') ||
                 statusOutput.startsWith('[spawn error');
    if (down) {
      return JSON.stringify({ healthy: false, latencyMs: 0, layer: 'SERVICE_DOWN', error: statusOutput.trim() });
    }
  }

  // Step 3: Run the actual inference probe
  const startTime = Date.now();
  const probeArgs = provider.args_template.map(a => a === '{prompt}' ? probe.prompt : a);
  const output = await runSubprocessWithArgs(provider, probeArgs, timeoutMs);
  const latencyMs = Date.now() - startTime;

  // Classify the result
  if (output.startsWith('[spawn error')) {
    return JSON.stringify({ healthy: false, latencyMs, layer: 'BINARY_MISSING', error: output });
  }
  if (output.includes('[TIMED OUT') || output.includes('TIMED OUT')) {
    return JSON.stringify({ healthy: false, latencyMs, layer: 'INFERENCE_TIMEOUT', error: `Timed out after ${timeoutMs}ms` });
  }

  const lower = output.toLowerCase();
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('auth') && lower.includes('expired')) {
    return JSON.stringify({ healthy: false, latencyMs, layer: 'AUTH_EXPIRED', error: output.slice(0, 300) });
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota')) {
    return JSON.stringify({ healthy: false, latencyMs, layer: 'QUOTA_EXCEEDED', error: output.slice(0, 300) });
  }

  if (output.includes(probe.expect)) {
    return JSON.stringify({ healthy: true, latencyMs, layer: 'INFERENCE_OK', error: null });
  }

  // Got a response but it doesn't contain the expected string — still inference worked
  // This is common when models add extra text around PROBE_OK
  // Be lenient: if we got substantial output without error indicators, call it OK
  if (output.length > 5 && !output.startsWith('[')) {
    return JSON.stringify({ healthy: true, latencyMs, layer: 'INFERENCE_OK', error: null });
  }

  return JSON.stringify({ healthy: false, latencyMs, layer: 'INFERENCE_TIMEOUT', error: output.slice(0, 300) });
}
```

**3. Wire into `handleSlotToolCall()`:**

In the `subprocess` block of `handleSlotToolCall()` (after the health_check handler around line 571), add:

```javascript
if (toolName === 'deep_health_check') {
  return runDeepHealthCheck(slotProvider);
}
```

Add the same handler in the `ccr` block (after the ccr health_check handler around line 588) and in the `http` block.

For `http` type, the deep probe implementation should use the HTTP path instead: send the probe prompt via `runSlotHttpProvider()` and check output contains the expected string. Wrap the http deep probe in its own classification logic (same layer enum).

**Important:** The existing `health_check` tool must remain completely unchanged. `deep_health_check` is additive only.
  </action>
  <verify>
Run: `node -e 'import("./bin/unified-mcp-server.mjs").catch(() => {})' 2>&1 | head -5` to confirm no syntax errors on import.

Then verify the tool is registered by searching for `deep_health_check` in the file:
`grep -c 'deep_health_check' bin/unified-mcp-server.mjs` — expect at least 5 occurrences (tool registration x3 types + handler x3 types + function def).

Verify existing health_check is untouched:
`grep -c 'runSubprocessHealthCheck' bin/unified-mcp-server.mjs` — expect same count as before (2: definition + call).
  </verify>
  <done>deep_health_check MCP tool registered in slot mode for all provider types (subprocess, ccr, http). Function runDeepHealthCheck implements 3-step probe: binary check, service status check, inference probe with classification into BINARY_MISSING/SERVICE_DOWN/AUTH_EXPIRED/QUOTA_EXCEEDED/INFERENCE_TIMEOUT/INFERENCE_OK layers. Existing health_check tool unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: Update mcp-repair.md with 4-step deep diagnostic flow</name>
  <files>commands/nf/mcp-repair.md</files>
  <action>
Update the MCP repair skill to use the new 4-step diagnostic flow. Changes:

**1. Add deep_health_check tools to the frontmatter `allowed-tools` list:**

Add after the existing health_check entries:
```yaml
  - mcp__codex-1__deep_health_check
  - mcp__gemini-1__deep_health_check
  - mcp__opencode-1__deep_health_check
  - mcp__copilot-1__deep_health_check
  - mcp__claude-1__deep_health_check
  - mcp__claude-2__deep_health_check
  - mcp__claude-3__deep_health_check
  - mcp__claude-4__deep_health_check
  - mcp__claude-5__deep_health_check
  - mcp__claude-6__deep_health_check
```

**2. Replace Step 2 (Classify each slot's health) with the new 4-step diagnostic:**

Replace the classification logic with:

**Step 2a — Shallow check (existing health_check):** Already done in Step 1 via health_check calls. Use results from $BEFORE_STATE. If identity is null and health_check is null, the slot is unreachable.

**Step 2b — Service status check (new):** For slots that have `service` config in providers.json (claude-1..6), run:

```bash
node -e '
var fs = require("fs");
var cp = require("child_process");
var providers = JSON.parse(fs.readFileSync("bin/providers.json", "utf8"));
var result = {};
providers.providers.forEach(function(p) {
  if (p.service && p.service.status) {
    try {
      var out = cp.execFileSync(p.service.status[0], p.service.status.slice(1), {encoding:"utf8", timeout: 5000});
      result[p.name] = out.trim();
    } catch(e) {
      result[p.name] = "error: " + (e.message || "unknown");
    }
  }
});
console.log(JSON.stringify(result));
'
```

If any service reports not-running/stopped, classify as SERVICE_DOWN and attempt auto-start:

```bash
# For each SERVICE_DOWN slot, run the start command
node -e '
var cp = require("child_process");
var cmd = <service.start array>;
try {
  cp.execFileSync(cmd[0], cmd.slice(1), {encoding:"utf8", timeout: 10000});
  console.log("started");
} catch(e) {
  console.log("start failed: " + e.message);
}
'
```

Wait 3 seconds after start, then re-check status.

**Step 2c — Deep probe:** For all slots that passed shallow check (or were just auto-started), invoke `deep_health_check` via the Task() sub-agent pattern. Add `mcp__<slot>__deep_health_check` calls to the sub-agent prompt, collecting results as `$DEEP_STATE`.

Update the Task() sub-agent prompt in Step 1 to also call deep_health_check for each slot (items 21-30 in the call list), storing results as `<slot>_deep`. Update the return JSON structure to include `"deep": <slot_deep or null>` alongside identity and hc.

**Step 2d — Final classification:** Use the combined results:

| Layer from deep_health_check | Category | Auto-fixable? |
|---|---|---|
| INFERENCE_OK | healthy | No action needed |
| BINARY_MISSING | cli-missing | NO — tell user to install |
| SERVICE_DOWN | service-down | YES — auto-start attempted in 2b |
| AUTH_EXPIRED | auth-expired | NO — tell user to re-auth |
| QUOTA_EXCEEDED | quota-exceeded | NO — report wait time |
| INFERENCE_TIMEOUT | timeout | NO — suggest /nf:mcp-restart |

**3. Update Step 4 (Auto-repair):** Add service auto-start logic alongside the existing pkill restart. If a slot is classified as `service-down` and has `service.start` in providers.json:

- Run `service.start` command
- Wait 3 seconds
- Re-run deep_health_check to verify

Keep the existing pkill restart for `mcp-down` slots that don't have service config.

**4. Update the diagnosis table columns:** Add a "Layer" column showing the deep_health_check layer result.

**5. Update success_criteria:** Add "Deep inference probe (deep_health_check) used for comprehensive diagnosis" and "Service auto-start attempted for SERVICE_DOWN slots with service.start config".
  </action>
  <verify>
Verify the updated mcp-repair.md:
- `grep -c 'deep_health_check' commands/nf/mcp-repair.md` — expect at least 5 occurrences
- `grep -c 'service' commands/nf/mcp-repair.md` — expect at least 3 occurrences for service lifecycle references
- `grep 'allowed-tools' -A 40 commands/nf/mcp-repair.md | grep -c 'deep_health_check'` — expect 10 (one per slot)
- Verify the 4-step flow is documented: `grep -c 'Step 2[abcd]' commands/nf/mcp-repair.md` — expect 4
  </verify>
  <done>MCP repair skill updated with 4-step diagnostic: (1) shallow health_check, (2) service status check with auto-start for SERVICE_DOWN, (3) deep inference probe via deep_health_check tool, (4) combined classification. Frontmatter includes all deep_health_check tool permissions. Diagnosis table includes Layer column. Auto-start logic uses service.start from providers.json for ccr-based slots.</done>
</task>

</tasks>

<verification>
1. `node -e 'JSON.parse(require("fs").readFileSync("bin/providers.json","utf8"))'` — JSON valid
2. `grep -c 'deep_probe' bin/providers.json` — 12 (one per slot)
3. `grep -c 'service' bin/providers.json` — at least 18 (3 commands x 6 claude slots)
4. `grep -c 'deep_health_check' bin/unified-mcp-server.mjs` — at least 5
5. `grep -c 'deep_health_check' commands/nf/mcp-repair.md` — at least 5
6. `grep -c 'runSubprocessHealthCheck' bin/unified-mcp-server.mjs` — unchanged (2)
7. Node can load the server without syntax errors
</verification>

<success_criteria>
- providers.json has deep_probe on all 12 slots, service on claude-1..6 only
- unified-mcp-server.mjs exposes deep_health_check tool in slot mode returning { healthy, latencyMs, layer, error }
- deep_health_check classifies into exactly 6 layers: BINARY_MISSING, SERVICE_DOWN, AUTH_EXPIRED, QUOTA_EXCEEDED, INFERENCE_TIMEOUT, INFERENCE_OK
- mcp-repair.md uses 4-step diagnostic with service auto-start
- Existing health_check tool completely unchanged
- No mcp-calls invariant violations (deep_health_check is observational, outside quorum decision path)
</success_criteria>

<output>
After completion, create `.planning/quick/282-add-service-lifecycle-and-deep-inference/SUMMARY.md`
</output>
