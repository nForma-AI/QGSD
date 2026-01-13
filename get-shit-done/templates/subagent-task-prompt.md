# Subagent Task Prompt Template

Template for spawning plan execution agents. Used by execute-phase (parallel) and execute-plan (single) orchestrators.

---

## Template

```markdown
<objective>
Execute plan {plan_number} of phase {phase_number}-{phase_name}.

Commit each task atomically. Create SUMMARY.md. Update STATE.md.

**Checkpoint handling:** If you hit a checkpoint task, STOP and return a checkpoint message (see checkpoint_behavior below). The orchestrator will present it to the user and resume you with their response.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
@~/.claude/get-shit-done/references/checkpoints.md
@~/.claude/get-shit-done/references/tdd.md
</execution_context>

<context>
Plan: @{plan_path}
Project state: @.planning/STATE.md
Config: @.planning/config.json (if exists)
</context>

<checkpoint_behavior>
When you encounter a checkpoint task (type="checkpoint:*"), STOP execution and return this format:

## CHECKPOINT REACHED

**Type:** [human-verify | decision | human-action]
**Plan:** {phase}-{plan}
**Progress:** {completed}/{total} tasks complete

[Checkpoint content from checkpoint_protocol in execute-plan.md]

**Awaiting:** [Resume signal from the task]

The orchestrator will present this to the user and resume you with their response.
When resumed, you'll receive: "User response: {their_input}"
Parse and continue appropriately.
</checkpoint_behavior>

<completion_format>
When plan completes successfully, return:

## PLAN COMPLETE

**Plan:** {phase}-{plan}
**Tasks:** {completed}/{total}
**SUMMARY:** {path to SUMMARY.md}

**Commits:**
- {hash}: {message}
...
</completion_format>

<success_criteria>
- [ ] All tasks executed (or paused at checkpoint)
- [ ] Each task committed individually
- [ ] SUMMARY.md created in plan directory
- [ ] STATE.md updated with position and decisions
</success_criteria>
```

---

## Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{phase_number}` | Phase directory name | `01` |
| `{phase_name}` | Phase directory name | `foundation` |
| `{plan_number}` | Plan filename | `01` |
| `{plan_path}` | Full path to PLAN.md | `.planning/phases/01-foundation/01-01-PLAN.md` |

---

## Usage

Orchestrator fills placeholders and passes to Task tool:

```python
Task(
    prompt=filled_template,
    subagent_type="general-purpose"
)
```

Agent reads @-references, loads full workflow context, executes plan.

When agent returns:
- If contains "## CHECKPOINT REACHED": Parse and present to user, then resume
- If contains "## PLAN COMPLETE": Finalize execution
