---
phase: 381-checklist-registry
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/references/checklist-registry.json
  - core/references/deprecation-checklist.md
  - bin/checklist-match.cjs
  - bin/checklist-match.test.cjs
  - core/workflows/verify-phase.md
  - docs/agent-skills.md
  - agents/skills/deprecation-and-migration/SKILL.md
  - commands/nf/deprecation-and-migration.md
autonomous: true
requirements: [QUICK-381]

must_haves:
  truths:
    - "checklist-match.cjs returns correct checklist IDs when given file paths that match trigger patterns"
    - "checklist-match.cjs returns correct checklist IDs when given description keywords"
    - "verify-phase.md uses checklist-match.cjs instead of hardcoded if/then conditions"
    - "deprecation-and-migration skill is removed and its guidance exists as deprecation-checklist.md"
  artifacts:
    - path: "core/references/checklist-registry.json"
      provides: "Registry of all conditional checklists with trigger patterns"
      contains: "checklist-registry/v1"
    - path: "bin/checklist-match.cjs"
      provides: "CLI script to resolve matching checklists from file patterns and keywords"
      min_lines: 40
    - path: "bin/checklist-match.test.cjs"
      provides: "Tests for checklist matching logic"
      min_lines: 30
    - path: "core/references/deprecation-checklist.md"
      provides: "Deprecation and migration checklist extracted from skill"
      contains: "Deprecation"
  key_links:
    - from: "core/workflows/verify-phase.md"
      to: "bin/checklist-match.cjs"
      via: "node invocation in quality_checklist_scan step"
      pattern: "checklist-match"
    - from: "bin/checklist-match.cjs"
      to: "core/references/checklist-registry.json"
      via: "require or readFileSync"
      pattern: "checklist-registry"
  consumers:
    - artifact: "bin/checklist-match.cjs"
      consumed_by: "core/workflows/verify-phase.md"
      integration: "node invocation replacing hardcoded quality_checklist_scan"
      verify_pattern: "checklist-match"
    - artifact: "core/references/checklist-registry.json"
      consumed_by: "bin/checklist-match.cjs"
      integration: "JSON.parse/require in matching script"
      verify_pattern: "checklist-registry"
---

<objective>
Create a checklist registry system that replaces hardcoded if/then checklist routing in verify-phase.md with a data-driven JSON registry and matching script.

Purpose: Enable dynamic checklist resolution based on file patterns and keywords, making it trivial to add new checklists without editing workflow code. Convert deprecation-and-migration from a standalone skill to a conditional checklist, reducing skill count from 5 to 4.

Output: checklist-registry.json, checklist-match.cjs with tests, updated verify-phase.md, deprecation-checklist.md, removal of deprecation skill and command.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@core/workflows/verify-phase.md
@core/references/testing-patterns.md
@core/references/security-checklist.md
@core/references/performance-checklist.md
@core/references/accessibility-checklist.md
@core/references/api-design-checklist.md
@agents/skills/deprecation-and-migration/SKILL.md
@docs/agent-skills.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create checklist registry, matching script with tests, and deprecation checklist</name>
  <files>
    core/references/checklist-registry.json
    core/references/deprecation-checklist.md
    bin/checklist-match.cjs
    bin/checklist-match.test.cjs
  </files>
  <action>
**1a. Create `core/references/checklist-registry.json`:**

Schema version `checklist-registry/v1`. Contains a `checklists` array with 6 entries. Each entry has:
- `id`: string identifier
- `file`: filename within `core/references/` (installed to `~/.claude/nf/references/`)
- `triggers`: object with `file_patterns` (glob array), `keywords` (substring array), and optionally `task_types` (exact-match array)

Entries:
1. `testing-patterns` — file: `testing-patterns.md`, file_patterns: `["**/*.test.*", "**/*.spec.*", "test/**"]`, task_types: `["bug_fix"]`, keywords: `["test", "tdd", "coverage"]`
2. `security` — file: `security-checklist.md`, file_patterns: `["hooks/**", "**/auth*", "**/.env*", "**/secret*", "bin/install.js"]`, keywords: `["security", "auth", "secret", "token", "credential"]`
3. `performance` — file: `performance-checklist.md`, file_patterns: `["bin/**", "**/startup*", "**/install*"]`, keywords: `["performance", "optimize", "slow", "latency", "cache"]`
4. `accessibility` — file: `accessibility-checklist.md`, file_patterns: `["**/*.md", "**/cli*", "**/output*", "**/terminal*"]`, keywords: `["accessibility", "a11y", "screen reader", "keyboard"]`
5. `api-design` — file: `api-design-checklist.md`, file_patterns: `["**/api/**", "**/routes/**", "**/endpoints/**", "**/*schema*"]`, keywords: `["api", "endpoint", "interface", "contract", "schema", "rest", "graphql"]`
6. `deprecation` — file: `deprecation-checklist.md`, file_patterns: `[]`, keywords: `["deprecat", "migration", "sunset", "remove", "replace", "legacy"]`

