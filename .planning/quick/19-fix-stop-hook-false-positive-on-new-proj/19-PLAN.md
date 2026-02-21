---
phase: quick-19
plan: 19
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/qgsd-stop.js
  - hooks/dist/qgsd-stop.js
  - hooks/qgsd-stop.test.js
autonomous: true
requirements: []
must_haves:
  truths:
    - "/qgsd:quick invocation whose @file-expanded message body contains /qgsd:new-project as error text does NOT trigger a false-positive quorum block"
    - "A genuine /qgsd:new-project invocation still triggers quorum enforcement on decision turns"
    - "hasQuorumCommand prefers the <command-name> XML tag over full-message JSON scan"
    - "extractCommand prefers the <command-name> XML tag for accurate command identification"
    - "All existing tests continue to pass after the fix"
  artifacts:
    - path: "hooks/qgsd-stop.js"
      provides: "Fixed hasQuorumCommand and extractCommand functions with extractCommandTag helper"
      contains: "command-name"
    - path: "hooks/dist/qgsd-stop.js"
      provides: "Rebuilt dist matching source"
      contains: "command-name"
    - path: "hooks/qgsd-stop.test.js"
      provides: "Regression tests TC20/TC20b/TC20c for the at-file-expansion false positive"
      contains: "TC20"
  key_links:
    - from: "hooks/qgsd-stop.js"
      to: "hooks/dist/qgsd-stop.js"
      via: "npm run build:hooks"
      pattern: "build:hooks"
    - from: "hasQuorumCommand"
      to: "extractCommandTag"
      via: "XML tag-first matching before body scan"
      pattern: "command-name"
---

<objective>
Fix a false-positive quorum block in qgsd-stop.js where hasQuorumCommand matches
/qgsd:new-project text embedded inside @file-expanded workflow content rather than
the actual invoked command.

Purpose: The Stop hook must only fire on the literal slash command the user invoked.
Command names that appear in @file-expanded skill or workflow documentation must not
be treated as real invocations.

Output: Patched qgsd-stop.js (source + rebuilt dist) with an XML-tag-first matching
strategy, and three regression tests that cover the false-positive scenario.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/qgsd-stop.js
@hooks/qgsd-stop.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add extractCommandTag helper; update hasQuorumCommand and extractCommand</name>
  <files>hooks/qgsd-stop.js, hooks/dist/qgsd-stop.js</files>
  <action>
Edit hooks/qgsd-stop.js with these targeted changes:

STEP 1 — Add extractCommandTag() helper immediately before hasQuorumCommand.
The function reads the user entry's text content (string or array of text blocks),
runs the regex /<command-name>([\s\S]*?)<\/command-name>/ on it, and returns the
trimmed match group 1 or null. This tag is injected by Claude Code only for real
slash command invocations, never in @file-expanded content.

STEP 2 — Rewrite hasQuorumCommand(currentTurnLines, cmdPattern):

Old body (line 61-68):
  for each line, JSON.parse, skip non-user, then
  cmdPattern.test(JSON.stringify(entry.message || entry))

New body — XML-tag-first strategy:
  for each user entry:
    tag = extractCommandTag(entry)
    if tag is not null:
      if cmdPattern.test(tag): return true
      else: continue            (tag present but wrong command — do not fall through)
    else:
      // No XML tag — fall back to first 300 chars of message text only
      // (avoids matching @file-expanded content which appears later in the body)
      textContent = extract first text block from entry.message.content (string or array)
      if cmdPattern.test(textContent.slice(0, 300)): return true
  return false

STEP 3 — Apply identical XML-tag-first + 300-char-fallback logic to extractCommand.
When the tag value matches cmdPattern, return cmdPattern.exec(tag)[0].
Fallback: cmdPattern.exec(textContent.slice(0, 300)), return match[0] if found.
Keep the existing '/qgsd:plan-phase' ultimate fallback.

STEP 4 — After saving hooks/qgsd-stop.js, run:
  npm run build:hooks
from /Users/jonathanborduas/code/QGSD to regenerate hooks/dist/qgsd-stop.js.

STEP 5 — Confirm dist matches:
  diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js
(build copies source verbatim; diff should be empty or only require path differs)
  </action>
  <verify>
