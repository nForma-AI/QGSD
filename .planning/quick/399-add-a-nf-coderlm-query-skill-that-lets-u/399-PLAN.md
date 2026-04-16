---
phase: 399-coderlm-query-skill
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/coderlm.md
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "Running /nf:coderlm callers <symbol> <file> starts coderlm if not running and returns a formatted caller list"
    - "Running /nf:coderlm implementation <symbol> returns file + line number of the symbol definition"
    - "Running /nf:coderlm tests <file> returns associated test files for a source file"
    - "Running /nf:coderlm peek <file> <startLine> <endLine> returns source lines in a readable block"
    - "Usage help is displayed when no subcommand is given or when the subcommand is unrecognized"
    - "If coderlm is not running, the skill starts it via coderlm-lifecycle.cjs --start before querying, and reports start status"
    - "Adapter errors (timeout, ECONNREFUSED, disabled) are surfaced with diagnostic advice rather than silent failure"
  artifacts:
    - path: "commands/nf/coderlm.md"
      provides: "Extended coderlm skill with query subcommands (callers, implementation, tests, peek)"
      contains: "query"
  key_links:
    - from: "commands/nf/coderlm.md (query subcommands)"
      to: "bin/coderlm-adapter.cjs"
      via: "node bin/coderlm-adapter.cjs CLI dispatch or inline Bash node -e invocation"
      pattern: "coderlm-adapter"
    - from: "commands/nf/coderlm.md (ensure-running step)"
      to: "bin/coderlm-lifecycle.cjs"
      via: "node bin/coderlm-lifecycle.cjs --start"
      pattern: "coderlm-lifecycle"
---

<objective>
Extend `commands/nf/coderlm.md` with four new query subcommands: `callers`, `implementation`, `tests`, and `peek`. These let users interactively query the coderlm symbol server from within nForma without dropping to raw curl or writing Node one-liners.

Purpose: Make coderlm's query capabilities accessible via a first-class skill interface, consistent with the existing lifecycle subcommands (`start`, `stop`, `status`, `update`).
Output: Updated `commands/nf/coderlm.md` with a new `query` section covering four subcommands plus an ensure-running preamble.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@commands/nf/coderlm.md
@docs/coderlm-integration.md
@.planning/quick/399-add-a-nf-coderlm-query-skill-that-lets-u/scope-contract.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add query subcommands to coderlm.md</name>
  <files>commands/nf/coderlm.md</files>
  <action>
Read `commands/nf/coderlm.md` in full. Update the file by:

1. **Update frontmatter `argument-hint`** from `"<start|stop|status|update>"` to `"<start|stop|status|update|callers|implementation|tests|peek>"`.

2. **Update frontmatter `description`** to: "Manage the coderlm symbol server lifecycle and query its symbol index — callers, implementation location, associated tests, and source peek."

3. **In the Step 1 parse section**, add the four new subcommands to the valid subcommand list: `callers`, `implementation`, `tests`, `peek`.

4. **Update the usage help block** (the one displayed on unrecognized input) to add the new subcommands:

```
  /nf:coderlm callers <symbol> [file]           List all callers of a symbol
  /nf:coderlm implementation <symbol>           Show where a symbol is defined (file + line)
  /nf:coderlm tests <file>                      Show test files associated with a source file
  /nf:coderlm peek <file> <startLine> <endLine> Show source lines from a file
```

5. **Add a new "Query subcommands" section** in `<process>` after the existing **update:** block. The section heading is `**Query subcommands (callers, implementation, tests, peek):**`.

The section must contain:

**Preamble — ensure coderlm is running before any query:**

```
Before executing any query subcommand, ensure coderlm is running:

```bash
node bin/coderlm-lifecycle.cjs --start
```

Parse JSON output. If `ok: false` or the lifecycle start failed, report the error (include the `error` field from JSON output) and suggest running `/nf:coderlm status` for diagnostics. Do NOT proceed with the query if the server could not start.

If `ok: true` and `already_running: true`, skip the start message (server was already up).
If `ok: true` and `already_running: false`, note: "coderlm started (PID <pid>)".
```

**callers subcommand:**

```
**callers:**

Usage: `/nf:coderlm callers <symbol> [file]`

- `symbol` — required. The function or symbol name to look up.
- `file` — optional. Source file path to narrow the lookup (e.g., `bin/nf-solve.cjs`).

Run the following Node one-liner:

```bash
node -e "
const { createAdapter } = require('./bin/coderlm-adapter.cjs');
const adapter = createAdapter({});
adapter.getCallers(process.argv[1], process.argv[2] || undefined).then(r => {
  process.stdout.write(JSON.stringify(r));
}).catch(e => process.stdout.write(JSON.stringify({error: String(e)})));
" -- "<symbol>" "<file>"
```

Parse JSON output. Display results:

```
Callers of <symbol>:
  - path/to/caller1.js
  - path/to/caller2.js
  (N callers found)
```

If `result.error` is set, display:
```
Query failed: <error>
  Hint: Check server health with /nf:coderlm status
