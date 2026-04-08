---
phase: quick-385
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/mcp-repair.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "Step 1 reads ~/.claude.json mcpServers to discover slot names dynamically before issuing any MCP tool calls"
    - "Step 1 replaces the hardcoded 30-call enumeration with a loop-driven instruction over discovered slot names"
    - "The allowed-tools frontmatter is replaced with a note block explaining that the executor must use the slot names discovered from ~/.claude.json"
    - "$BEFORE_STATE is assembled from the discovered slots, not from a hardcoded 10-slot JSON template"
    - "Step 4 and Step 6 slot-specific deep_health_check / identity calls already use <slot> placeholders and remain unchanged"
    - "No hardcoded slot names (codex-1, gemini-1, opencode-1, copilot-1, claude-1..6) remain in Step 1's call list"
  artifacts:
    - path: "commands/nf/mcp-repair.md"
      provides: "Dynamic slot discovery replacing hardcoded 30-tool call list"
      contains: "~/.claude.json"
  key_links:
    - from: "Step 1 slot discovery block"
      to: "mcp__<slot>__identity / health_check / deep_health_check"
      via: "discovered slot names from ~/.claude.json mcpServers keys"
      pattern: "mcpServers"
---

<objective>
Update nf:mcp-repair to discover slot names dynamically from ~/.claude.json mcpServers, replacing the hardcoded 30-tool call enumeration in Step 1 and the hardcoded allowed-tools frontmatter list.

Purpose: The current skill hardcodes 10 specific slot names (codex-1, gemini-1, opencode-1, copilot-1, claude-1..6) in both the YAML allowed-tools frontmatter and in the Step 1 call list. Users with different slot configurations (e.g., more or fewer claude-* slots, renamed slots) get broken behavior silently. The fix reads slot names from ~/.claude.json mcpServers at runtime and drives the diagnostic loop from that discovered list.

Output: commands/nf/mcp-repair.md with dynamic slot discovery in Step 1 and an updated allowed-tools section that explains the dynamic pattern.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/nf/mcp-repair.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace hardcoded slot enumeration in Step 1 with dynamic ~/.claude.json discovery</name>
  <files>commands/nf/mcp-repair.md</files>
  <action>
There are two hardcoded-slot locations to update in mcp-repair.md. Do NOT change any other logic — bash scripts, classification tables, display tables, step numbering, service restart logic (Step 2b/4), Step 4 pkill block, Step 5 guidance, Step 6, or Step 7 are all unchanged.

**Change 1 — allowed-tools frontmatter (lines 4-36)**

Replace the entire `allowed-tools:` block (which lists 30 specific MCP tool names) with a comment block that explains the dynamic pattern:

```yaml
allowed-tools:
  - Bash
  - Read
  # MCP tool access: this skill calls mcp__<slot>__identity, mcp__<slot>__health_check,
  # and mcp__<slot>__deep_health_check for each slot discovered from ~/.claude.json mcpServers.
  # MCP tools become available at session startup based on what is configured in ~/.claude.json —
  # slots present there are accessible without being explicitly listed here.
  # Note: listing specific mcp__*__ tool names here is not required; the session's registered
  # tool set is determined by session startup, not by this frontmatter. The comment above is
  # documentation only.
  # The executor must NOT attempt to call tools for slots not present in ~/.claude.json.
```

**Change 2 — Step 1 call enumeration (lines ~62–130)**

Keep the Bash block that reads `bin/providers.json` for `$SLOT_COUNT` and the banner display unchanged. Note: after this change, the banner's `$SLOT_COUNT` should reflect the number of discovered slots from `$SLOT_NAMES` (i.e., `${#SLOT_NAMES[@]}` or equivalent), not the providers.json count. Update the banner line if it currently prints the providers.json count directly.

After the banner display, replace the hardcoded "Call in this order: 1. mcp__codex-1__identity..." enumeration block (the numbered 1-30 list and the hardcoded $BEFORE_STATE JSON template) with:

```
First, discover the configured slot names from `~/.claude.json`:

```bash
SLOT_NAMES=$(node << 'NF_EVAL'
var fs = require("fs"), path = require("path"), os = require("os");
try {
  var cj = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8"));
  var slots = Object.keys(cj.mcpServers || {}).filter(function(k) { return k !== "unified-1"; });
  console.log(JSON.stringify(slots));
} catch (e) {
  process.stderr.write("Warning: could not read ~/.claude.json: " + e.message + "\n");
  console.log(JSON.stringify([]));
}
NF_EVAL
)
```

`$SLOT_NAMES` is now a JSON array string. Example: `["codex-1","gemini-1","opencode-1","copilot-1","claude-1","claude-2","claude-3","claude-4","claude-5","claude-6"]`

The banner `$SLOT_COUNT` should reflect the number of slots in `$SLOT_NAMES` (parse the array length), not the providers.json count.

For each slot name in `$SLOT_NAMES`, call the following MCP tools directly in the orchestrator, one at a time, sequentially. If a tool is unavailable or throws, record null for that slot/field. Note: MCP servers that are not health-check servers (e.g., filesystem-1, brave-1, gmail) may not expose `identity` or `health_check` tools — treat null or "tool not found" results for these as "unresponsive" rather than errors.

For each slot `<slot>` in $SLOT_NAMES:
- Call `mcp__<slot>__identity({})` → record as identity result (null if tool unavailable)
- Call `mcp__<slot>__health_check({})` → record as hc result (null if tool unavailable)
- Call `mcp__<slot>__deep_health_check({})` → record as deep result (null if tool unavailable)

Repeat this pattern for every slot in `$SLOT_NAMES` before moving to the next step.

Assemble `$BEFORE_STATE` as a JSON object keyed by slot name:
{
  "<slot-name>": { "identity": <result or null>, "hc": <result or null>, "deep": <result or null> },
  ...one entry per slot in $SLOT_NAMES...
}

Store this as `$BEFORE_STATE`.
```

