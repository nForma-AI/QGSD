---
phase: quick-393
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/mcp-status.md
autonomous: true
requirements: [QUICK-393]
must_haves:
  truths:
    - "nf:mcp-status reads slot names and types from ~/.claude.json at runtime — no hardcoded claude-1..6 or codex/gemini/opencode/copilot-1 references remain in the skill logic"
    - "Banner line computes counts dynamically (e.g. '3 CLI agents + 6 HTTP providers') from classified slot arrays"
    - "Step 3 sub-agent prompt interpolates the actual slot list from INIT_INFO.slots so it calls identity + health_check for every configured non-skip slot"
    - "Step 4 health derivation branches on slot type (cli vs http/mcp) rather than slot name pattern matching"
    - "Step 5 table rows cover all non-skip slots; Auth column uses sub for cli slots and api for http/mcp slots"
    - "success_criteria no longer asserts a fixed row count of 11"
    - "The updated skill is synced to ~/.claude/commands/nf/mcp-status.md via node bin/install.js"
  artifacts:
    - path: "commands/nf/mcp-status.md"
      provides: "Fully dynamic nf:mcp-status skill"
      contains: "SKIP_SLOTS"
---

<objective>
Rewrite commands/nf/mcp-status.md to be fully dynamic: slot names and types are read from ~/.claude.json at runtime, banner counts are computed from the classification result, and the Step 3 sub-agent tool list is built from actual configured slots — eliminating all hardcoded claude-1..6 and codex/gemini/opencode/copilot-1 references throughout the skill.

Purpose: nf:mcp-status currently breaks whenever slots are added or renamed because every count, tool call, and table row is hardcoded. This rewrite makes the skill self-updating from ~/.claude.json.

Output: Updated commands/nf/mcp-status.md synced to ~/.claude/commands/nf/mcp-status.md.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@commands/nf/mcp-status.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite commands/nf/mcp-status.md with fully dynamic slot classification</name>
  <files>commands/nf/mcp-status.md</files>
  <action>
Rewrite the file in full. Every section must change as described below.

**1. Frontmatter `allowed-tools`**

Keep existing tools (Read, Bash, Task) and all existing identity/health_check entries, then ADD the missing ones so the list covers every ccr-1..6 and opencode-2 slot:

```yaml
allowed-tools:
  - Read
  - Bash
  - Task
  - mcp__codex-1__identity
  - mcp__gemini-1__identity
  - mcp__opencode-1__identity
  - mcp__opencode-2__identity
  - mcp__copilot-1__identity
  - mcp__claude-1__identity
  - mcp__ccr-1__identity
  - mcp__ccr-2__identity
  - mcp__ccr-3__identity
  - mcp__ccr-4__identity
  - mcp__ccr-5__identity
  - mcp__ccr-6__identity
  - mcp__codex-1__health_check
  - mcp__gemini-1__health_check
  - mcp__opencode-1__health_check
  - mcp__opencode-2__health_check
  - mcp__copilot-1__health_check
  - mcp__claude-1__health_check
  - mcp__ccr-1__health_check
  - mcp__ccr-2__health_check
  - mcp__ccr-3__health_check
  - mcp__ccr-4__health_check
  - mcp__ccr-5__health_check
  - mcp__ccr-6__health_check
```

Note: Do NOT drop the existing claude-2..6 identity/health_check entries if they are still present — retain them so existing configs still work. Only ADD the new entries.

**2. `<objective>`**

Replace the current objective paragraph with:

```
Display a clean status table of all configured MCP quorum agents plus the Claude orchestrator. Slot names and types are read dynamically from ~/.claude.json at runtime — no slot names are hardcoded in this skill. For each non-skip slot: call its identity tool and health_check for real model names and latency. Read provider URLs from ~/.claude.json. Show a claude orchestrator row at the top of the table.

This command is read-only (observation only). It does NOT invoke quorum and is NOT in quorum_commands.
```

**3. Step 1 Bash — extend with slot classification**

After the existing `providers` loop (which ends before the `claudeModel` block), ADD the following slot classification block inside the same `node << 'EOF'` script, just before the final `console.log(...)` line:

```js
// Classify slots dynamically
const SKIP_SLOTS = ['canopy', 'sentry'];
const CLI_COMMANDS = ['codex', 'gemini', 'opencode', 'gh', 'copilot'];
const slots = { cli: [], http: [], mcp: [], skip: [] };
if(fs.existsSync(cfgPath)){
  const cfg2=JSON.parse(fs.readFileSync(cfgPath,'utf8'));
  for(const [name,val] of Object.entries(cfg2.mcpServers||{})){
    if(SKIP_SLOTS.includes(name)){ slots.skip.push(name); continue; }
    const env=val.env||{};
    if(env.ANTHROPIC_BASE_URL){ slots.http.push(name); }
    else if(CLI_COMMANDS.some(c=>(val.command||'').includes(c))){ slots.cli.push(name); }
    else if(val.command==='node'&&(val.args||[]).some(a=>/\.(mjs|cjs|js)$/.test(a))){ slots.mcp.push(name); }
    else{ slots.skip.push(name); }
  }
}
```

