---
name: gsd:define-requirements
description: Define what "done" looks like with checkable requirements
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
---

<objective>
Define concrete, checkable requirements from research findings.

Research answers "what do products like this have?"
Requirements answers "what are WE building?"

Transforms research features into scoped v1/v2 requirements that roadmap phases map to.

Run after `/gsd:research-project`, before `/gsd:create-roadmap`.

Output: `.planning/REQUIREMENTS.md`
</objective>

<execution_context>
@~/.claude/get-shit-done/references/principles.md
@~/.claude/get-shit-done/workflows/define-requirements.md
@~/.claude/get-shit-done/templates/requirements.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/research/FEATURES.md (required)
@.planning/research/SUMMARY.md
</context>

<process>

<step name="validate">
```bash
# Verify project exists
[ -f .planning/PROJECT.md ] || { echo "ERROR: No PROJECT.md found. Run /gsd:new-project first."; exit 1; }

# Verify research exists
[ -f .planning/research/FEATURES.md ] || { echo "ERROR: No research found. Run /gsd:research-project first."; exit 1; }

# Check if requirements already exist
[ -f .planning/REQUIREMENTS.md ] && echo "REQUIREMENTS_EXISTS" || echo "NO_REQUIREMENTS"
```
</step>

<step name="check_existing">
**If REQUIREMENTS_EXISTS:**

Use AskUserQuestion:
- header: "Requirements exist"
- question: "Requirements already defined. What would you like to do?"
- options:
  - "View existing" — Show current requirements
  - "Replace" — Define requirements fresh (will overwrite)
  - "Cancel" — Keep existing requirements

If "View existing": Read and display `.planning/REQUIREMENTS.md`, then exit
If "Cancel": Exit
If "Replace": Continue with workflow
</step>

<step name="execute">
Follow the define-requirements.md workflow:
- Load research features
- Present features by category
- Ask user to scope each category (v1 / v2 / out of scope)
- Capture any additions research missed
- Generate REQUIREMENTS.md with checkable list
</step>

<step name="done">
```
Requirements defined:

- Requirements: .planning/REQUIREMENTS.md
- v1 scope: [N] requirements across [M] categories
- v2 scope: [X] requirements deferred
- Out of scope: [Y] requirements excluded

---

## ▶ Next Up

**Create roadmap** — phases mapped to requirements

`/gsd:create-roadmap`

<sub>`/clear` first → fresh context window</sub>

---
```
</step>

</process>

<success_criteria>
- [ ] PROJECT.md validated
- [ ] Research FEATURES.md loaded
- [ ] Features presented by category
- [ ] User scoped each category (v1/v2/out of scope)
- [ ] User had opportunity to add missing requirements
- [ ] REQUIREMENTS.md created with checkable list
- [ ] Requirements committed to git
- [ ] User knows next step (create-roadmap)
</success_criteria>
