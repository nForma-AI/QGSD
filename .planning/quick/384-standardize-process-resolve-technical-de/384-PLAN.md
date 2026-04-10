---
phase: 384-standardize-process-resolve-technical-de
plan: 384
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/requirements.json
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: []
formal_artifacts: none

must_haves:
  truths:
    - "All identified technical debt items are recorded in requirements.json as traceable engineering tasks"
    - "REQUIREMENTS.md traceability table accurately reflects the current satisfaction status of all v0.41 requirements"
    - "Inconsistent serialization and logic patterns identified in the codebase are documented as required engineering tasks with requirement IDs"
  artifacts:
    - path: ".planning/formal/requirements.json"
      provides: "Machine-readable requirement entries for each tech debt item"
      contains: "DEBT-"
    - path: ".planning/REQUIREMENTS.md"
      provides: "Human-readable traceability table with accurate status for all v0.41 requirements"
  key_links:
    - from: ".planning/REQUIREMENTS.md"
      to: ".planning/formal/requirements.json"
      via: "requirement IDs shared between both files"
      pattern: "DEBT-0[0-9]"
---

<objective>
Standardize identified technical debt items as required engineering tasks, following the mandate in GitHub issue #77. This plan audits the codebase for tech debt markers and documentation gaps, converts findings into requirement entries in requirements.json, and updates the REQUIREMENTS.md traceability table.

Purpose: Prevent tech debt accumulation by making each item a trackable first-class requirement rather than an informal comment or stale TODO.
Output: New DEBT-* requirement entries in requirements.json; updated traceability in REQUIREMENTS.md.
</objective>

<execution_context>
@~/.claude/nf/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Audit tech debt markers and documentation gaps</name>
  <files>.planning/quick/384-standardize-process-resolve-technical-de/384-AUDIT.md</files>
  <action>
Conduct a structured audit to identify all tech debt items. Produce a markdown audit file at the path above.

**Audit scope — run each scan and collect findings:**

1. **Code comment markers** — scan bin/ and hooks/ for FIXME, HACK, and substantive TODO comments (exclude test files and boilerplate TODO stubs in emitter-tla.cjs/scaffold-config.cjs that are intentional scaffolding):
   ```bash
   grep -rn "FIXME\|HACK" bin/ hooks/ --include="*.cjs" --include="*.js" | grep -v "\.test\." | grep -v "scaffold-config\|emitter-tla" | head -40
   grep -rn "TODO" bin/ hooks/ --include="*.cjs" --include="*.js" | grep -v "\.test\." | grep -v "TODO-\|createTodo\|TODO item\|TODO stubs\|FIXME.*TODO\|Upgraded TODO\|TODO/FIXME\|TODO stubs\|observe.*TODO\|category.*TODO\|tag.*TODO\|FIXME.*TODO\|TODO.*create\|TODO.*FIXME" | grep -v "scaffold-config\|emitter-tla\|nForma.cjs.*TODO\|solve-tui.*TODO\|observe-handler-internal" | head -40
   ```

2. **REQUIREMENTS.md traceability gaps** — identify requirements marked as pending/incomplete where work may already be done or vice versa. Read REQUIREMENTS.md and cross-check against recent SUMMARY.md files in .planning/phases/.

3. **Logic inconsistency scan** — identify files where the same operation is done with noticeably different patterns. Focus on:
   - Serialization: compare how different bin/ scripts read/write JSON (some use readFileSync+JSON.parse, some have different error handling patterns)
   - Path resolution: compare `_nfBin` helper usage vs direct require('./bin/...') patterns in workflow files
   - Fail-open patterns: identify any hook or bin script missing try/catch on critical operations

4. **todos.json entries without requirement mapping** — read .planning/todos.json and identify any items that have a `reason` field describing engineering work not yet tracked in requirements.json.

**Audit output format** (write to 384-AUDIT.md):
```markdown
# Tech Debt Audit — Quick Task 384

## Code Comment Debt
| File:Line | Type | Description |
|-----------|------|-------------|
| ... | FIXME/HACK/TODO | ... |

## REQUIREMENTS.md Traceability Gaps
| Requirement | Current Status | Actual Status | Notes |
|-------------|---------------|---------------|-------|

## Logic Inconsistency Patterns
| Pattern | Files Affected | Description |
|---------|---------------|-------------|

## Unmapped todos.json Items
| TODO ID | Reason | Proposed Requirement |
|---------|--------|---------------------|
```