Update the final `console.log(...)` to include `slots`:

```js
console.log(JSON.stringify({totalRounds,lastUpdate,providers,claudeModel,claudeAuth,slots}));
```

Also update the "Parse" sentence immediately after the bash block to include `slots` (cli/http/mcp/skip arrays) in the list of parsed fields.

**4. Step 2 banner — dynamic count string**

Replace the hardcoded `Querying 4 CLI agents + 6 HTTP providers...` line with a dynamically computed string. The Step 2 section should read:

```
## Step 2: Display banner

From INIT_INFO.slots, compute a count description and print the banner:

```bash
node -e "
const s=JSON.parse(process.argv[1]);
const cli=s.cli.length, http=s.http.length, mcp=s.mcp.length;
const parts=[];
if(cli>0) parts.push(cli+' CLI agent'+(cli>1?'s':''));
if(http>0) parts.push(http+' HTTP provider'+(http>1?'s':''));
if(mcp>0) parts.push(mcp+' local MCP slot'+(mcp>1?'s':''));
const countStr=parts.join(' + ')||'no quorum slots';
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' nForma ► MCP STATUS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('Querying '+countStr+'...');
" '${JSON.stringify(INIT_INFO.slots)}'
```
```

**5. Step 3 sub-agent prompt — fully dynamic tool list**

Replace the entire Step 3 Task() call with a dynamically-built prompt. The section must read:

```
## Step 3: Collect identity + health_check results via sub-agent

Build the slot list from INIT_INFO.slots (all non-skip slots across cli, http, and mcp arrays):

```
const allSlots = [...INIT_INFO.slots.cli, ...INIT_INFO.slots.http, ...INIT_INFO.slots.mcp];
```

Invoke a Task() sub-agent with the following dynamically-constructed prompt (substitute allSlots at runtime):

```
Task(
  subagent_type: "general-purpose",
  model: "claude-haiku-4-5",
  prompt: `
You are a data-collection sub-agent. Your only job is to call the MCP tools listed below and return their results as a single JSON object. Do not explain or summarize — return only the JSON object.

The configured quorum slots are: ${JSON.stringify(allSlots)}

Call identity and health_check for each slot listed above. Use tool names in the format mcp__<slot>__identity and mcp__<slot>__health_check (keep hyphens — do not replace them with underscores).

Call each tool with {} as input. Wrap every call in try/catch — if a tool throws or is unavailable, record null for that field.

Call all tools one at a time, sequentially — never parallel.

Return ONLY this JSON structure (no markdown, no explanation):
{
  "<slot>": { "identity": <identity result or null>, "hc": <health_check result or null> },
  ...one entry per slot in the list above...
}

Where each identity value is the raw object returned by the tool (with at minimum version and model fields), and each hc value is the raw object returned by health_check (with healthy, latencyMs, and optionally model, via fields).
`
)
```

Store the sub-agent's returned JSON object as AGENT_RESULTS (parse from the sub-agent's text output). Keys are slot names as provided in allSlots.
```

**6. Step 4 health derivation — type-based branching**

Replace the "For CLI agents" / "For HTTP agents (claude-1 through claude-6)" sections with type-based logic:

```
## Step 4: Derive health state per agent

For each slot in AGENT_RESULTS, look up its type from INIT_INFO.slots to branch on health logic:

**For slots in INIT_INFO.slots.cli — identity + health_check based:**
- If identity call threw an exception → health = `error`, latency = `—`
- Else if `hc` is null (health_check threw or timed out) → health = `available`, latency = `—`
- Else if `!hc.healthy` → health = `unhealthy`, latency = `${hc.latencyMs}ms`
- Else → health = `available`, latency = `${hc.latencyMs}ms`

Model for CLI slots: use `identity.model` if present, else `identity.display_provider ?? identity.provider`.

**For slots in INIT_INFO.slots.http or INIT_INFO.slots.mcp — live health_check result:**
- If identity call threw an exception → health = `error`, latency = `—`
- Else if `hc` is null (health_check threw or timed out) → health = `unreachable`, latency = `—`
- Else if `hc.healthy === false` → health = `unhealthy`, latency = `${hc.latencyMs}ms`
- Else if `hc.via === 'fallback'` → health = `fallback`, latency = `${hc.latencyMs}ms`
- Else → health = `available`, latency = `${hc.latencyMs}ms`

When `hc.via === 'fallback'`, the displayed Model should be `hc.model` (the fallback model).
```

