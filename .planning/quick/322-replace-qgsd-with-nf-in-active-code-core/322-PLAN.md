---
phase: quick-322
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/templates/*.md
  - core/references/*.md
  - agents/*.md
  - hooks/*.js (comments only)
  - hooks/*.test.js (test assertions)
  - hooks/*.test.cjs (test assertions)
autonomous: true
formal_artifacts: none
requirements: []

must_haves:
  truths:
    - "No /qgsd: references remain in core/, agents/, or hooks/ source files except backward-compat regex patterns"
    - "All user-facing /qgsd: references replaced with /nf: in templates, agents, and references"
    - "Hook regex tri-prefix patterns /(nf|q?gsd):/ preserved (backward compat — these intentionally match all 3 prefixes)"
  artifacts:
    - path: "core/"
      provides: "Templates and references with /nf: prefix only"
    - path: "agents/"
      provides: "Agent prompts with /nf: prefix only"
---

# Quick Task 322: Replace /qgsd: → /nf: in Active Code

## Objective

Replace all remaining `/qgsd:` references with `/nf:` in active source files (core/, agents/, hooks/). Preserve backward-compat regex patterns that intentionally match all 3 prefixes.

<task id="1">
<title>Replace /qgsd: with /nf: in core/ and agents/</title>
<files>
- core/templates/*.md
- core/references/*.md
- agents/*.md
</files>
<action>
For all .md files in core/templates/, core/references/, and agents/:
1. Replace all `/qgsd:` with `/nf:` (literal string replacement)
2. Do NOT touch regex patterns like `/(nf|q?gsd):/` — those are backward compat
3. Do NOT touch `.planning/` archived files
4. Commit atomically
</action>
<verify>
Run: `grep -r '/qgsd:' core/ agents/ | grep -v '(nf|q.gsd)' | grep -v 'qgsd:' | wc -l` — should return 0
</verify>
<done>
No /qgsd: string literals remain in core/ or agents/ files (regex patterns preserved)
</done>
</task>

<task id="2">
<title>Replace /qgsd: in hooks/ comments and tests</title>
<files>
- hooks/nf-stop.js
- hooks/nf-prompt.js
- hooks/*.test.js
- hooks/*.test.cjs
</files>
<action>
For hooks source and test files:
1. Replace `/qgsd:` with `/nf:` in COMMENTS only (lines starting with //)
2. Replace `/qgsd:` with `/nf:` in test string literals and descriptions
3. PRESERVE the regex patterns `/(nf|q?gsd):/` — these are the tri-prefix backward compat
4. PRESERVE any `/qgsd:` that appears INSIDE a regex test case (testing that the regex matches /qgsd:)
5. Commit atomically
</action>
<verify>
Run: `grep -c '/qgsd:' hooks/nf-stop.js hooks/nf-prompt.js` — comments should now say /nf: not /qgsd:
Run: `node --test hooks/nf-stop.test.js` — tests pass
Run: `node --test hooks/nf-prompt.test.js` — tests pass
</verify>
<done>
Hook comments reference /nf: not /qgsd:. Tests still pass (regex compat preserved).
</done>
</task>

<task id="3">
<title>Verify and fix PROJECT.md and MILESTONES.md</title>
<files>
- .planning/PROJECT.md
- .planning/MILESTONES.md
</files>
<action>
Check PROJECT.md and MILESTONES.md for any remaining /qgsd: references.
Replace with /nf: where found.
Do NOT touch archived milestone files in .planning/milestones/ (historical record).
</action>
<verify>
Run: `grep -c '/qgsd:' .planning/PROJECT.md .planning/MILESTONES.md` — should return 0 for both
</verify>
<done>
No /qgsd: in active planning files.
</done>
</task>
