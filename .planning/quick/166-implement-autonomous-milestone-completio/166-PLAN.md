---
phase: 166-implement-autonomous-milestone-completio
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/auto-complete-milestone.md
  - qgsd-core/workflows/auto-complete-milestone.md
autonomous: true
formal_artifacts: none
requirements:
  - QUICK-166

must_haves:
  truths:
    - "Running /qgsd:auto-complete-milestone invokes audit-milestone as first step"
    - "If audit returns gaps_found, the workflow auto-spawns plan-milestone-gaps then execute-phase for each gap phase, then re-audits"
    - "If audit returns passed, the workflow auto-spawns complete-milestone"
    - "A max iteration limit of 3 prevents infinite loops"
    - "After iteration 2, a user confirmation gate requires approval to continue"
    - "The command is installable via bin/install.js and appears as /qgsd:auto-complete-milestone"
  artifacts:
    - path: "commands/qgsd/auto-complete-milestone.md"
      provides: "Slash command entry point with YAML frontmatter"
      contains: "qgsd:auto-complete-milestone"
    - path: "qgsd-core/workflows/auto-complete-milestone.md"
      provides: "Orchestration workflow with loop logic, safety limits, and routing"
      contains: "max_iterations"
  key_links:
    - from: "commands/qgsd/auto-complete-milestone.md"
      to: "qgsd-core/workflows/auto-complete-milestone.md"
      via: "execution_context reference"
      pattern: "workflows/auto-complete-milestone\\.md"
    - from: "qgsd-core/workflows/auto-complete-milestone.md"
      to: "~/.claude/qgsd/workflows/audit-milestone.md"
      via: "Task spawn referencing audit-milestone workflow"
      pattern: "audit-milestone"
    - from: "qgsd-core/workflows/auto-complete-milestone.md"
      to: "~/.claude/qgsd/workflows/plan-milestone-gaps.md"
      via: "Task spawn referencing plan-milestone-gaps workflow"
      pattern: "plan-milestone-gaps"
    - from: "qgsd-core/workflows/auto-complete-milestone.md"
      to: "~/.claude/qgsd/workflows/complete-milestone.md"
      via: "Task spawn referencing complete-milestone workflow"
      pattern: "complete-milestone"
---

<objective>
Create `/qgsd:auto-complete-milestone` — an autonomous orchestrator that loops audit-milestone, plan-milestone-gaps, execute-phase cycles until the audit passes, then auto-completes the milestone.

Purpose: Eliminate the manual multi-command dance of audit -> plan gaps -> execute -> re-audit -> complete. One command drives the milestone to completion autonomously with safety limits.
Output: Command file + workflow file, installable via bin/install.js.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Existing workflow patterns to follow:
- commands/qgsd/audit-milestone.md — command frontmatter pattern (name, description, argument-hint, allowed-tools)
- commands/qgsd/execute-phase.md — command that references a workflow via @~/.claude/qgsd/workflows/
- qgsd-core/workflows/audit-milestone.md — workflow structure (<purpose>, <process>, <success_criteria>)
- qgsd-core/workflows/plan-milestone-gaps.md — Task spawning pattern for sub-workflows
- qgsd-core/workflows/complete-milestone.md — milestone completion workflow

Key architectural decisions:
- The command file (commands/qgsd/) has YAML frontmatter + references the workflow via execution_context
- The workflow file (qgsd-core/workflows/) has the full orchestration logic
- Sub-workflows are invoked via Task() spawns referencing the workflow .md files
- The installer (bin/install.js) copies commands/ to ~/.claude/commands/ and qgsd-core/workflows/ to ~/.claude/qgsd/workflows/
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create auto-complete-milestone command and workflow files</name>
  <files>
    commands/qgsd/auto-complete-milestone.md
    qgsd-core/workflows/auto-complete-milestone.md
  </files>
  <action>
Create TWO files following established QGSD patterns:

**File 1: `commands/qgsd/auto-complete-milestone.md`**

