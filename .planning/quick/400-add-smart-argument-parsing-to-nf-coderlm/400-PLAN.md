---
phase: quick-400
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/coderlm.md
autonomous: true
requirements:
  - INTENT-01
formal_artifacts: none

must_haves:
  truths:
    - "User can invoke `/nf:coderlm myFunction` and get both implementation location and callers without specifying a subcommand"
    - "User can invoke `/nf:coderlm bin/foo.cjs` and get test files without specifying a subcommand"
    - "User can invoke `/nf:coderlm myFunc bin/foo.cjs` and get callers scoped to that file without specifying a subcommand"
    - "User can invoke `/nf:coderlm bin/foo.cjs 10 20` and get a source peek without specifying a subcommand"
    - "Explicit subcommands (start, stop, status, update, callers, implementation, tests, peek) continue to work unchanged"
    - "Ambiguous single arg (no slash, has a dot) defaults to implementation+callers with a noted assumption"
  artifacts:
    - path: "commands/nf/coderlm.md"
      provides: "Smart argument detection (Step 1.5) inserted between Step 1 and Step 2"
      contains: "Step 1.5"
  key_links:
    - from: "Step 1 (subcommand parse)"
      to: "Step 1.5 (intent detection)"
      via: "falls through when parsed subcommand is NOT in known-subcommand list"
      pattern: "Step 1\\.5"
    - from: "Step 1.5 (intent detection)"
      to: "Step 2 (execute subcommand)"
      via: "sets resolved subcommand + re-mapped args before Step 2 runs"
      pattern: "resolved subcommand"
---

<objective>
Add a Step 1.5 heuristic intent-detection block to commands/nf/coderlm.md. When the first argument is NOT a known explicit subcommand, detect the intended query operation from argument shape, remap arguments, and fall through into the existing Step 2 execution paths unchanged.

Purpose: Eliminate the need to remember subcommand names for the most common query operations — users can type the thing they care about directly.
Output: Updated commands/nf/coderlm.md with Step 1.5 inserted between Step 1 and Step 2.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/nf/coderlm.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Insert Step 1.5 smart argument detection into coderlm.md</name>
  <files>commands/nf/coderlm.md</files>
  <action>
Edit commands/nf/coderlm.md to insert a new **Step 1.5: Smart argument detection** block between the existing Step 1 and Step 2. Also update the `argument-hint` frontmatter field to reflect that bare arguments are now accepted.

**Frontmatter change:**
Update `argument-hint` from:
```
argument-hint: "<start|stop|status|update|callers|implementation|tests|peek>"
```
to:
```
argument-hint: "<subcommand | symbol | file | symbol file | file startLine endLine>"
```

**Step 1.5 block — insert immediately after Step 1 ends and before "**Step 2: Execute subcommand**":**

```
**Step 1.5: Smart argument detection**

This step only fires when the first argument is NOT one of the known explicit subcommands: `start`, `stop`, `status`, `update`, `callers`, `implementation`, `tests`, `peek`.

Use the following heuristics to infer intent from argument shape, then set a resolved subcommand and remapped argument list before proceeding to Step 2:

**Rule 1 — single arg, looks like a file** (`contains '/' OR (contains '.' AND ends with a known extension like .js, .cjs, .ts, .tsx, .md, .json)`):
- Resolved subcommand: `tests`
- Remapped args: `[arg1]`
- Example: `/nf:coderlm bin/coderlm-adapter.cjs` → `tests bin/coderlm-adapter.cjs`

**Rule 2 — two args, second looks like a file** (second arg contains `/` or matches file pattern above):
- Resolved subcommand: `callers`
- Remapped args: `[arg1, arg2]`
- Example: `/nf:coderlm myFunction bin/nf-solve.cjs` → `callers myFunction bin/nf-solve.cjs`

**Rule 3 — three args, first looks like a file, second and third are integers**:
- Validated: second and third args must parse as integers with second <= third
- Resolved subcommand: `peek`
- Remapped args: `[arg1, arg2, arg3]`
- Example: `/nf:coderlm bin/foo.cjs 10 20` → `peek bin/foo.cjs 10 20`
- If validation fails (non-integer or start > end), display a usage error and stop.

**Rule 4 — single arg, does NOT look like a file** (no `/`, and either no `.` or not a file-like extension):
- Resolved subcommand: `implementation` + `callers` (combined output)
- Remapped args: `[arg1]`
- Example: `/nf:coderlm autoClose` → run both `implementation autoClose` and `callers autoClose`, display both results in sequence
- Combined output format:
  ```
  Implementation of <symbol>:
    File: <result.file>
    Line: <result.line>

  Callers of <symbol>:
    - path/to/caller1.js
    (N callers found)
  ```

**Rule 5 — single arg, ambiguous** (no `/` but has a `.` without a recognized extension, or otherwise unclear):
- Default to Rule 4 (implementation + callers)
- Prepend a note: "Treating `<arg>` as a symbol name (assumption: not a file path). If you meant a file, use `/nf:coderlm tests <file>` directly."

**Rule 6 — no args or unmatched pattern**:
- Fall through to the existing "no argument / unrecognized" display in Step 1 (show usage help).

After applying a rule, proceed directly to Step 2 using the resolved subcommand and remapped args. The combined implementation+callers case (Rule 4) executes both query paths sequentially and displays both result blocks before Step 3.
```

Preserve all existing content in Step 1 and Step 2 verbatim. Do not alter any subcommand execution logic.
  </action>
  <verify>
Run the following checks:

1. Confirm Step 1.5 heading exists:
   `grep -n "Step 1.5" commands/nf/coderlm.md`
   Expected: at least one match showing the new heading.

2. Confirm Step 1.5 appears between Step 1 and Step 2:
   `grep -n "Step [123]" commands/nf/coderlm.md`
   Expected: Step 1 line number < Step 1.5 line number < Step 2 line number.

3. Confirm existing subcommands are unchanged:
   `grep -c "node bin/coderlm-lifecycle.cjs" commands/nf/coderlm.md`
   Expected: 5 (start, stop, status, update, and query guard — same as before edit).

4. Confirm updated argument-hint:
   `grep "argument-hint" commands/nf/coderlm.md`
   Expected: line contains "symbol" and "file".
  </verify>
  <done>
- `commands/nf/coderlm.md` contains a Step 1.5 block between Step 1 and Step 2
- All four detection rules (file→tests, symbol+file→callers, file+int+int→peek, symbol→implementation+callers) are documented with examples
- Explicit subcommand execution in Step 2 is unchanged (grep count matches)
- Frontmatter `argument-hint` reflects bare argument forms
  </done>
</task>

</tasks>

<verification>
After task completion:
- `grep -n "Step 1.5" commands/nf/coderlm.md` returns a match
- `grep -n "Step [123]" commands/nf/coderlm.md` shows correct ordering
- File parses as valid YAML frontmatter (no syntax errors introduced)
- The four detection rules and combined output format for Rule 4 are present
</verification>

<success_criteria>
A user running `/nf:coderlm autoClose` gets implementation location + callers without typing a subcommand. A user running `/nf:coderlm bin/foo.cjs` gets test files. A user running `/nf:coderlm autoClose bin/foo.cjs` gets scoped callers. A user running `/nf:coderlm bin/foo.cjs 10 20` gets a source peek. All explicit subcommands continue to work.
</success_criteria>

<output>
After completion, create `.planning/quick/400-add-smart-argument-parsing-to-nf-coderlm/400-SUMMARY.md`
</output>
