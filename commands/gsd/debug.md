---
name: gsd:debug
description: Systematic debugging with persistent state across context resets
argument-hint: [issue description]
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Debug issues using scientific method with subagent isolation for investigation.

**Orchestrator role:** Gather symptoms interactively, spawn investigation subagent, handle checkpoints, spawn continuation agents as needed.

**Why subagent:** Investigation burns context fast (reading files, forming hypotheses, testing). Fresh 200k context per investigation attempt. Main context stays lean for user interaction.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/debug.md
@~/.claude/get-shit-done/templates/DEBUG.md
@~/.claude/get-shit-done/templates/debug-subagent-prompt.md
</execution_context>

<context>
User's issue: $ARGUMENTS

Check for active debug sessions:
```bash
ls .planning/debug/*.md 2>/dev/null | grep -v resolved | head -5
```
</context>

<process>

## 1. Check Active Sessions

If active sessions exist AND no $ARGUMENTS:
- List sessions with status, hypothesis, next action
- User picks number to resume OR describes new issue

If $ARGUMENTS provided OR user describes new issue:
- Continue to symptom gathering

## 2. Gather Symptoms (Main Context)

Use AskUserQuestion for each:

1. **Expected behavior** - What should happen?
2. **Actual behavior** - What happens instead?
3. **Error messages** - Any errors? (paste or describe)
4. **Timeline** - When did this start? Ever worked?
5. **Reproduction** - How do you trigger it?

After each answer, note it. After all gathered, confirm ready to investigate.

## 3. Create Debug File

```bash
mkdir -p .planning/debug
```

Create `.planning/debug/{slug}.md` with:
- status: investigating
- trigger: user's original description
- Symptoms section filled from gathering
- Empty Evidence, Eliminated, Resolution sections

## 4. Spawn Investigation Subagent

Fill debug-subagent-prompt template with:
- `{slug}`: Generated slug
- `{trigger}`: Original issue description
- `{expected}`: From symptom gathering
- `{actual}`: From symptom gathering
- `{errors}`: From symptom gathering
- `{reproduction}`: From symptom gathering
- `{timeline}`: From symptom gathering

```
Task(
  prompt=filled_debug_subagent_prompt,
  subagent_type="general-purpose",
  description="Debug {slug}"
)
```

## 5. Handle Subagent Return

**If `## ROOT CAUSE FOUND`:**
- Display root cause and evidence summary
- Offer options:
  - "Fix now" → spawn fix subagent
  - "Plan fix" → suggest /gsd:plan-fix
  - "Manual fix" → done

**If `## CHECKPOINT REACHED`:**
- Present checkpoint details to user
- Get user response
- Spawn continuation agent (see step 6)

**If `## INVESTIGATION INCONCLUSIVE`:**
- Show what was checked and eliminated
- Offer options:
  - "Continue investigating" → spawn new agent with additional context
  - "Manual investigation" → done
  - "Add more context" → gather more symptoms, spawn again

## 6. Spawn Continuation Agent (After Checkpoint)

When user responds to checkpoint, spawn fresh agent:

```markdown
<objective>
Continue debugging {slug}.

**DO NOT REDO** previous investigation. Evidence is in the debug file.
</objective>

<prior_state>
Debug file: @.planning/debug/{slug}.md

Read this file - it contains all evidence gathered so far.
</prior_state>

<checkpoint_response>
**Checkpoint was:** {checkpoint_type}
**User response:** {user_response}

{interpretation based on checkpoint type}
</checkpoint_response>

<execution_context>
@~/.claude/get-shit-done/workflows/debug.md
@~/.claude/get-shit-done/templates/DEBUG.md
</execution_context>

<instructions>
1. Read the debug file to understand current state
2. Incorporate user's checkpoint response
3. Continue investigation from Current Focus
4. Update debug file continuously
5. Return with ROOT CAUSE FOUND, CHECKPOINT REACHED, or INVESTIGATION INCONCLUSIVE
</instructions>
```

## 7. Fix (Optional)

If user chooses "Fix now" after root cause found:

```markdown
<objective>
Fix the root cause identified in {slug} debug session.
</objective>

<context>
Debug file: @.planning/debug/{slug}.md
Root cause: {root_cause}
Files involved: {files}
</context>

<instructions>
1. Implement minimal fix addressing root cause
2. Verify fix against original symptoms
3. Update debug file Resolution section
4. Commit with message referencing debug session
5. Archive to .planning/debug/resolved/
</instructions>
```

</process>

<checkpoint_types>
Subagent may return checkpoints for:

**human-verify:** "Can you confirm you see X when you do Y?"
- Present verification request
- User responds with confirmation or what they see instead

**human-action:** "I need you to run this command / check this thing"
- Present action request
- User responds "done" or with results

**decision:** "Should I investigate path A or path B?"
- Present options with context
- User picks direction
</checkpoint_types>

<success_criteria>
- [ ] Symptoms gathered interactively in main context
- [ ] Investigation runs in subagent (fresh context)
- [ ] Debug file tracks all state across agent boundaries
- [ ] Checkpoints handled via continuation agents
- [ ] Root cause confirmed with evidence before fixing
- [ ] Fix verified and session archived
</success_criteria>