YAML frontmatter matching audit-milestone.md pattern:
- name: qgsd:auto-complete-milestone
- description: Autonomously loop audit/plan-gaps/execute until milestone passes, then complete it
- argument-hint: "[version]"
- allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion

Objective section: Explain this is an autonomous orchestrator that drives a milestone to completion by iterating audit -> gap closure -> re-audit cycles.

execution_context: Reference `@~/.claude/qgsd/workflows/auto-complete-milestone.md`

context section: Version from $ARGUMENTS, Glob patterns for audit files and phase summaries.

process section: "Execute the auto-complete-milestone workflow end-to-end."

**File 2: `qgsd-core/workflows/auto-complete-milestone.md`**

Structure with `<purpose>`, `<process>`, `<success_criteria>` sections.

Purpose: Orchestrate audit-milestone -> plan-milestone-gaps -> execute-phase cycles in a loop until audit passes, with safety limits.

Process steps:

**Step 0 — Initialize:** Parse version from arguments or detect from ROADMAP.md. Set MAX_ITERATIONS=3, current_iteration=0.

**Step 1 — Run audit-milestone:** Spawn Task:
```
Task(
  prompt="Run /qgsd:audit-milestone {version}
  Follow @~/.claude/qgsd/workflows/audit-milestone.md end-to-end.
  Return ONLY the structured result: status (passed/gaps_found/tech_debt), score (N/M), and audit file path.
  Do NOT present offer_next routing — the caller handles routing.",
  subagent_type="general-purpose",
  description="Auto-complete: audit milestone {version} (iteration {N})"
)
```

**Step 2 — Route on audit status:**

- **If `passed`:** Jump to Step 5 (complete milestone).
- **If `tech_debt`:** Present tech debt summary. Ask user: "Accept debt and complete? (yes/no)". If yes, jump to Step 5. If no, treat as gaps_found.
- **If `gaps_found`:** Increment current_iteration. Check safety limits (Step 3). If safe, proceed to Step 4.

**Step 3 — Safety limits:**

- If current_iteration > MAX_ITERATIONS (3): HALT. Display iteration count, remaining gaps, and instruct user to investigate manually. Do NOT continue looping.
- If current_iteration == 2: Insert user confirmation gate via AskUserQuestion: "Iteration 2 complete, gaps remain. Continue to iteration 3? (yes/abort)". If abort, halt with current state summary.

**Step 4 — Close gaps and re-audit:**

4a. Spawn plan-milestone-gaps:
```
Task(
  prompt="Run /qgsd:plan-milestone-gaps
  Audit file: .planning/v{version}-v{version}-MILESTONE-AUDIT.md
  Milestone: {version}
  Follow @~/.claude/qgsd/workflows/plan-milestone-gaps.md end-to-end.
  After phases are created and planned, return the list of gap closure phase numbers.",
  subagent_type="general-purpose",
  description="Auto-complete: plan milestone gaps (iteration {N})"
)
```

4b. For each gap closure phase returned, spawn execute-phase:
```
Task(
  prompt="Run /qgsd:execute-phase {phase_number}
  Follow @~/.claude/qgsd/workflows/execute-phase.md end-to-end.",
  subagent_type="qgsd-executor",
  description="Auto-complete: execute gap phase {phase_number} (iteration {N})"
)
```

4c. After all gap phases execute, loop back to Step 1 (re-audit).

**Step 5 — Complete milestone:**
```
Task(
  prompt="Run /qgsd:complete-milestone {version}
  Follow @~/.claude/qgsd/workflows/complete-milestone.md end-to-end.",
  subagent_type="general-purpose",
  description="Auto-complete: complete milestone {version}"
)
```

**Step 6 — Present result:**
Display final status: milestone version, iterations taken, audit score, completion status.

Success criteria section:
- [ ] Audit-milestone invoked as first step
- [ ] Gaps trigger plan-milestone-gaps then execute-phase for each gap phase
- [ ] Re-audit after gap closure
- [ ] Passed status triggers complete-milestone
- [ ] Max 3 iterations enforced (hard halt)
- [ ] User confirmation gate after iteration 2
- [ ] tech_debt status gives user choice to accept or treat as gaps
- [ ] Final status summary presented
  </action>
  <verify>