**1b. Create `core/references/deprecation-checklist.md`:**

Extract the decision framework, high-level steps, migration patterns, and anti-patterns from `agents/skills/deprecation-and-migration/SKILL.md` into checklist format. Structure:

```
# Deprecation and Migration Checklist

Use this checklist when planning or executing deprecation, migration, or sunsetting of code, APIs, or features.

## Decision framework
- [ ] Does the system still provide unique value?
- [ ] How many consumers depend on it?
- [ ] Is a replacement available and validated?
- [ ] Migration cost per consumer assessed?
- [ ] Ongoing maintenance cost exceeds migration cost?

## Before deprecating
- [ ] Replacement built and covers all critical use cases
- [ ] Replacement validated in production
- [ ] Deprecation announcement drafted with specific timeline

## Migration
- [ ] Migration guide with concrete before/after examples
- [ ] One consumer migrated at a time
- [ ] Adapters or feature flags for gradual rollover
- [ ] Migration progress tracked visibly

## Removal
- [ ] Zero active usage verified before removal
- [ ] Code deleted entirely (no commented-out blocks)
- [ ] All references removed: docs, config, imports, tests
- [ ] Deprecation notice itself removed

## Anti-patterns to avoid
- [ ] Not deprecating without providing an alternative
- [ ] Not announcing without a migration guide
- [ ] Not adding features to deprecated systems
- [ ] Not keeping zombie code with no owner

## Attribution
Adapted for nForma from the MIT-licensed deprecation-and-migration skill in addyosmani/agent-skills.
```

**1c. Create `bin/checklist-match.cjs`:**

CommonJS script with `'use strict'`. Accepts CLI args:
- `--files "file1,file2,..."` — comma-separated changed file paths
- `--description "text"` — task description for keyword matching
- `--task-type "bug_fix|feature|refactor"` — optional task type

Logic:
1. Read registry from two possible locations (try installed first, fall back to repo):
   - `path.join(process.env.HOME, '.claude', 'nf', 'references', 'checklist-registry.json')`
   - `path.join(__dirname, '..', 'core', 'references', 'checklist-registry.json')`
2. For each checklist entry, check if ANY trigger matches:
   - `file_patterns`: Use `minimatch` for glob matching against each file in `--files`. Since minimatch is not a dependency, implement a simple glob matcher that handles `**` (any path), `*` (any segment), and literal matches. Alternatively, use Node's built-in `path.matchesGlob` (Node 22+) — but since we need broad compat, implement a lightweight matcher:
     - Convert glob to regex: `**` -> `.*`, `*` -> `[^/]*`, escape dots, anchor start/end
     - This is sufficient for the patterns used (no complex brace expansion needed)
   - `keywords`: Case-insensitive substring match against `--description`
   - `task_types`: Exact match against `--task-type` (if provided)
3. Output: JSON array of `{"id":"...", "file":"..."}` for all matching checklists
4. Exit 0 if matches found, exit 1 if no matches (empty array still prints `[]`)

Include `--help` flag support. Include a `if (require.main === module)` guard so the matching logic can also be `require()`'d by tests.

Export `matchChecklists({ files, description, taskType, registryPath })` function for testability.

**1d. Create `bin/checklist-match.test.cjs`:**

Test the exported `matchChecklists` function. Use the project's test runner pattern (Node test runner with `node --test`). Tests:
- File pattern matching: `hooks/nf-stop.js` triggers security, `test/foo.test.js` triggers testing-patterns
- Keyword matching: description "fix auth token bug" triggers security, "optimize cache" triggers performance
- Task type matching: `bug_fix` triggers testing-patterns
- No matches: unrelated file and description returns empty array
- Multiple matches: `bin/install.js` with description "security audit" triggers both security and performance
- Glob edge cases: `**/*.test.*` matches `src/deep/nested/file.test.js`
  </action>
  <verify>
Run `node --test bin/checklist-match.test.cjs` — all tests pass.
Run `node bin/checklist-match.cjs --files "hooks/nf-stop.js" --description "auth fix"` — outputs JSON with security checklist.
Run `node bin/checklist-match.cjs --help` — prints usage.
Verify `core/references/checklist-registry.json` is valid JSON: `node -e "require('./core/references/checklist-registry.json')"`.
Verify `core/references/deprecation-checklist.md` exists and contains checklist items.
  </verify>
  <done>
Registry JSON has 6 checklist entries with trigger patterns. Matching script resolves correct checklists from files, keywords, and task types. Deprecation checklist covers decision framework, migration steps, removal steps. All tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update verify-phase.md, remove deprecation skill, update docs</name>
  <files>
    core/workflows/verify-phase.md
    agents/skills/deprecation-and-migration/SKILL.md
    commands/nf/deprecation-and-migration.md
    docs/agent-skills.md
  </files>
  <action>