**7. Step 5 table — rows from all non-skip slots**

Update the description to:

```
Collect all results then render **one table** via a single Bash call. Rows come from all non-skip slots: iterate over [...INIT_INFO.slots.cli, ...INIT_INFO.slots.http, ...INIT_INFO.slots.mcp] in that order. Auth column: cli slots → `sub`, http/mcp slots → `api`.
```

The example table in the step can remain as-is (it is illustrative, not normative).

**8. `<success_criteria>`**

Replace:
```
- All 11 rows shown in one clean table (1 orchestrator + 4 CLI + 6 HTTP)
```
with:
```
- All non-skip configured slots shown in one clean table (1 orchestrator row + all cli/http/mcp slots discovered from ~/.claude.json)
```

All other existing success_criteria bullets remain unchanged.
  </action>
  <verify>
    grep -n "SKIP_SLOTS" commands/nf/mcp-status.md
    grep -n "slots.cli" commands/nf/mcp-status.md
    grep -n "allSlots" commands/nf/mcp-status.md
    grep -c "claude-1\.\." commands/nf/mcp-status.md  # should return 0 (no more hardcoded ranges)
    grep -n "ccr-1__identity" commands/nf/mcp-status.md
    grep -n "opencode-2__health_check" commands/nf/mcp-status.md
    grep -n "non-skip configured slots" commands/nf/mcp-status.md
  </verify>
  <done>
    - SKIP_SLOTS constant present in Step 1 Bash script
    - slots (cli/http/mcp/skip arrays) output by Step 1 and parsed into INIT_INFO
    - Step 2 banner computed dynamically from slot counts
    - Step 3 prompt uses allSlots interpolation with no hardcoded slot names
    - Step 4 branches on INIT_INFO.slots.cli / http / mcp type arrays
    - Step 5 iterates over non-skip slots; Auth uses sub/api per type
    - success_criteria mentions "non-skip configured slots" instead of "11 rows"
    - ccr-1..6 and opencode-2 tools present in allowed-tools frontmatter
  </done>
</task>

<task type="auto">
  <name>Task 2: Sync updated skill to ~/.claude via install.js</name>
  <files></files>
  <action>
Run the installer to sync the updated commands/nf/mcp-status.md to the global Claude installation:

```bash
node bin/install.js --claude --global
```

This copies command files from commands/ to ~/.claude/commands/ so the live /nf:mcp-status command picks up the changes immediately.
  </action>
  <verify>
    diff commands/nf/mcp-status.md ~/.claude/commands/nf/mcp-status.md
    grep -n "SKIP_SLOTS" ~/.claude/commands/nf/mcp-status.md
  </verify>
  <done>
    - `diff` returns no output (files are identical)
    - SKIP_SLOTS present in the installed file at ~/.claude/commands/nf/mcp-status.md
  </done>
</task>

</tasks>

<verification>
grep -n "SKIP_SLOTS" /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/commands/nf/mcp-status.md
grep -n "allSlots" /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/commands/nf/mcp-status.md
grep -n "slots\.cli\|slots\.http\|slots\.mcp" /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/commands/nf/mcp-status.md
grep -n "ccr-1__identity" /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/commands/nf/mcp-status.md
grep -n "opencode-2__health_check" /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/commands/nf/mcp-status.md
grep -n "non-skip configured slots" /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/commands/nf/mcp-status.md
# Confirm no hardcoded "4 CLI agents" or "6 HTTP providers" remain
grep -n "4 CLI agents\|6 HTTP providers" /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/commands/nf/mcp-status.md
</verification>

<success_criteria>
1. SKIP_SLOTS and CLI_COMMANDS arrays present in Step 1 Bash; slots object (cli/http/mcp/skip) emitted in JSON output
2. Step 2 banner dynamically computes count string from INIT_INFO.slots — no hardcoded "4 CLI agents + 6 HTTP providers"
3. Step 3 sub-agent prompt uses allSlots interpolation; no hardcoded slot names in the call list
4. Step 4 health logic branches on INIT_INFO.slots type arrays (cli / http / mcp), not slot name patterns
5. Step 5 iterates over all non-skip slots; Auth column uses sub for cli and api for http/mcp
6. success_criteria updated to "non-skip configured slots" (no fixed row count of 11)
7. Frontmatter allowed-tools includes ccr-1..6 identity+health_check and opencode-2 identity+health_check
8. Installed file at ~/.claude/commands/nf/mcp-status.md matches source (diff is empty)
</success_criteria>

<output>
After completion, create `.planning/quick/393-rewrite-nf-mcp-status-to-be-fully-dynami/393-SUMMARY.md` following the standard summary template.
</output>
