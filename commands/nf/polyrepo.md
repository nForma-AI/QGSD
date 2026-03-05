---
name: qgsd:polyrepo
description: Manage polyrepo groups — register repos that form one product for cross-repo QGSD awareness
argument-hint: create | add <group> <path> [role] | remove <group> <path> | list [group] | info
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Manage named polyrepo groups — collections of repositories that together form one product. Supports creating groups, adding/removing repos, listing groups, and checking current repo membership.

Global config: ~/.claude/polyrepos/<name>.json
Per-repo marker: .planning/polyrepo.json
</objective>

<execution_context>
Self-contained — no external workflow file needed.
</execution_context>

<process>
Parse $ARGUMENTS for subcommand:

**If no arguments or `create`:**
Interactive flow using AskUserQuestion:
1. Ask for group name (lowercase, alphanumeric + hyphens)
2. Run `node bin/polyrepo.cjs create <name>` to create an empty group (calls `createGroup(name, [])`)
3. Ask for repos to include (one at a time: path, role, planning yes/no)
4. For each repo, run `node bin/polyrepo.cjs add <name> <path> <role> [--no-planning]` (calls `addRepo` per repo)
5. Ask "Add another repo?" until user says no
6. Display summary of created group

**If `add <group> <path> [role]`:**
Run `node bin/polyrepo.cjs add <group> <path> <role> [--no-planning]`
If role not provided, ask via AskUserQuestion.

**If `remove <group> <path>`:**
Run `node bin/polyrepo.cjs remove <group> <path>`
Confirm action.

**If `list [group]`:**
Run `node bin/polyrepo.cjs list [group]`
Display formatted output.

**If `info`:**
Run `node bin/polyrepo.cjs info`
Display current repo's group membership.
</process>