**Change 3 — success_criteria block (at end of file)**

Before making the replacement, verify the old line is present:
`grep -n "All configured slots from bin/providers.json are diagnosed" commands/nf/mcp-repair.md`
This must return a match. If it does not match, check the exact wording and update accordingly.

Replace the line:
```
- All configured slots from bin/providers.json are diagnosed (not a hardcoded count)
```
With:
```
- All configured slots from ~/.claude.json mcpServers are diagnosed (not a hardcoded list)
- Slot names are discovered dynamically at runtime from ~/.claude.json mcpServers keys
```

After replacement, verify:
`grep -n "bin/providers.json are diagnosed" commands/nf/mcp-repair.md` — must return 0 results.
`grep -n "mcpServers are diagnosed" commands/nf/mcp-repair.md` — must return a match.
  </action>
  <verify>
1. `grep -n "mcp__codex-1__identity" commands/nf/mcp-repair.md` — returns 0 results in the Step 1 numbered call list (the hardcoded enumeration is gone). The only remaining references to specific slot names should be in examples or comments.
2. `grep -n "mcpServers" commands/nf/mcp-repair.md` — returns at least 2 results (one in the new Step 1 discovery block, one in the existing Step 4 pkill block).
3. `grep -n "allowed-tools:" commands/nf/mcp-repair.md` — frontmatter still has `allowed-tools:` section.
4. `grep -c "mcp__claude-[1-6]__identity" commands/nf/mcp-repair.md` — returns 0 (hardcoded claude-1..6 identity calls in the numbered list are removed).
5. The file still contains "Step 1", "Step 2", "Step 3", "Step 4", "Step 5", "Step 6", "Step 7" headings.
6. `grep -n "SLOT_NAMES" commands/nf/mcp-repair.md` — returns at least 1 result (new discovery variable present).
7. `grep -n "SLOT_NAMES=\$(node" commands/nf/mcp-repair.md` — returns a match (shell capture syntax present).
8. `grep -n "try {" commands/nf/mcp-repair.md` — returns a match (error handling in Node.js snippet present).
9. `grep -n "bin/providers.json are diagnosed" commands/nf/mcp-repair.md` — returns 0 results (old success_criteria line removed).
10. `grep -n "mcpServers are diagnosed" commands/nf/mcp-repair.md` — returns a match (new success_criteria line present).
  </verify>
  <done>
commands/nf/mcp-repair.md Step 1 no longer contains a hardcoded numbered list of 30 MCP tool calls. Instead it contains a shell-captured Bash block (`SLOT_NAMES=$(node ...)`) that reads ~/.claude.json mcpServers with try/catch error handling, and a loop-pattern instruction that calls identity/health_check/deep_health_check for each discovered slot. Non-health-check MCP servers with no identity/health_check tools are treated as unresponsive rather than errors. The allowed-tools frontmatter is updated to explain the dynamic pattern with a note that MCP access is determined at session startup. $BEFORE_STATE is assembled from the discovered slot list. $SLOT_COUNT in the banner reflects the discovered slot count. The success_criteria block references ~/.claude.json instead of bin/providers.json.
  </done>
</task>

</tasks>

<verification>
After the task completes:
- `grep -c "mcp__codex-1__identity\|mcp__gemini-1__identity\|mcp__claude-1__identity" commands/nf/mcp-repair.md` — should return 0 (no hardcoded numbered call list)
- `grep "SLOT_NAMES" commands/nf/mcp-repair.md` — should return a match showing the discovery variable
- `grep "SLOT_NAMES=\$(node" commands/nf/mcp-repair.md` — should return a match (shell capture syntax)
- `grep "try {" commands/nf/mcp-repair.md` — should return a match (Node.js error handling)
- `grep "mcpServers" commands/nf/mcp-repair.md` — should return at least 2 matches
- `grep -A2 "allowed-tools:" commands/nf/mcp-repair.md` — should show Bash and Read only (no mcp__*__ entries)
- `grep "bin/providers.json are diagnosed" commands/nf/mcp-repair.md` — should return 0 matches (old line removed)
- `grep "mcpServers are diagnosed" commands/nf/mcp-repair.md` — should return a match
- Step 1 still reads bin/providers.json for initial $SLOT_COUNT and shows the banner; banner count updated to use discovered slot count
- Steps 2-7 structure is unchanged
</verification>

<success_criteria>
- commands/nf/mcp-repair.md Step 1 discovers slot names from ~/.claude.json mcpServers at runtime
- No hardcoded slot name enumeration (codex-1, gemini-1, claude-1..6) in Step 1's call list
- allowed-tools frontmatter replaced with a comment block explaining the dynamic pattern and noting that session MCP access is determined at startup, not by listing tools here
- $BEFORE_STATE assembled from discovered $SLOT_NAMES, not hardcoded JSON template
- $SLOT_COUNT in the banner reflects the count of discovered slots from $SLOT_NAMES
- Non-health-check MCP servers (e.g., filesystem-1, brave-1, gmail) that lack identity/health_check tools are treated as unresponsive, not errors
- All other steps (classification, display, auto-repair, guidance, verification, summary) unchanged
- Skill works correctly for any slot configuration in ~/.claude.json (not just the original 10 slots)
</success_criteria>

<output>
After completion, create `.planning/quick/385-make-nf-mcp-repair-discover-slot-names-d/385-SUMMARY.md` with:
- What changed (locations modified, approach)
- Verification results
- Commit hash
</output>