**2a. Update `core/workflows/verify-phase.md`:**

Replace the hardcoded `quality_checklist_scan` step (lines 242-253) with a registry-driven approach. The new step content:

```markdown
<step name="quality_checklist_scan">
**Quality Checklist Scan**

After verifying must_haves, scan modified files against relevant quality checklists using the checklist registry.

Collect the list of files modified in this phase (from SUMMARY.md or git diff) as `$CHANGED_FILES` (comma-separated).
Collect the phase description or goal as `$TASK_DESCRIPTION`.

```bash
MATCHES=$(node $HOME/.claude/nf-bin/checklist-match.cjs --files "$CHANGED_FILES" --description "$TASK_DESCRIPTION" 2>/dev/null)
```

If `$MATCHES` is a non-empty JSON array, for each matched checklist:
1. Read `$HOME/.claude/nf/references/{file}` (where `{file}` comes from the match result)
2. Evaluate the modified code against each checklist item
3. Report violations as Warning-level findings

If `checklist-match.cjs` is not found or returns exit 1 (no matches), skip this step silently (fail-open).

Report violations in VERIFICATION.md under a `## Quality Checklist Warnings` section. These do NOT block verification — they are informational.
</step>
```

IMPORTANT: Use `$HOME/.claude/nf-bin/checklist-match.cjs` with CWD fallback pattern per lint:isolation requirements. The actual workflow text should reference the installed path since this file runs from `~/.claude/nf/workflows/`.

**2b. Delete deprecated skill files:**

Delete:
- `agents/skills/deprecation-and-migration/SKILL.md`
- `agents/skills/deprecation-and-migration/` (the directory)
- `commands/nf/deprecation-and-migration.md`

Use `git rm` for tracked files. For untracked files (on this branch), use regular `rm`.

**2c. Update `docs/agent-skills.md`:**

1. In the "Current packaged skills" table (line 49-55): Remove the `deprecation-and-migration` row.
2. In the lifecycle routing section (line 38-45): Remove `deprecation-and-migration` references if present.
3. In "Current state" section (line 85): Change "5 remaining packaged skills" to "4 remaining packaged skills".
4. In "Coverage status" section (line 94): Update "5 have dedicated packaged skills" to "4 have dedicated packaged skills; 1 (deprecation-and-migration) was converted to a conditional checklist".
5. In "Lifecycle routing" paragraph (line 89-90): Remove "before sunset: deprecation planning" line.
6. In "Reference checklists" table (line 100-106): Add a row for `core/references/deprecation-checklist.md` — use with: deprecation planning, migration tasks, `/nf:verify-work`.
7. Add a brief note in the "Reference checklists" section about the checklist registry system: mention `core/references/checklist-registry.json` drives automatic checklist resolution in verify-phase.

Do NOT update CONTRIBUTING.md — it does not reference skills or checklists directly.
  </action>
  <verify>
Verify verify-phase.md contains `checklist-match` and does NOT contain the old hardcoded if/then conditions for each checklist (grep for "If test files were modified" should return 0 results).
Verify `agents/skills/deprecation-and-migration/` directory no longer exists.
Verify `commands/nf/deprecation-and-migration.md` no longer exists.
Verify `docs/agent-skills.md` mentions "4" packaged skills (not 5) and includes `deprecation-checklist.md` in the reference table.
Run `npm run lint:isolation` to verify path references pass.
  </verify>
  <done>
verify-phase.md uses registry-driven checklist resolution. Deprecation skill and command are deleted. docs/agent-skills.md reflects 4 skills and includes the new deprecation checklist and registry in the reference section.
  </done>
</task>

</tasks>

<verification>
- `node --test bin/checklist-match.test.cjs` passes all tests
- `node bin/checklist-match.cjs --files "hooks/nf-stop.js"` returns JSON with security entry
- `node bin/checklist-match.cjs --files "test/foo.test.js" --task-type "bug_fix"` returns JSON with testing-patterns entry
- `core/references/checklist-registry.json` is valid JSON with 6 entries
- `core/references/deprecation-checklist.md` exists with checklist items
- `core/workflows/verify-phase.md` references `checklist-match.cjs` (no hardcoded conditions)
- `agents/skills/deprecation-and-migration/` directory does not exist
- `commands/nf/deprecation-and-migration.md` does not exist
- `docs/agent-skills.md` says 4 packaged skills and lists deprecation-checklist.md
- `npm run lint:isolation` passes
</verification>

<success_criteria>
Checklist resolution is data-driven via JSON registry. Adding a new checklist requires only a new .md file and a registry entry — no workflow code changes. Deprecation guidance preserved as checklist. verify-phase.md dynamically resolves checklists. 4 standalone skills remain (idea-refine, task-intake, code-review-and-quality, shipping-and-launch).
</success_criteria>

<output>
After completion, create `.planning/quick/381-create-checklist-registry-json-with-trig/381-SUMMARY.md`
</output>
