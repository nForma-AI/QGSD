---
phase: quick-76
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/mcp-status.md
  - ~/.claude/commands/qgsd/mcp-status.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Steps 1, 2, and 3 Bash commands each have an explicit 'run this first, then the next' instruction ensuring sequential execution"
    - "No parallel Bash batching occurs — each step's command completes before the next step starts"
    - "The workflow logic and all Bash command bodies are otherwise unchanged"
    - "Installed copy at ~/.claude/commands/qgsd/mcp-status.md is in sync with the repo source after the install script runs"
  artifacts:
    - path: "commands/qgsd/mcp-status.md"
      provides: "mcp-status workflow with sequential step ordering"
      contains: "run this Bash command"
    - path: "~/.claude/commands/qgsd/mcp-status.md"
      provides: "Installed copy in sync with source — contains the same sequencing language"
      contains: "run this Bash command"
  key_links:
    - from: "commands/qgsd/mcp-status.md Step 1"
      to: "commands/qgsd/mcp-status.md Step 2"
      via: "sequential instruction — Step 2 must not start until Step 1 output is stored"
      pattern: "FIRST.*then.*Step 2"
    - from: "commands/qgsd/mcp-status.md (source)"
      to: "~/.claude/commands/qgsd/mcp-status.md (installed)"
      via: "node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global"
      pattern: "install sync"
---

<objective>
Prevent "Sibling tool call errored" failures in /qgsd:mcp-status by making Steps 1, 2, and 3 explicitly sequential.

Purpose: When Claude executes mcp-status, it reads Steps 1-3 and may issue all three Bash commands as a parallel batch. If the first call fails (e.g. zsh `!` expansion error), the other two report "Sibling tool call errored". Adding explicit sequencing instructions forces each step to complete before the next begins.

Output: Updated commands/qgsd/mcp-status.md with sequential-execution language at the top of Steps 1, 2, and 3.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add sequential execution guards to Steps 1, 2, and 3 in mcp-status.md</name>
  <files>commands/qgsd/mcp-status.md</files>
  <action>
Edit commands/qgsd/mcp-status.md to prepend a one-sentence sequencing instruction at the start of each of Steps 1, 2, and 3. The instructions must make clear that each Bash call must complete and its output stored before moving to the next step.

Specific edits:

**Step 1 header** — change:
```
## Step 1: Read UNAVAIL counts from scoreboard
```
to:
```
## Step 1: Read UNAVAIL counts from scoreboard (run this Bash command first, wait for output before proceeding to Step 2)
```

**Step 2 header** — change:
```
## Step 2: Load HTTP provider info from providers.json
```
to:
```
## Step 2: Load HTTP provider info from providers.json (run this Bash command second, after Step 1 output is stored; wait for output before proceeding to Step 3)
```

**Step 3 header** — change:
```
## Step 3: Probe HTTP endpoints
```
to:
```
## Step 3: Probe HTTP endpoints (run this Bash command third, after Step 2 output is stored; wait for output before proceeding to Step 4)
```

Do NOT modify any Bash command bodies, any other step headers, or any other content in the file.
  </action>
  <verify>
Run: grep -n "run this Bash command" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md

Expected: 3 matching lines — one each for Step 1, Step 2, Step 3.
  </verify>
  <done>
Three step headers in mcp-status.md contain explicit sequencing language. No other content in the file is changed. grep confirms exactly 3 matches.
  </done>
</task>

<task type="auto">
  <name>Task 2: Sync installed copy via install script</name>
  <files>~/.claude/commands/qgsd/mcp-status.md</files>
  <action>
Run the install script to push the updated source file to the installed location:

```bash
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

This copies `commands/qgsd/mcp-status.md` (and all other source files) to the installed location at `~/.claude/commands/qgsd/mcp-status.md`. The `--claude` flag targets the Claude Code installation, `--global` installs system-wide.

After the install completes, verify the installed copy contains the sequencing language:

```bash
grep -n "run this Bash command" ~/.claude/commands/qgsd/mcp-status.md | wc -l
```

Expected: exactly 3.
  </action>
  <verify>
`grep -n "run this Bash command" ~/.claude/commands/qgsd/mcp-status.md | wc -l` returns 3.
  </verify>
  <done>Installed copy at ~/.claude/commands/qgsd/mcp-status.md contains exactly 3 lines with the sequencing language, confirming source and install are in sync.</done>
</task>

</tasks>

<verification>
1. grep -n "run this Bash command" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md | wc -l
   # Must return 3 — one each for Step 1, Step 2, Step 3 headers
2. grep -n "run this Bash command" ~/.claude/commands/qgsd/mcp-status.md | wc -l
   # Must also return 3 — installed copy is in sync with source
</verification>

<success_criteria>
- commands/qgsd/mcp-status.md has sequential-execution language on Steps 1, 2, 3 headers
- No Bash command body content is modified
- Installed copy at ~/.claude/commands/qgsd/mcp-status.md reflects the same sequencing language (install script ran)
- Running /qgsd:mcp-status will no longer issue Steps 1-3 as a parallel batch
</success_criteria>

<output>
After completion, create .planning/quick/76-isolate-each-bash-call-in-mcp-status-to-/76-SUMMARY.md
</output>
