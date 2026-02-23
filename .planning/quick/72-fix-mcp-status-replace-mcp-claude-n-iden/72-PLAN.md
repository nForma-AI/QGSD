---
phase: quick-72
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/mcp-status.md
autonomous: true
requirements:
  - QUICK-72
must_haves:
  truths:
    - "mcp-status shows correct model IDs for claude-1..6 (DeepSeek-V3.2, MiniMax-M2.5, etc.) read from providers.json"
    - "mcp-status shows real endpoint health for HTTP providers (AkashML, Together, Fireworks) via inline HTTP probe"
    - "mcp-status shows correct model name and identity info for CLI agents (codex-1, gemini-1, opencode-1, copilot-1)"
    - "mcp-status UNAVAIL lookup handles both old simple keys (deepseek) and new composite keys (claude-1:deepseek-ai/DeepSeek-V3.2)"
    - "no mcp__claude-N__identity calls anywhere in mcp-status.md"
  artifacts:
    - path: "commands/qgsd/mcp-status.md"
      provides: "Rewritten mcp-status slash command"
      contains: "providers.json"
  key_links:
    - from: "mcp-status.md Step 2"
      to: "bin/providers.json"
      via: "Bash node -e inline script"
      pattern: "providers.json"
    - from: "mcp-status.md Step 3"
      to: "HTTP baseUrl /models probe"
      via: "inline https.get in node -e script"
      pattern: "baseUrl.*models"
---

<objective>
Rewrite commands/qgsd/mcp-status.md to replace the broken mcp__claude-N__identity calls with direct providers.json reads for HTTP providers (claude-1..6), and add an inline HTTP health probe for those endpoints. Update CLI agent slot names from old codex-cli-1/gemini-cli-1 to current codex-1/gemini-1/opencode-1/copilot-1. Fix UNAVAIL scoreboard lookup to handle both old simple keys and new composite slot:model-id keys.

Purpose: mcp__claude-N__identity hits the old claude-mcp-server which returns Anthropic's model list, not the actual DeepSeek/MiniMax/etc. model IDs configured in providers.json. The command shows wrong model info for 6 of 10 agents.
Output: commands/qgsd/mcp-status.md fully rewritten with correct agent table, providers.json-backed static info, and inline endpoint health probe.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/providers.json
@commands/qgsd/mcp-status.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite mcp-status.md — remove identity calls for HTTP providers, add providers.json read and inline HTTP probe</name>
  <files>commands/qgsd/mcp-status.md</files>
  <action>
Completely replace commands/qgsd/mcp-status.md with the following updated content.

Key changes vs the old file:

1. **allowed-tools**: Remove all `mcp__claude-N__identity` entries (lines 11-16). Update CLI identity tool names from old `codex-cli-1`/`gemini-cli-1` to current `codex-1`/`gemini-1`/`opencode-1`/`copilot-1`. Add `mcp__unified-1__*` is NOT added (no inference tools).

2. **Step 1 (scoreboard)**: Update the UNAVAIL count extraction to handle BOTH key formats — old simple keys like `deepseek`/`minimax`/`qwen-coder`/`kimi`/`llama4`/`glm` AND new composite keys like `claude-1:deepseek-ai/DeepSeek-V3.2`. Build a lookup by both the slot prefix (before `:`) and the full composite key. The mapping from slot to old simple key:
   - claude-1 → deepseek
   - claude-2 → minimax
   - claude-3 → qwen-coder
   - claude-4 → kimi
   - claude-5 → llama4
   - claude-6 → glm

3. **Step 2 (load HTTP provider info)**: Run a Bash node -e script that reads `bin/providers.json` (relative to cwd), filters providers where `type === "http"`, and produces a JSON map: `{ "claude-1": { model, description, baseUrl, apiKeyEnv }, ... }`. Store as HTTP_PROVIDERS.

4. **Step 3 (probe HTTP endpoints)**: Run a Bash node -e script that groups the 6 HTTP providers by baseUrl (AkashML, Together, Fireworks = 3 unique), then probes `GET baseUrl/models` with a 7-second timeout using Node's built-in `https` module. Accept HTTP 200/401/403/404/422 as healthy. Produce JSON: `{ "https://api.akashml.com/v1": { healthy, latencyMs, error }, ... }`. Store as ENDPOINT_HEALTH.

5. **Step 4 (call identity on CLI agents only)**: Call identity sequentially on the 4 CLI agents using their current slot names: `mcp__codex-1__identity`, `mcp__gemini-1__identity`, `mcp__opencode-1__identity`, `mcp__copilot-1__identity`. Wrap in try/catch — on error fill with `—`. Parse name/version/model/available_models/install_method from response.

