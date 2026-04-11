---
phase: quick-387
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-statusline.js
  - hooks/dist/nf-statusline.js
  - hooks/nf-statusline.test.js
autonomous: true
requirements: [QUICK-387]
formal_artifacts: none

must_haves:
  truths:
    - "River active state renders as ' \x1b[32m● River\x1b[0m' (green dot, space prefix)"
    - "River exploring state renders as ' \x1b[36m● River\x1b[0m' (cyan dot, space prefix)"
    - "River shadow state renders as ' \x1b[33m● River: <recommendation>\x1b[0m' (yellow dot + recommendation, no trailing '(shadow)' text)"
    - "hooks/dist/nf-statusline.js is byte-for-byte identical to hooks/nf-statusline.js after the edit"
    - "Installer runs successfully after sync"
    - "npm test passes with all River indicator assertions updated to dot-style strings"
  artifacts:
    - path: "hooks/nf-statusline.js"
      provides: "River ML indicator using compact dot-style format matching coderlm pattern"
      contains: "● River"
    - path: "hooks/dist/nf-statusline.js"
      provides: "Dist copy in sync with source"
      contains: "● River"
    - path: "hooks/nf-statusline.test.js"
      provides: "Updated test assertions matching dot-style indicator strings"
      contains: "● River"
  key_links:
    - from: "hooks/nf-statusline.js lines ~186-194"
      to: "riverIndicator string values"
      via: "direct string assignment"
      pattern: "● River"
---

<objective>
Replace the verbose River ML status text in the statusline with compact dot-style visual indicators matching the coderlm indicator pattern. The three states become: green dot (active), cyan dot (exploring), yellow dot with recommendation text (shadow).

Purpose: Visual consistency between River ML and coderlm indicators in the statusline. Both are service-health-style indicators and should look alike.
Output: Updated hooks/nf-statusline.js and hooks/dist/nf-statusline.js with dot indicators, installer re-run to deploy.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/rules/git-workflow.md
@.claude/rules/coding-style.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace River ML text indicators with compact dot-style indicators</name>
  <files>hooks/nf-statusline.js</files>
  <action>
In hooks/nf-statusline.js, locate the River ML phase indicator block (lines ~186-194). Replace the three string assignments as follows:

Current active assignment (line ~188):
  riverIndicator = allAbove
    ? ' \x1b[32mRiver: active\x1b[0m'
    : ' \x1b[36mRiver: exploring\x1b[0m';

Replace with:
  riverIndicator = allAbove
    ? ' \x1b[32m● River\x1b[0m'
    : ' \x1b[36m● River\x1b[0m';

Current shadow assignment (line ~193):
  riverIndicator = ` \x1b[33mRiver: ${riverState.lastShadow.recommendation} (shadow)\x1b[0m`;

Replace with:
  riverIndicator = ` \x1b[33m● River: ${riverState.lastShadow.recommendation}\x1b[0m`;

No other changes to the file. The surrounding logic (hasArms check, allAbove computation, lastShadow guard) stays unchanged.
  </action>
  <verify>
