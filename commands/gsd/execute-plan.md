---
name: gsd:execute-plan
description: Execute a PLAN.md file
argument-hint: "[path-to-PLAN.md]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
  - AskUserQuestion
---

<objective>
Execute a single PLAN.md file by spawning a subagent.

Orchestrator stays lean: validate plan, spawn subagent, handle checkpoints, report completion. Subagent loads full execute-plan workflow and handles all execution details.

Context budget: ~15% orchestrator, 100% fresh for subagent.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/principles.md
@~/.claude/get-shit-done/templates/subagent-task-prompt.md
</execution_context>

<context>
Plan path: $ARGUMENTS

@.planning/STATE.md
@.planning/config.json (if exists)
</context>

<process>
1. **Validate plan exists**
   - Confirm file at $ARGUMENTS exists
   - Error if not found: "Plan not found: {path}"

2. **Check if already executed**
   - Derive SUMMARY path from plan path (replace PLAN.md with SUMMARY.md)
   - If SUMMARY exists: "Plan already executed. SUMMARY: {path}"
   - Offer: re-execute or exit

3. **Parse plan identifiers**
   Extract from path like `.planning/phases/03-auth/03-02-PLAN.md`:
   - phase_number: `03`
   - phase_name: `auth`
   - plan_number: `02`
   - plan_path: full path

4. **Pre-execution summary (interactive mode only)**
   Check config.json for mode. Skip this step if mode=yolo.

   Parse PLAN.md to extract:
   - objective: First sentence or line from `<objective>` element
   - task_count: Count of `<task` elements
   - files: Collect unique file paths from `<files>` elements within tasks

   Display friendly summary before spawning:
   ```
   ════════════════════════════════════════
   EXECUTING: {phase_number}-{plan_number} {phase_name}
   ════════════════════════════════════════

   Building: {objective one-liner}
   Tasks: {task_count}
   Files: {comma-separated file list}

   Full plan: {plan_path}
   ════════════════════════════════════════
   ```

   No confirmation needed. Proceed to spawn after displaying.

   In yolo mode, display abbreviated version:
   ```
   ⚡ Executing {phase_number}-{plan_number}: {objective one-liner}
   ```

5. **Fill and spawn subagent**
   - Fill subagent-task-prompt template with extracted values
   - Spawn: `Task(prompt=filled_template, subagent_type="general-purpose")`

6. **Handle subagent return**
   - If contains "## CHECKPOINT REACHED": Execute checkpoint_handling
   - If contains "## PLAN COMPLETE": Verify SUMMARY exists, report success

7. **Report completion and offer next steps**
   - Show SUMMARY path
   - Show commits from subagent return
   - Route to next action (see `<offer_next>`)
</process>

<offer_next>
**MANDATORY: Present copy/paste-ready next command.**

After plan completes, determine what's next:

**Step 1: Count plans vs summaries in current phase**
```bash
ls -1 .planning/phases/[phase-dir]/*-PLAN.md 2>/dev/null | wc -l
ls -1 .planning/phases/[phase-dir]/*-SUMMARY.md 2>/dev/null | wc -l
```

**Step 2: Route based on counts**

| Condition | Action |
|-----------|--------|
| summaries < plans | More plans remain → Route A |
| summaries = plans | Phase complete → Update requirements, then Step 3 |

**Step 2.5: Update requirements (only when phase complete)**

When summaries = plans, update REQUIREMENTS.md before presenting completion:

1. Get phase number from completed plan path
2. Read ROADMAP.md, find the phase's `Requirements:` line (e.g., "AUTH-01, AUTH-02")
3. Read REQUIREMENTS.md traceability table
4. For each REQ-ID in this phase: change Status from "Pending" to "Complete"
5. Write updated REQUIREMENTS.md
6. Stage for commit: `git add .planning/REQUIREMENTS.md`

**Skip if:** REQUIREMENTS.md doesn't exist, or phase has no Requirements line in ROADMAP.md.

---

**Route A: More plans remain in phase**

Find next PLAN.md without matching SUMMARY.md. Present:

```
Plan {phase}-{plan} complete.
Summary: .planning/phases/{phase-dir}/{phase}-{plan}-SUMMARY.md

{Y} of {X} plans complete for Phase {Z}.

---

## ▶ Next Up

**{phase}-{next-plan}: [Plan Name]** — [objective from PLAN.md]

`/gsd:execute-plan .planning/phases/{phase-dir}/{phase}-{next-plan}-PLAN.md`

<sub>`/clear` first → fresh context window</sub>

---
```