6. **Step 5 (assemble all 10 agent rows)**:
   - For CLI agents (codex-1, gemini-1, opencode-1, copilot-1): use identity call result for model/version/available_models. Health = `error` if identity failed, else check UNAVAIL count > 0 → `quota-exceeded`, else `available`.
   - For HTTP agents (claude-1..6): model = from HTTP_PROVIDERS map. Version = `1.0.0` (static, unified-mcp-server). available_models = `—` (single model per slot). Health: look up the provider's baseUrl in ENDPOINT_HEALTH; if `healthy=false` → `endpoint-down`; else if UNAVAIL count > 0 → `quota-exceeded`; else → `available`.

7. **UNAVAIL count lookup for HTTP agents**: Check both the composite key `slot:model-id` (e.g. `claude-1:deepseek-ai/DeepSeek-V3.2`) and the old simple key (e.g. `deepseek`). Use the maximum of the two counts found.

8. **Step 6 (render table)**: Same table format as before. Update column count comment from "10 agents" to "10 agents". Add a new "Endpoint" column showing the probe latency (e.g. `42ms`) for HTTP agents and `—` for CLI agents. Place it between Health and Available Models.

9. **Banner**: Change "Querying 10 agents..." to "Querying 4 CLI agents + 6 HTTP providers..."

The updated allowed-tools section must be:
```yaml
allowed-tools:
  - Read
  - Bash
  - mcp__codex-1__identity
  - mcp__gemini-1__identity
  - mcp__opencode-1__identity
  - mcp__copilot-1__identity
```

The Bash scripts for Steps 2, 3, and the scoreboard read (Step 1) must all use absolute-or-relative paths that work when the command runs from the project root (cwd = repo root). Use `process.cwd()` + `'bin/providers.json'` to locate providers.json. Use `path.join(process.cwd(), '.planning', 'quorum-scoreboard.json')` for the scoreboard.

Important: the inline HTTP probe script in Step 3 must NOT depend on check-provider-health.cjs (that script only reads old claude-mcp-server entries from ~/.claude.json, not unified providers.json HTTP providers). Implement the probe inline with Node's built-in `https` module.
  </action>
  <verify>
1. `grep "mcp__claude-" commands/qgsd/mcp-status.md` returns no matches (all old identity tools removed)
2. `grep "providers.json" commands/qgsd/mcp-status.md` shows at least one match (providers.json read present)
3. `grep "mcp__codex-1__identity\|mcp__gemini-1__identity" commands/qgsd/mcp-status.md` returns matches (CLI identity tools still present with correct slot names)
4. `grep "endpoint-down\|ENDPOINT_HEALTH\|baseUrl" commands/qgsd/mcp-status.md` shows the HTTP probe logic is present
5. `grep "claude-1:deepseek\|composite" commands/qgsd/mcp-status.md` shows composite key handling is present
  </verify>
  <done>
- commands/qgsd/mcp-status.md has no mcp__claude-N__identity tools in allowed-tools or anywhere in the process steps
- CLI agents use identity tools with current slot names (codex-1 not codex-cli-1)
- HTTP providers (claude-1..6) get their model info from providers.json via Bash node -e inline read
- HTTP endpoint health comes from inline https probe of baseUrl/models (3 probes: AkashML, Together, Fireworks)
- UNAVAIL lookup handles both old simple keys and new composite slot:model-id keys
- Health column shows available / quota-exceeded / endpoint-down / error as appropriate
  </done>
</task>

</tasks>

<verification>
After the task completes:
1. `grep "mcp__claude-" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md` — must return empty
2. `grep "mcp__codex-1__identity" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md` — must return a match
3. `grep "providers.json" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md` — must return a match
4. `grep "endpoint-down" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md` — must return a match (HTTP health state)
5. Visually inspect the allowed-tools block — must have exactly: Read, Bash, mcp__codex-1__identity, mcp__gemini-1__identity, mcp__opencode-1__identity, mcp__copilot-1__identity (6 entries, no claude-N identity tools)
</verification>

<success_criteria>
- mcp-status.md shows correct model names for claude-1..6 (DeepSeek-V3.2, MiniMax-M2.5, Qwen3-Coder-480B-A35B-Instruct-FP8, kimi-k2p5, Llama-4-Maverick-17B-128E-Instruct-FP8, glm-5) sourced from providers.json
- HTTP endpoint health probed directly (3 providers: AkashML, Together, Fireworks) via inline Node https call
- CLI agent identity calls use current slot names (codex-1, gemini-1, opencode-1, copilot-1)
- No mcp__claude-N__identity in allowed-tools or process steps
- UNAVAIL scoreboard handles composite keys (claude-1:deepseek-ai/DeepSeek-V3.2) and old simple keys (deepseek)
- Command remains read-only, no quorum invocation
</success_criteria>

<output>
After completion, create `.planning/quick/72-fix-mcp-status-replace-mcp-claude-n-iden/72-SUMMARY.md`
</output>