```

If `result.callers` is an empty array, display: "No callers found for <symbol>."
```

**implementation subcommand:**

```
**implementation:**

Usage: `/nf:coderlm implementation <symbol>`

- `symbol` — required. The function or type name to locate.

Run:

```bash
node -e "
const { createAdapter } = require('./bin/coderlm-adapter.cjs');
const adapter = createAdapter({});
adapter.getImplementation(process.argv[1]).then(r => {
  process.stdout.write(JSON.stringify(r));
}).catch(e => process.stdout.write(JSON.stringify({error: String(e)})));
" -- "<symbol>"
```

Parse JSON output. Display result:

```
Implementation of <symbol>:
  File: <result.file>
  Line: <result.line>
```

If `result.error` is set, display the error with the same hint as callers.
If `result.file` is absent, display: "Implementation location not found for <symbol>."
```

**tests subcommand:**

```
**tests:**

Usage: `/nf:coderlm tests <file>`

- `file` — required. The source file path (e.g., `bin/coderlm-adapter.cjs`).

Run:

```bash
node -e "
const { createAdapter } = require('./bin/coderlm-adapter.cjs');
const adapter = createAdapter({});
adapter.findTests(process.argv[1]).then(r => {
  process.stdout.write(JSON.stringify(r));
}).catch(e => process.stdout.write(JSON.stringify({error: String(e)})));
" -- "<file>"
```

Parse JSON output. Display results:

```
Tests associated with <file>:
  - path/to/test1.cjs
  - path/to/test2.cjs
  (N test file(s) found)
```

If `result.error` is set, display error with hint.
If `result.tests` is an empty array, display: "No associated test files found for <file>."
```

**peek subcommand:**

```
**peek:**

Usage: `/nf:coderlm peek <file> <startLine> <endLine>`

- `file` — required. File path to read from.
- `startLine` — required. First line number (1-indexed).
- `endLine` — required. Last line number (inclusive).

Validate that `startLine` and `endLine` are integers and `startLine <= endLine`. If not, display usage error.

Run:

```bash
node -e "
const { createAdapter } = require('./bin/coderlm-adapter.cjs');
const adapter = createAdapter({});
adapter.peek(process.argv[1], parseInt(process.argv[2]), parseInt(process.argv[3])).then(r => {
  process.stdout.write(JSON.stringify(r));
}).catch(e => process.stdout.write(JSON.stringify({error: String(e)})));
" -- "<file>" "<startLine>" "<endLine>"
```

Parse JSON output. Display source lines in a fenced block:

```
<file> lines <startLine>–<endLine>:

  <startLine> | <line content>
  <startLine+1> | <line content>
  ...
  <endLine> | <line content>
```

If `result.error` is set, display error with hint.
If `result.lines` is empty, display: "No lines returned for <file>:<startLine>-<endLine>."
```

Do NOT modify any existing lifecycle subcommand steps (start, stop, status, update). Only add new content after the update block and update the frontmatter + usage help.
  </action>
  <verify>grep -c "callers\|implementation\|tests\|peek" commands/nf/coderlm.md | grep -v "^0$" && grep "argument-hint" commands/nf/coderlm.md | grep "callers"</verify>
  <done>
`commands/nf/coderlm.md` contains all four query subcommands (callers, implementation, tests, peek) with ensure-running preamble, Node one-liner invocations using `coderlm-adapter.cjs`, formatted output templates, and error handling with diagnostic hints. The frontmatter `argument-hint` includes all new subcommands. Existing lifecycle subcommands (start, stop, status, update) are unchanged.
  </done>
</task>

</tasks>

<verification>
1. `grep "argument-hint" commands/nf/coderlm.md` includes `callers|implementation|tests|peek`
2. `grep -c "coderlm-adapter" commands/nf/coderlm.md` returns >= 4 (one per query subcommand)
3. `grep "coderlm-lifecycle.cjs --start" commands/nf/coderlm.md` confirms the ensure-running preamble is present
4. `grep -c "result.error" commands/nf/coderlm.md` returns >= 4 (error handling in each query subcommand)
5. Existing subcommands (start/stop/status/update) still present: `grep -c "^\\*\\*start:\\|^\\*\\*stop:\\|^\\*\\*status:\\|^\\*\\*update:" commands/nf/coderlm.md` returns 4
</verification>

<success_criteria>
- `commands/nf/coderlm.md` is updated with four query subcommands covering all adapter methods: `getCallers`, `getImplementation`, `findTests`, `peek`
- Each query subcommand has: usage line, argument description, Bash one-liner using `coderlm-adapter.cjs`, formatted output template, error path with hint
- A preamble before the query subcommands ensures coderlm is running via `coderlm-lifecycle.cjs --start` before any query is attempted
- Usage help block updated to list all new subcommands
- No modifications to existing lifecycle subcommand steps
</success_criteria>

<output>
After completion, create `.planning/quick/399-add-a-nf-coderlm-query-skill-that-lets-u/399-SUMMARY.md`
</output>