Verify both files exist and have correct structure:
- `head -10 commands/qgsd/auto-complete-milestone.md` shows YAML frontmatter with name field
- `grep -c "Task(" qgsd-core/workflows/auto-complete-milestone.md` returns at least 3 (audit, plan-gaps, execute, complete)
- `grep "MAX_ITERATIONS\|max_iterations\|max iterations" qgsd-core/workflows/auto-complete-milestone.md` finds safety limit
- `grep "AskUserQuestion\|user confirmation\|iteration 2" qgsd-core/workflows/auto-complete-milestone.md` finds user gate
- `grep "audit-milestone" qgsd-core/workflows/auto-complete-milestone.md` finds audit reference
- `grep "complete-milestone" qgsd-core/workflows/auto-complete-milestone.md` finds completion reference
  </verify>
  <done>
Both files exist with correct structure. Command has YAML frontmatter referencing workflow. Workflow has loop logic with 3 sub-workflow Task spawns (audit, plan-gaps+execute, complete), MAX_ITERATIONS=3 safety limit, user gate after iteration 2, and routing by audit status (passed/gaps_found/tech_debt).
  </done>
</task>

<task type="auto">
  <name>Task 2: Install command and workflow, verify end-to-end availability</name>
  <files>
    commands/qgsd/auto-complete-milestone.md
    qgsd-core/workflows/auto-complete-milestone.md
  </files>
  <action>
Run the installer to copy the new command and workflow to their installed locations:

```bash
node bin/install.js --claude --global
```

After install, verify both files are in place:
1. Check `~/.claude/commands/qgsd/auto-complete-milestone.md` exists and matches source
2. Check `~/.claude/qgsd/workflows/auto-complete-milestone.md` exists and matches source

If install fails or files are missing, debug the installer output and ensure the files are in the correct source directories (commands/qgsd/ and qgsd-core/workflows/).

As a fallback, manually copy:
```bash
cp commands/qgsd/auto-complete-milestone.md ~/.claude/commands/qgsd/auto-complete-milestone.md
cp qgsd-core/workflows/auto-complete-milestone.md ~/.claude/qgsd/workflows/auto-complete-milestone.md
```
  </action>
  <verify>
- `test -f ~/.claude/commands/qgsd/auto-complete-milestone.md && echo "command installed"` prints "command installed"
- `test -f ~/.claude/qgsd/workflows/auto-complete-milestone.md && echo "workflow installed"` prints "workflow installed"
- `diff commands/qgsd/auto-complete-milestone.md ~/.claude/commands/qgsd/auto-complete-milestone.md` shows no differences (or the installed version matches)
  </verify>
  <done>
The /qgsd:auto-complete-milestone command is installed and available. Both the command entry point (~/.claude/commands/qgsd/) and the workflow logic (~/.claude/qgsd/workflows/) are in place and match the source files in the repo.
  </done>
</task>

</tasks>

<verification>
1. Command file has valid YAML frontmatter with name, description, argument-hint, allowed-tools
2. Workflow file has <purpose>, <process>, <success_criteria> sections
3. Workflow references all 4 sub-workflows: audit-milestone, plan-milestone-gaps, execute-phase, complete-milestone
4. Safety limits: MAX_ITERATIONS=3, user gate after iteration 2
5. Routing: passed -> complete, gaps_found -> loop, tech_debt -> user choice
6. Both files installed and accessible as /qgsd:auto-complete-milestone
</verification>

<success_criteria>
- /qgsd:auto-complete-milestone command exists and is installed
- Workflow orchestrates audit -> plan-gaps -> execute -> re-audit loop
- Max 3 iterations with hard halt prevents infinite loops
- User confirmation gate after iteration 2 prevents runaway automation
- Passed audit triggers complete-milestone automatically
- tech_debt gives user choice to accept or continue fixing
</success_criteria>

<output>
After completion, create `.planning/quick/166-implement-autonomous-milestone-completio/166-SUMMARY.md`
</output>
