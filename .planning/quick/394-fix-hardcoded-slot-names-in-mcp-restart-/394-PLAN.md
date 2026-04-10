---
phase: quick-394
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/mcp-restart.md
  - commands/nf/mcp-set-model.md
autonomous: true
requirements:
  - QT-394
must_haves:
  truths:
    - "allowed-tools frontmatter lists ccr-1..6, opencode-2, codex-1, gemini-1 identity tools"
    - "allowed-tools no longer lists codex-cli-1 or gemini-cli-1 identity tools"
    - "allowed-tools no longer lists claude-2..6 identity tools"
    - "slot validation in Step 1 and Step 2 reads dynamically from ~/.claude.json mcpServers"
    - "SKIP_SLOTS=['canopy','sentry'] excluded from valid agent list"
    - "node bin/install.js --claude --global run after changes"
  artifacts:
    - path: "commands/nf/mcp-restart.md"
      provides: "Dynamic slot validation from ~/.claude.json"
      contains: "ccr-1.*identity|dynamic.*mcpServers"
    - path: "commands/nf/mcp-set-model.md"
      provides: "Dynamic slot validation from ~/.claude.json"
      contains: "ccr-1.*identity|dynamic.*mcpServers"
---

<objective>
Fix hardcoded slot names in mcp-restart.md and mcp-set-model.md.

Current state:
- allowed-tools lists old names: codex-cli-1, gemini-cli-1, claude-1..6 (missing ccr-1..6, opencode-2)
- Steps 1+2 validate against hardcoded list: codex-cli-1, gemini-cli-1, opencode-1, copilot-1, claude-1..6

Target state:
- allowed-tools lists current names from ~/.claude.json: codex-1, gemini-1, opencode-1, opencode-2, copilot-1, claude-1, ccr-1..6
- Steps 1+2 validate dynamically by reading ~/.claude.json mcpServers (minus SKIP_SLOTS)
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/nf/mcp-restart.md
@commands/nf/mcp-set-model.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update allowed-tools and dynamic validation in mcp-restart.md</name>
  <files>commands/nf/mcp-restart.md</files>
  <action>
    1. Replace the entire `allowed-tools` block in the frontmatter (lines 5-16) with:
    ```yaml
    allowed-tools:
      - Bash
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
    ```

    2. Replace the usage message in Step 1 (the hardcoded agent list after "Valid agents:") with a note that valid agents are read from ~/.claude.json:
    ```
    Usage: /nf:mcp-restart <agent>

    Valid agents: run /nf:mcp-restart without arguments to see current list from ~/.claude.json
    ```

    3. Replace the entire Step 2 "Validate agent name" section with a dynamic validation block:
    ```markdown
    ## Step 2 — Validate agent name

    Run this Bash command to get valid slots from `~/.claude.json`:

    ```bash
    node << 'NF_EVAL'
    const fs=require('fs'),os=require('os'),path=require('path');
    const SKIP=['canopy','sentry'];
    try {
      const cfg=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.claude.json'),'utf8'));
      const slots=Object.keys(cfg.mcpServers||{}).filter(s=>!SKIP.includes(s));
      console.log(JSON.stringify(slots));
    } catch(e) {
      console.log('[]');
    }
    NF_EVAL
    ```

    Parse the output as `$VALID_SLOTS` (JSON array of strings).

    If `$AGENT` is not in `$VALID_SLOTS`, print an error and stop:
    ```
    Error: Unknown agent "$AGENT"

    Valid agents: <$VALID_SLOTS joined with spaces>
    ```
    ```
  </action>
  <verify>
    grep -n "ccr-1" commands/nf/mcp-restart.md
    # Must show ccr-1 in allowed-tools and in validation step
    grep -n "codex-cli-1\|gemini-cli-1" commands/nf/mcp-restart.md
    # Must return no matches
    grep -n "claude-2\|claude-3\|claude-4\|claude-5\|claude-6" commands/nf/mcp-restart.md
    # Must return no matches
    grep -n "VALID_SLOTS\|mcpServers" commands/nf/mcp-restart.md
    # Must show the dynamic validation block
  </verify>
  <done>mcp-restart.md has updated allowed-tools with ccr-1..6/opencode-2 and dynamic slot validation from ~/.claude.json.</done>