---

**Step 3: Check milestone status (only when phase complete)**

Read ROADMAP.md. Find current phase number and highest phase in milestone.

| Condition | Action |
|-----------|--------|
| current < highest | More phases → Route B |
| current = highest | Milestone complete → Route C |

---

**Route B: Phase complete, more phases remain**

```
## ✓ Phase {Z}: {Name} Complete

All {Y} plans finished.

---

## ▶ Next Up

**Phase {Z+1}: {Name}** — {Goal from ROADMAP.md}

`/gsd:plan-phase {Z+1}`

<sub>`/clear` first → fresh context window</sub>

---
```

---

**Route C: Milestone complete**

```
🎉 MILESTONE COMPLETE!

## ✓ Phase {Z}: {Name} Complete

All {N} phases finished.

---

## ▶ Next Up

`/gsd:complete-milestone`

<sub>`/clear` first → fresh context window</sub>

---
```
</offer_next>

<checkpoint_handling>
When subagent returns with checkpoint:

**1. Parse return:**
```
## CHECKPOINT REACHED

**Type:** [human-verify | decision | human-action]
**Plan:** {phase}-{plan}
**Progress:** {completed}/{total} tasks complete

### Completed Tasks
| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | [task name] | [hash] | [files] |

### Current Task
**Task {N}:** [name]
**Status:** [blocked | awaiting verification | awaiting decision]
**Blocked by:** [specific blocker]

### Checkpoint Details
[Type-specific content for user]

### Awaiting
[What user needs to provide]
```

**2. Present checkpoint to user:**

Display rich formatted checkpoint based on type:

**For human-verify:**
```
════════════════════════════════════════
CHECKPOINT: Verification Required
════════════════════════════════════════

Task {X} of {Y}: {task name}

I built: {what-built from checkpoint details}

How to verify:
{numbered verification steps}

Type "approved" to continue, or describe issues.
════════════════════════════════════════
```

**For human-action (auth gate):**
```
════════════════════════════════════════
CHECKPOINT: Authentication Required
════════════════════════════════════════

Task {X} of {Y}: {task name}

I tried: {automation attempted}
Error: {error encountered}

What you need to do:
{numbered instructions}

I'll verify after: {verification}

Type "done" when complete.
════════════════════════════════════════
```

**For decision:**
```
════════════════════════════════════════
CHECKPOINT: Decision Required
════════════════════════════════════════

Task {X} of {Y}: {task name}

Decision: {what's being decided}

Context: {why this matters}

Options:
1. {option-a}: {name}
   Pros: {benefits}
   Cons: {tradeoffs}

2. {option-b}: {name}
   Pros: {benefits}
   Cons: {tradeoffs}

Select: {option-a | option-b | ...}
════════════════════════════════════════
```

**3. Collect response:**
Wait for user input:
- human-verify: "approved" or description of issues
- decision: option selection
- human-action: "done" when complete

**4. Spawn fresh continuation agent:**

Fill continuation-prompt template with:
- completed_tasks_table: From checkpoint return
- resume_task_number: Current task number
- resume_task_name: Current task name
- resume_status: Derived from checkpoint type and user response
- user_response: What user provided
- resume_instructions: Type-specific guidance (see template)

```
Task(prompt=filled_continuation_template, subagent_type="general-purpose")
```

**Why fresh agent, not resume:**
Task tool resume fails after multiple tool calls (presenting to user, waiting for response). Fresh agent with state handoff via continuation-prompt.md is the correct pattern.

**5. Repeat:**
Continue handling returns until "## PLAN COMPLETE" or user stops.
</checkpoint_handling>

<checkpoint_templates>
Templates for checkpoint handling:

- `@~/.claude/get-shit-done/templates/checkpoint-return.md` - Subagent return format
- `@~/.claude/get-shit-done/templates/continuation-prompt.md` - Fresh agent spawn template
</checkpoint_templates>

<success_criteria>
- [ ] Plan executed (SUMMARY.md created)
- [ ] All checkpoints handled
- [ ] If phase complete: REQUIREMENTS.md updated (phase requirements marked Complete)
- [ ] User informed of completion and next steps
</success_criteria>
