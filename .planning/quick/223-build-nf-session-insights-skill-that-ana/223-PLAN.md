---
phase: quick-223
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/observe-handler-session-insights.cjs
  - bin/observe-handler-session-insights.test.cjs
  - bin/observe-handlers.cjs
  - bin/observe-config.cjs
  - commands/nf/observe.md
  - commands/nf/session-insights.md
  - .planning/observe-sources.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-223]

must_haves:
  truths:
    - "Running nf:observe includes session-insights findings alongside other sources"
    - "Running nf:session-insights standalone shows friction patterns from recent sessions"
    - "Handler returns standard observe schema with issues for each friction pattern detected"
    - "Handler is fast: scans only last N sessions, skips tiny files"
    - "Handler fails open: returns empty issues on any error"
  artifacts:
    - path: "bin/observe-handler-session-insights.cjs"
      provides: "Session transcript analysis handler"
      exports: ["handleSessionInsights"]
      min_lines: 80
    - path: "bin/observe-handler-session-insights.test.cjs"
      provides: "Unit tests for session insights handler"
      min_lines: 50
    - path: "commands/nf/session-insights.md"
      provides: "Standalone skill command"
      contains: "nf:session-insights"
  key_links:
    - from: "bin/observe-handlers.cjs"
      to: "bin/observe-handler-session-insights.cjs"
      via: "require and re-export"
      pattern: "observe-handler-session-insights"
    - from: "commands/nf/observe.md"
      to: "bin/observe-handlers.cjs"
      via: "registerHandler('session-insights')"
      pattern: "handleSessionInsights"
    - from: "bin/observe-config.cjs"
      to: "ISSUE_TYPES array"
      via: "session-insights added to ISSUE_TYPES"
      pattern: "session-insights"
---

<objective>
Build an observe handler that analyzes Claude session JSONL transcripts for friction patterns (repeated tool failures, long sessions, circuit breaker triggers, repeated file edits, hook failures), then integrate it into nf:observe and create a standalone nf:session-insights skill.

Purpose: Surface session-level friction patterns as observe issues so they appear in the unified nf:observe output and can be routed to nf:solve or nf:quick for resolution.
Output: New handler file, test file, integration into observe pipeline, standalone skill command.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/observe-handler-internal.cjs
@bin/observe-handlers.cjs
@bin/observe-registry.cjs
@bin/observe-config.cjs
@bin/observe-utils.cjs
@commands/nf/observe.md
@.planning/observe-sources.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create session-insights observe handler with tests</name>
  <files>
    bin/observe-handler-session-insights.cjs
    bin/observe-handler-session-insights.test.cjs
  </files>
  <action>
Create `bin/observe-handler-session-insights.cjs` following the exact same pattern as `bin/observe-handler-internal.cjs`:

**Module structure:**
- `'use strict'` at top
- CommonJS require/module.exports
- Single exported function: `handleSessionInsights(sourceConfig, options)`
- Returns standard observe schema: `{ source_label, source_type: 'session-insights', status: 'ok'|'error', issues: [] }`
- Outer try/catch returns error schema (fail-open)

**Session file discovery:**
- Locate JSONL transcript files at `~/.claude/projects/` — find the project-specific subdirectory by matching the current project root path (the path is URL-encoded in the directory name under `~/.claude/projects/`)
- List `.jsonl` files in that directory, sorted by mtime descending
- Take only the last N sessions (configurable via `sourceConfig.max_sessions || 20`)
- Skip files smaller than 500 bytes (too small to contain meaningful data)

**JSONL parsing:**
- Read each file line by line using `fs.readFileSync` + `.split('\n')`
- Each line is a JSON object — parse with try/catch per line (skip malformed lines)
- Track relevant fields per session: tool calls (tool name, success/failure), assistant turn count, file edits (file path from Write/Edit tool calls), hook events

**Five analysis categories — each produces issues:**

1. **Repeated tool failures** (severity: warning): Same tool failing 3+ times in a session. Group by tool name, count failures. Issue title: "Tool '{tool}' failed {N} times in session {filename}". Meta: last error message snippet.

2. **Long sessions** (severity: info): Sessions with 50+ assistant turns. Issue title: "Long session ({N} turns): {filename}". Meta: session duration if determinable from timestamps.

3. **Circuit breaker triggers** (severity: warning): Look for messages containing "circuit breaker" or "oscillation" patterns in assistant responses or tool outputs. Issue title: "Circuit breaker triggered in session {filename}".

4. **Repeated file edits** (severity: warning): Same file edited 5+ times (Write or Edit tool use on same path). Issue title: "File '{path}' edited {N} times in session {filename}". Meta: suggests iteration churn.

5. **Hook failures** (severity: info): Look for hook-related error patterns in tool outputs (PreToolUse, PostToolUse, SessionStart hook failures). Issue title: "Hook failure in session {filename}". Meta: hook name.

**Issue ID format:** `session-insights-{category}-{session-hash}` where session-hash is first 8 chars of filename.

**Issue fields:** All issues must include: id, title, severity, url (empty string), age (from file mtime via formatAgeFromMtime from observe-utils.cjs), created_at, meta, source_type: 'session-insights', issue_type: 'issue'.

**Create test file** `bin/observe-handler-session-insights.test.cjs`:
- Test fail-open: calling with nonexistent project dir returns `{ status: 'ok', issues: [] }`
- Test each category with mock JSONL data: create temp files with known patterns, verify correct issues are produced
- Test max_sessions limit: create more files than limit, verify only N are scanned
- Test small file skip: create file under 500 bytes, verify it is skipped
- Test malformed JSONL lines are skipped without crashing
- Use vitest (import { describe, it, expect } from 'vitest')
  </action>
  <verify>