</task>

<task type="auto">
  <name>Task 2: Update allowed-tools and dynamic validation in mcp-set-model.md</name>
  <files>commands/nf/mcp-set-model.md</files>
  <action>
    Apply the same changes as Task 1 but to mcp-set-model.md:

    1. Replace the entire `allowed-tools` block in the frontmatter (lines 5-16) with the same new block (codex-1, gemini-1, opencode-1, opencode-2, copilot-1, claude-1, ccr-1..6).

    2. Replace the usage message in Step 1 with the dynamic reference.

    3. Replace the entire Step 2 "Validate agent name" section with the same dynamic validation block (reads ~/.claude.json, SKIP=['canopy','sentry'], checks $AGENT against $VALID_SLOTS).

    Note: The identity tool call in Step 3 of mcp-set-model.md uses `mcp__<$AGENT>__identity` dynamically — no changes needed there.
  </action>
  <verify>
    grep -n "ccr-1" commands/nf/mcp-set-model.md
    # Must show ccr-1 in allowed-tools
    grep -n "codex-cli-1\|gemini-cli-1" commands/nf/mcp-set-model.md
    # Must return no matches
    grep -n "VALID_SLOTS\|mcpServers" commands/nf/mcp-set-model.md
    # Must show dynamic validation block
  </verify>
  <done>mcp-set-model.md has updated allowed-tools with ccr-1..6/opencode-2 and dynamic slot validation from ~/.claude.json.</done>
</task>

<task type="auto">
  <name>Task 3: Sync and reinstall</name>
  <files></files>
  <action>
    Run: node bin/install.js --claude --global
    This syncs the updated command files to ~/.claude/commands/nf/.
  </action>
  <verify>
    grep -n "ccr-1" ~/.claude/commands/nf/mcp-restart.md
    # Must show ccr-1 in installed copy
  </verify>
  <done>Commands installed to ~/.claude/commands/nf/.</done>
</task>

</tasks>

<verification>
```bash
# 1. ccr-1 present in allowed-tools
grep -n "ccr-1__identity" commands/nf/mcp-restart.md commands/nf/mcp-set-model.md
# Expected: matches in both files

# 2. Old slot names gone
grep -n "codex-cli-1\|gemini-cli-1\|claude-2__identity\|claude-3__identity" commands/nf/mcp-restart.md commands/nf/mcp-set-model.md
# Expected: no matches

# 3. Dynamic validation present
grep -n "VALID_SLOTS\|mcpServers" commands/nf/mcp-restart.md commands/nf/mcp-set-model.md
# Expected: matches in both files

# 4. opencode-2 in allowed-tools
grep -n "opencode-2" commands/nf/mcp-restart.md commands/nf/mcp-set-model.md
# Expected: matches in both files
```
</verification>

<success_criteria>
1. `grep "ccr-1__identity" commands/nf/mcp-restart.md` returns a match
2. `grep "ccr-1__identity" commands/nf/mcp-set-model.md` returns a match
3. `grep "codex-cli-1" commands/nf/mcp-restart.md` returns no matches
4. `grep "codex-cli-1" commands/nf/mcp-set-model.md` returns no matches
5. `grep "VALID_SLOTS" commands/nf/mcp-restart.md` returns a match
6. `grep "VALID_SLOTS" commands/nf/mcp-set-model.md` returns a match
7. `grep "opencode-2" commands/nf/mcp-restart.md` returns a match
8. `grep "opencode-2" commands/nf/mcp-set-model.md` returns a match
</success_criteria>

<output>
After completion, create `.planning/quick/394-fix-hardcoded-slot-names-in-mcp-restart-/394-SUMMARY.md` following the summary template.
</output>