node -e "
const src = require('fs').readFileSync('hooks/nf-statusline.js','utf8');
const hasGreen = src.includes(\"' \\\\x1b[32m\\u25cf River\\\\x1b[0m'\") || src.includes(\"'\\\\u001b[32m\\u25cf River\\\\u001b[0m'\") || src.includes('\\x1b[32m\\u25cf River\\x1b[0m');
const noOldActive = !src.includes('River: active');
const noOldExploring = !src.includes('River: exploring');
const noShadowSuffix = !src.includes('(shadow)');
console.log('green dot present:', hasGreen);
console.log('old active text gone:', noOldActive);
console.log('old exploring text gone:', noOldExploring);
console.log('shadow suffix gone:', noShadowSuffix);
"

Also verify visually that the block at lines ~186-194 now reads:
  riverIndicator = allAbove
    ? ' \x1b[32m● River\x1b[0m'
    : ' \x1b[36m● River\x1b[0m';
and the shadow line ends with the recommendation only (no "(shadow)").
  </verify>
  <done>
hooks/nf-statusline.js River indicator block uses ● dot-style strings for all three states. No "River: active", "River: exploring", or "(shadow)" text remains.
  </done>
</task>

<task type="auto">
  <name>Task 2: Sync dist copy and re-run installer</name>
  <files>hooks/dist/nf-statusline.js</files>
  <action>
Per .claude/rules/git-workflow.md: after editing a file in hooks/, copy it to hooks/dist/ and run the installer.

Step 1 — copy source to dist:
  cp hooks/nf-statusline.js hooks/dist/nf-statusline.js

Step 2 — run installer to deploy to ~/.claude/hooks/:
  node bin/install.js --claude --global

Pre-flight: confirm hooks/nf-statusline.js exists and was modified before copying.
  </action>
  <verify>
# Confirm dist matches source exactly
diff hooks/nf-statusline.js hooks/dist/nf-statusline.js
# Expect: no output (files are identical)

# Confirm installed copy also contains the new dot pattern
grep '● River' ~/.claude/hooks/nf-statusline.js
# Expect: at least one match
  </verify>
  <done>
hooks/dist/nf-statusline.js is identical to hooks/nf-statusline.js. The installed copy at ~/.claude/hooks/nf-statusline.js contains "● River". diff returns exit code 0.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update River indicator assertions in nf-statusline.test.js</name>
  <files>hooks/nf-statusline.test.js</files>
  <action>
The test file at hooks/nf-statusline.test.js contains assertion strings that match the OLD verbose format. After Task 1 changes the source, these assertions will fail. Update each affected line as follows:

Line 267 (TC15 — exploring state):
  OLD: assert.ok(stdout.includes('River: exploring'), 'stdout must include "River: exploring"');
  NEW: assert.ok(stdout.includes('● River'), 'stdout must include "● River"');

Line 293 (TC16 — active state):
  OLD: assert.ok(stdout.includes('River: active'), 'stdout must include "River: active"');
  NEW: assert.ok(stdout.includes('● River'), 'stdout must include "● River"');

Line 356 (TC19 — mixed exploring):
  OLD: assert.ok(stdout.includes('River: exploring'), 'stdout must include "River: exploring"');
  NEW: assert.ok(stdout.includes('● River'), 'stdout must include "● River"');

Line 406 (TC21 — shadow recommendation):
  OLD: assert.ok(stdout.includes('River: gemini-1 (shadow)'), 'stdout must include "River: gemini-1 (shadow)"');
  NEW: assert.ok(stdout.includes('● River: gemini-1'), 'stdout must include "● River: gemini-1"');

Line 432 (TC22 — no-shadow fallback to active):
  OLD: assert.ok(stdout.includes('River: active'), 'stdout must include "River: active" (not shadow)');
  NEW: assert.ok(stdout.includes('● River'), 'stdout must include "● River" (not shadow)');

Lines 459-460 (TC23 — null recommendation fallback):
  OLD: assert.ok(stdout.includes('River: active') || stdout.includes('River: exploring'),
         'stdout must include "River: active" or "River: exploring" (not shadow)');
  NEW: assert.ok(stdout.includes('● River'),
         'stdout must include "● River" (not shadow)');

Also update the TC22 negative assertion on line 433 — `!stdout.includes('shadow')` is already correct, no change needed there.

No other test assertions reference River state strings; do not change TC17/TC18/TC20 which check `!stdout.includes('River:')` — those remain correct because the new format uses "● River" not "River:".
  </action>
  <verify>
# Run only the River-related tests to confirm they pass
node --test hooks/nf-statusline.test.js 2>&1 | grep -E '(TC1[5-9]|TC2[0-3]|pass|fail|ok)'

# Also confirm no old strings remain in assertions
node -e "
const src = require('fs').readFileSync('hooks/nf-statusline.test.js','utf8');
const hasOldActive = src.includes(\"includes('River: active')\");
const hasOldExploring = src.includes(\"includes('River: exploring')\");
const hasOldShadow = src.includes(\"includes('River: gemini-1 (shadow)')\");
console.log('old active assertion gone:', !hasOldActive);
console.log('old exploring assertion gone:', !hasOldExploring);
console.log('old shadow assertion gone:', !hasOldShadow);
"
  </verify>
  <done>
All 6 assertion sites updated to dot-style strings. `node --test hooks/nf-statusline.test.js` exits 0 with all TC15-TC23 passing. No old "River: active", "River: exploring", or "River: gemini-1 (shadow)" strings remain in assert.ok() calls.
  </done>
</task>

</tasks>

<verification>
After all three tasks complete:
1. `diff hooks/nf-statusline.js hooks/dist/nf-statusline.js` exits 0 with no output
2. `grep '● River' hooks/nf-statusline.js` returns 3 matches (active, exploring, shadow lines)
3. `grep -E 'River: (active|exploring)' hooks/nf-statusline.js` returns no matches
4. `grep '(shadow)' hooks/nf-statusline.js` returns no matches
5. `node bin/install.js --claude --global` exits 0
6. `node --test hooks/nf-statusline.test.js` exits 0 with all TC15-TC23 passing
</verification>

<success_criteria>
- Green dot: ' \x1b[32m● River\x1b[0m' assigned when allAbove is true
- Cyan dot: ' \x1b[36m● River\x1b[0m' assigned when allAbove is false
- Yellow dot with recommendation: ' \x1b[33m● River: ${recommendation}\x1b[0m' assigned from lastShadow (no "(shadow)" suffix)
- hooks/dist/nf-statusline.js is in sync with hooks/nf-statusline.js
- Installer exits 0, deployed copy contains dot indicators
- `node --test hooks/nf-statusline.test.js` exits 0 with all River indicator tests passing
</success_criteria>

<output>
After completion, create `.planning/quick/387-improve-river-ml-statusline-indicator-to/387-SUMMARY.md` summarising what was changed, the exact line ranges modified in each file, and any decisions made.
</output>