Limit to substantive items only — scaffolding placeholders in emitter-tla.cjs/scaffold-config.cjs are by-design and should be excluded.
  </action>
  <verify>
    ```bash
    ls /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-77-standardize-process-resolve/.planning/quick/384-standardize-process-resolve-technical-de/384-AUDIT.md
    ```
    File exists and contains non-empty sections for each audit category.
  </verify>
  <done>384-AUDIT.md exists with at least one finding per audit category (code debt, traceability gaps, logic patterns, unmapped TODOs).</done>
</task>

<task type="auto">
  <name>Task 2: Convert audit findings into required engineering tasks</name>
  <files>
    .planning/formal/requirements.json
    .planning/REQUIREMENTS.md
  </files>
  <action>
Using the findings from 384-AUDIT.md, create standardized DEBT-* requirement entries and update the traceability table.

**Step 1: Read the current requirements.json schema**

Write to /private/tmp/nf-384-read-reqs.cjs and run:
```javascript
const fs = require('fs');
const path = require('path');
const reqs = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.planning/formal/requirements.json'), 'utf8'));
// Find highest existing DEBT-XX or create first
const debtIds = Object.keys(reqs.requirements || {}).filter(k => k.startsWith('DEBT-'));
const maxNum = debtIds.reduce((max, id) => {
  const n = parseInt(id.replace('DEBT-', ''), 10);
  return isNaN(n) ? max : Math.max(max, n);
}, 0);
console.log(JSON.stringify({ schema_keys: Object.keys(reqs).slice(0, 5), total: Object.keys(reqs.requirements || {}).length, next_debt_num: maxNum + 1, existing_debt_ids: debtIds }));
```

**Step 2: Create DEBT-* entries for substantive findings**

For each substantive tech debt item found in 384-AUDIT.md, add a requirement entry to requirements.json following the existing schema. Each entry must have:
- `id`: DEBT-01, DEBT-02, ... (sequential, starting after any existing DEBT-* IDs)
- `title`: Short description of the engineering task required
- `description`: Full description of what needs to be done and why
- `category`: "tech_debt"
- `status`: "open"
- `source`: "audit-384" 
- `created_at`: current ISO timestamp
- `source_ref`: the file:line or location where the debt was identified

Focus on creating requirements for the following classes of findings from the audit:
- FIXME/HACK markers in production code (not test/scaffold files)
- Logic inconsistency patterns (serialization, path resolution) that span multiple files
- Unmapped todos.json items with meaningful `reason` fields
- Skip traceability gaps — those are addressed in Step 3

**Step 3: Update REQUIREMENTS.md traceability table**

Update the "Traceability" section at the bottom of REQUIREMENTS.md to:
1. Correct any satisfaction status mismatches found in the audit (e.g., mark complete items as complete)
2. Add a new "## Technical Debt Requirements" section listing each DEBT-* ID with its title and status

Do NOT change the existing v0.41 requirement definitions (DBUG-*, ROUTE-*, GATE-*, DEPR-*) — only update their status column in the traceability table if the audit found evidence they are complete.

**Invariant compliance:** This task only writes to .planning/formal/requirements.json and .planning/REQUIREMENTS.md. It does NOT modify any TLA+/Alloy/PRISM formal model files, so no formal_artifacts updates are needed.
  </action>
  <verify>
    Run the following and confirm output:
    ```bash
    node -e "
    const fs = require('fs');
    const reqs = JSON.parse(fs.readFileSync('.planning/formal/requirements.json', 'utf8'));
    const debtIds = Object.keys(reqs.requirements || {}).filter(k => k.startsWith('DEBT-'));
    console.log('DEBT requirements created:', debtIds.length);
    console.log('IDs:', debtIds.join(', '));
    "
    ```
    At least 1 DEBT-* entry exists in requirements.json. Also verify:
    ```bash
    grep -c "DEBT-" .planning/REQUIREMENTS.md
    ```
    Returns at least 1 (DEBT entries are present in REQUIREMENTS.md).
  </verify>
  <done>
    requirements.json contains at least 1 new DEBT-* entry with category "tech_debt" and status "open".
    REQUIREMENTS.md contains a "Technical Debt Requirements" section listing the DEBT-* IDs.
    No existing v0.41 requirement definitions were altered (only status column may be updated in the traceability table).
  </done>
</task>