Run `npx vitest run bin/observe-handler-session-insights.test.cjs` — all tests pass.
Run `node -e "const h = require('./bin/observe-handler-session-insights.cjs'); console.log(typeof h.handleSessionInsights)"` — prints "function".
  </verify>
  <done>
Handler file exists at bin/observe-handler-session-insights.cjs exporting handleSessionInsights. Test file passes all cases including fail-open, all 5 analysis categories, max_sessions limit, and small file skip.
  </done>
</task>

<task type="auto">
  <name>Task 2: Integrate handler into observe pipeline and create standalone skill</name>
  <files>
    bin/observe-handlers.cjs
    bin/observe-config.cjs
    commands/nf/observe.md
    commands/nf/session-insights.md
    .planning/observe-sources.md
  </files>
  <action>
**1. Wire into observe-handlers.cjs:**
- Add `const { handleSessionInsights } = require('./observe-handler-session-insights.cjs');` alongside the other handler imports (after the handleDeps line, around line 372)
- Add `handleSessionInsights,` to the module.exports object with comment `// Session insights (quick-223)`

**2. Add to ISSUE_TYPES in observe-config.cjs:**
- Add `'session-insights'` to the `ISSUE_TYPES` array on line 11 (the array that defaults to "issue" type)

**3. Register in commands/nf/observe.md Step 3:**
- Add `const { handleSessionInsights } = require('./bin/observe-handlers.cjs');` to the destructured import (add handleSessionInsights to the existing destructured list on line 83)
- Add `registerHandler('session-insights', handleSessionInsights);` after the existing registerHandler calls (after line 89)

**4. Add source config in .planning/observe-sources.md:**
- Add a new uncommented source entry in the YAML frontmatter sources array (after the deps entry, before the commented-out logstash block):
```yaml
  # Session transcript insights (friction patterns)
  - type: session-insights
    label: "Session Insights"
    max_sessions: 20
```

**5. Create standalone skill commands/nf/session-insights.md:**
```
---
name: nf:session-insights
description: Analyze recent Claude session transcripts for friction patterns (tool failures, long sessions, iteration churn)
argument-hint: "[--sessions N]"
allowed-tools:
  - Read
  - Bash
---

<objective>
Scan recent session JSONL transcripts and surface friction patterns: repeated tool failures, abnormally long sessions, circuit breaker triggers, excessive file edits, and hook failures.
</objective>

<process>

## Step 1: Parse arguments

From $ARGUMENTS, extract:
- `--sessions N` -> max sessions to scan (default: 20)

## Step 2: Run the handler

```javascript
const { handleSessionInsights } = require('./bin/observe-handler-session-insights.cjs');
const result = handleSessionInsights(
  { label: 'Session Insights', max_sessions: sessionsArg || 20 },
  { projectRoot: process.cwd() }
);
```

## Step 3: Render results

Display a header:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma > SESSION INSIGHTS: Scanning last {N} sessions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If result.status is 'error', display the error and stop.

If result.issues is empty:
```
All clear — no friction patterns detected in recent sessions.
```

Otherwise, render a table:
| # | Finding | Severity | Age | Details |
with each issue from result.issues.

Group by category for readability:
- Tool Failures
- Long Sessions
- Circuit Breaker
- File Churn
- Hook Failures

## Step 4: Suggest actions

For any warning-severity findings, suggest:
```
Suggested: /nf:quick "{issue title}" to address this friction pattern
```

</process>
```
  </action>
  <verify>
Run `grep 'session-insights' bin/observe-config.cjs` — shows session-insights in ISSUE_TYPES.
Run `grep 'handleSessionInsights' bin/observe-handlers.cjs` — shows import and export.
Run `grep 'handleSessionInsights' commands/nf/observe.md` — shows registration.
Run `grep 'session-insights' .planning/observe-sources.md` — shows source config entry.
Run `test -f commands/nf/session-insights.md && echo "exists"` — prints "exists".
Run `npm test` — all existing tests still pass (no regressions).
  </verify>
  <done>
session-insights handler is wired into the observe pipeline: registered in observe.md Step 3, exported from observe-handlers.cjs, added to ISSUE_TYPES in observe-config.cjs, configured as a source in observe-sources.md. Standalone nf:session-insights skill command exists. All existing tests pass.
  </done>
</task>

</tasks>

<verification>
1. `npx vitest run bin/observe-handler-session-insights.test.cjs` — dedicated handler tests pass
2. `npm test` — full test suite passes (no regressions)
3. `node -e "const {handleSessionInsights} = require('./bin/observe-handler-session-insights.cjs'); const r = handleSessionInsights({label:'test'}, {}); console.log(r.source_type, r.status)"` — prints "session-insights ok"
4. `grep -c 'session-insights' bin/observe-config.cjs bin/observe-handlers.cjs commands/nf/observe.md .planning/observe-sources.md` — all files show at least 1 match
5. `test -f commands/nf/session-insights.md` — standalone skill exists
</verification>

<success_criteria>
- Handler analyzes JSONL session transcripts for 5 friction categories
- Handler returns standard observe schema and fails open on errors
- Handler is registered in observe pipeline and runs during nf:observe
- Standalone nf:session-insights skill renders results independently
- All tests pass including new handler tests and existing regression suite
</success_criteria>

<output>
After completion, create `.planning/quick/223-build-nf-session-insights-skill-that-ana/223-SUMMARY.md`
</output>
