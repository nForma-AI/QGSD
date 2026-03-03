---
name: qgsd:map-requirements
description: Map current and archived milestone requirements into .formal/requirements.json
argument-hint: [--dry-run] [--skip-archive] [--skip-validate]
allowed-tools:
  - Read
  - Bash
---
<objective>
Run the requirements mapping pipeline — merges current `.planning/REQUIREMENTS.md` with archived milestone requirements into `.formal/requirements.json`. Shows a summary of requirement counts by source.
</objective>

<execution_context>
@~/.claude/qgsd/workflows/map-requirements.md
</execution_context>

<process>
Execute the map-requirements workflow from @~/.claude/qgsd/workflows/map-requirements.md end-to-end.
Pass through --dry-run and --skip-archive flags from arguments.
</process>