<task type="auto">
  <name>Task 3: Commit artifacts and update STATE.md</name>
  <files>
    .planning/quick/384-standardize-process-resolve-technical-de/384-SUMMARY.md
    .planning/STATE.md
  </files>
  <action>
Write a SUMMARY.md for this quick task and commit all artifacts.

**Step 1: Write 384-SUMMARY.md**

Create .planning/quick/384-standardize-process-resolve-technical-de/384-SUMMARY.md with:
```markdown
# Summary: Quick Task 384 — Standardize Process: Resolve Technical Debt as Required Gaps

**Status:** Complete
**Date:** {today}

## What was done

Audited the codebase for technical debt (code markers, traceability gaps, logic inconsistencies, unmapped TODOs) and converted findings into standardized required engineering tasks tracked in requirements.json.

## Artifacts created

- 384-AUDIT.md — structured audit of all tech debt findings
- .planning/formal/requirements.json — {N} new DEBT-* requirement entries added
- .planning/REQUIREMENTS.md — traceability table updated with DEBT-* section

## Tech debt items standardized

{list each DEBT-* ID with one-line description}

## Key decisions

- Scaffolding FIXMEs in emitter-tla.cjs and scaffold-config.cjs excluded (intentional placeholders by design)
- No code was modified — only documentation and requirement tracking updated
- Traceability status corrections applied where audit found evidence of completion
```

**Step 2: Commit**

Stage and commit all changed files:
```bash
git add .planning/quick/384-standardize-process-resolve-technical-de/ .planning/formal/requirements.json .planning/REQUIREMENTS.md
node /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-77-standardize-process-resolve/core/bin/gsd-tools.cjs commit "docs(384): standardize tech debt as required engineering tasks" --files .planning/quick/384-standardize-process-resolve-technical-de/384-AUDIT.md .planning/quick/384-standardize-process-resolve-technical-de/384-SUMMARY.md .planning/formal/requirements.json .planning/REQUIREMENTS.md
```

**Step 3: Update STATE.md**

Add a row to the "Quick Tasks Completed" table in .planning/STATE.md:
```
| 384 | Standardize Process: Resolve Technical Debt as Required Gaps | 2026-04-09 | {commit_hash} | Verified | [384-standardize-process-resolve-technical-de](./quick/384-standardize-process-resolve-technical-de/) |
```

Also add to Session Log:
```
- 2026-04-09: Completed quick task 384 - Standardize tech debt items as required engineering tasks in requirements.json
```

Commit the STATE.md update:
```bash
node /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-77-standardize-process-resolve/core/bin/gsd-tools.cjs commit "docs(384): update STATE.md with task completion" --files .planning/STATE.md
```
  </action>
  <verify>
    ```bash
    ls .planning/quick/384-standardize-process-resolve-technical-de/384-SUMMARY.md
    git log --oneline -3
    ```
    SUMMARY.md exists and at least 2 commits are visible with "384" in their message.
  </verify>
  <done>
    384-SUMMARY.md exists.
    STATE.md row for task 384 is present.
    Git log contains commits for the requirements.json and STATE.md updates.
  </done>
</task>

</tasks>

<verification>
After all tasks complete:
1. `grep -c "DEBT-" .planning/formal/requirements.json` returns >= 1
2. `grep "Technical Debt" .planning/REQUIREMENTS.md` finds the new section
3. `.planning/quick/384-standardize-process-resolve-technical-de/384-AUDIT.md` exists with findings
4. `.planning/quick/384-standardize-process-resolve-technical-de/384-SUMMARY.md` exists
5. `grep "384" .planning/STATE.md` shows the completed task row
</verification>

<success_criteria>
- At least 1 DEBT-* requirement entry exists in requirements.json, each with id, title, description, category="tech_debt", status="open", source="audit-384"
- REQUIREMENTS.md contains a "Technical Debt Requirements" section
- 384-AUDIT.md documents the full audit with findings across all 4 categories
- No production code was modified (out of scope per scope-contract.json)
- All artifacts are committed to git on the feature/issue-77-standardize-process-resolve branch
</success_criteria>

<output>
After completion, the following artifacts exist:
- `.planning/quick/384-standardize-process-resolve-technical-de/384-AUDIT.md`
- `.planning/quick/384-standardize-process-resolve-technical-de/384-SUMMARY.md`
- `.planning/formal/requirements.json` (updated with DEBT-* entries)
- `.planning/REQUIREMENTS.md` (updated traceability table)
</output>
