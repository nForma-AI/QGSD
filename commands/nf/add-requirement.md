---
name: qgsd:add-requirement
description: Add a single requirement to .planning/formal/requirements.json with duplicate and conflict checks
argument-hint: [--id=PREFIX-NN] [--text="..."] [--category="..."] [--phase=vX.XX-NN] [--dry-run]
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Agent
  - AskUserQuestion
---
<objective>
Add a single requirement to the formal requirements envelope (`.planning/formal/requirements.json`). Validates the ID format, checks for duplicate IDs, runs Haiku semantic conflict detection against same-prefix requirements, and elevates conflicts to the user before writing. Handles envelope freeze/unfreeze lifecycle automatically.
</objective>

<execution_context>
@~/.claude/qgsd/workflows/add-requirement.md
</execution_context>

<process>
Execute the add-requirement workflow from @~/.claude/qgsd/workflows/add-requirement.md end-to-end.
Pass through all --flags from arguments. If required fields (id, text, category, phase) are not provided as arguments, prompt the user interactively.
</process>