Run from /Users/jonathanborduas/code/QGSD:

  grep -n "extractCommandTag\|command-name" hooks/qgsd-stop.js

Should show the helper function definition and its call sites in hasQuorumCommand
and extractCommand.

  diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js

Should be empty (dist rebuilt from source).

  node --test hooks/qgsd-stop.test.js

All TC1-TC19 must pass. (TC20 added in Task 2.)
  </verify>
  <done>
hooks/qgsd-stop.js contains extractCommandTag() and both hasQuorumCommand /
extractCommand use the XML-tag-first strategy with 300-char text fallback.
hooks/dist/qgsd-stop.js is rebuilt to match. TC1-TC19 still pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add regression tests TC20/TC20b/TC20c for the false-positive scenario</name>
  <files>hooks/qgsd-stop.test.js</files>
  <action>
Append three test cases after TC19 (end of file) in hooks/qgsd-stop.test.js.

Add a helper function userLineWithTag(commandTag, bodyText, uuid) that builds a
user JSONL line whose message.content is a plain string starting with
"&lt;command-name&gt;{commandTag}&lt;/command-name&gt;\n\n{bodyText}".
This simulates Claude Code injecting the XML tag for real invocations.

TC20 — The false-positive regression:
  User message: command-name tag = "/qgsd:quick"; body contains the string
  "If you meant /qgsd:new-project, run that instead." (simulates expanded quick.md)
  No artifact commit, no decision marker.
  Expected: exit 0, empty stdout.
  Reason: /qgsd:quick is not in quorum_commands (default config), so GUARD 4 passes
  through even if body text were scanned. More importantly, with the fix the tag
  is read first and only "quick" is tested — "new-project" in the body is never seen.

TC20b — Positive control: new-project IS the real command (no artifact, so GUARD 5 passes):
  User message: command-name tag = "/qgsd:new-project"; no expanded body.
  Assistant: text block "What do you want to build?" (routing/questioning turn).
  No artifact commit, no decision marker.
  Expected: exit 0, empty stdout.
  Reason: real new-project command detected (GUARD 4 triggers), but GUARD 5 passes
  because no artifact commit and no decision marker — same as TC17.

TC20c — Full end-to-end: new-project IS real + decision turn + no quorum = block:
  User message: command-name tag = "/qgsd:new-project".
  Assistant: Bash tool_use with gsd-tools.cjs commit referencing ROADMAP.md.
  Assistant: text block "Here is the roadmap."
  No quorum tool calls.
  Expected: exit 0, stdout contains decision:block with QUORUM REQUIRED reason.
  Reason: real invocation + ROADMAP.md artifact commit (decision turn) + quorum missing.

Run the full suite after writing to confirm TC20/TC20b/TC20c all pass:
  node --test hooks/qgsd-stop.test.js
  </action>
  <verify>
Run from /Users/jonathanborduas/code/QGSD:

  grep -n "TC20" hooks/qgsd-stop.test.js

Should return three hits (TC20, TC20b, TC20c test descriptions).

  node --test hooks/qgsd-stop.test.js 2>&1 | tail -10

Should show all tests passing. Count increases by 3.

  npm test

Full suite zero failures.
  </verify>
  <done>
TC20, TC20b, TC20c written and passing. npm test exits 0.
The false-positive scenario is covered by an automated regression test.
  </done>
</task>

</tasks>

<verification>
1. grep -n "extractCommandTag\|command-name" hooks/qgsd-stop.js -- helper and call sites present
2. diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js -- empty (dist rebuilt)
3. grep -n "TC20" hooks/qgsd-stop.test.js -- three hits
4. npm test -- zero failures across all 4 test files
</verification>

<success_criteria>
- hooks/qgsd-stop.js: extractCommandTag() present; hasQuorumCommand and extractCommand use XML-tag-first with 300-char text fallback
- hooks/dist/qgsd-stop.js: rebuilt, matches source
- hooks/qgsd-stop.test.js: TC20, TC20b, TC20c regression tests present and passing
- npm test: zero failures
- The bug scenario (quick invocation with at-file-expanded body containing new-project text) no longer triggers a false-positive quorum block
</success_criteria>

<output>
After completion, create `.planning/quick/19-fix-stop-hook-false-positive-on-new-proj/19-SUMMARY.md`
following the standard summary template.
</output>
