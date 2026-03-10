---
phase: quick-258
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/learning-extractor.cjs
  - bin/memory-store.cjs
  - bin/observe-handler-internal.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-258]

must_haves:
  truths:
    - "errors.jsonl entries with non-empty root_cause or fix appear as observe issues routed to /nf:solve"
    - "noisy error entries (file dumps, JSON blobs, >500 char symptoms) are no longer extracted from transcripts"
    - "existing noisy entries in errors.jsonl can be purged via revalidate-errors CLI command"
  artifacts:
    - path: "bin/observe-handler-internal.cjs"
      provides: "Category 16 — errors.jsonl bridge to observe pipeline"
      contains: "Category 16"
    - path: "bin/learning-extractor.cjs"
      provides: "Quality-filtered error extraction"
      contains: "ERROR_INDICATORS"
    - path: "bin/memory-store.cjs"
      provides: "revalidate-errors CLI command"
      contains: "revalidate-errors"
  key_links:
    - from: "bin/observe-handler-internal.cjs"
      to: "bin/memory-store.cjs"
      via: "require('./memory-store.cjs').readLastN"
      pattern: "readLastN.*errors"
    - from: "bin/observe-handler-internal.cjs"
      to: ".planning/memory/errors.jsonl"
      via: "Category 16 reads errors via memory-store"
      pattern: "internal-error-"
    - from: "bin/learning-extractor.cjs"
      to: ".planning/memory/errors.jsonl"
      via: "session-end hook calls extractor which feeds memory-store"
      pattern: "ERROR_INDICATORS"
---

<objective>
Bridge errors.jsonl into the solve debt pipeline via a new observe Category 16, clean up error extraction quality in learning-extractor.cjs, and add a revalidate-errors command to memory-store.cjs for purging noisy historical entries.

Purpose: errors.jsonl accumulates 198 entries automatically but nothing reads them into the solve pipeline. This creates a dead-end data store. Additionally, the extractor captures noise (file dumps, JSON blobs) as "errors", polluting the data.

Output: Category 16 in observe-handler-internal.cjs, improved extraction filters in learning-extractor.cjs, revalidate-errors CLI command in memory-store.cjs.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/observe-handler-internal.cjs
@bin/learning-extractor.cjs
@bin/memory-store.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Improve error extraction quality and add revalidate command</name>
  <files>bin/learning-extractor.cjs, bin/memory-store.cjs</files>
  <action>
In `bin/learning-extractor.cjs`:

1. Fix `extractSymptom(block)` — add quality filtering:
   - After extracting content string, check that it contains at least one ERROR_INDICATORS keyword. If none match, return `null` (not the raw content).
   - If content length > 500 chars, return `null` (likely a file dump, not an error message).
   - Keep the 200-char truncation for valid symptoms.

2. Fix `findResolution(entries, i)` — filter out non-fix content:
   - In the tool_result branch (lines ~96-112), skip blocks where `contentStr` starts with common file-read patterns: line-number prefix regex `/^\s+\d+[→|]/`, JSON array starting with `[{`, or content length > 500 chars.
   - In the assistant explanation branch (lines ~115-120), keep the existing FIX_KEYWORDS check (it's already decent), but also skip if text length > 500 chars before the fix keyword match.

3. In `extractErrorPatterns()`, update the guard at line ~154: change `if (symptom && fix)` to `if (symptom !== null && fix)` since extractSymptom now returns null for noise.

In `bin/memory-store.cjs`:

4. Add a `revalidate-errors` CLI command in the switch block (before the `default:` case):
   - Read all entries from errors.jsonl using `readLastN(cwd, 'errors', 99999)` (or read file directly for all entries).
   - Import ERROR_INDICATORS from learning-extractor.cjs: `const { extractErrorPatterns } = require('./learning-extractor.cjs')` — actually, just inline the indicator list since we only need the keywords for validation. Define `const QUALITY_INDICATORS = ['Error:', 'ENOENT', 'EACCES', 'EPERM', 'TypeError', 'ReferenceError', 'SyntaxError']`.
   - Filter: keep entries where (a) symptom length <= 500, AND (b) symptom contains at least one QUALITY_INDICATOR keyword, AND (c) fix is non-empty.
   - Rewrite the file with only kept entries (same pattern as `pruneOlderThan`).
   - Output JSON: `{ kept: N, removed: M }`.

5. Update the usage help string in the `default:` case to include `revalidate-errors`.

6. Export nothing new (revalidate is CLI-only).
  </action>
  <verify>
Run: `node bin/learning-extractor.cjs` (should exit cleanly, no crash).
Run: `node bin/memory-store.cjs revalidate-errors` and confirm it outputs `{ kept: N, removed: M }` with removed > 0 (given the known noise in the 198 entries).
Run: `node bin/memory-store.cjs query-errors --limit 5` to confirm remaining entries have quality symptoms.
  </verify>
  <done>
learning-extractor.cjs rejects symptoms > 500 chars and symptoms without ERROR_INDICATOR keywords. findResolution skips file-read patterns. memory-store.cjs has working revalidate-errors command that purges noisy historical entries.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add Category 16 — errors.jsonl bridge to observe pipeline</name>
  <files>bin/observe-handler-internal.cjs</files>
  <action>
After Category 15's closing `catch` block (line ~809) and before the final `return` statement (line ~811), add Category 16:

```
// Category 16: Accumulated error patterns from errors.jsonl (nForma repo only)
try {
  const memoryStorePath = path.join(projectRoot, 'bin', 'memory-store.cjs');
  if (fs.existsSync(memoryStorePath)) {
    const { readLastN } = require(memoryStorePath);
    const limit = options.limitOverride || 20;
    const recentErrors = readLastN(projectRoot, 'errors', limit);

    for (let idx = 0; idx < recentErrors.length; idx++) {
      const entry = recentErrors[idx];
      // Filter: must have non-empty root_cause OR non-empty fix
      if (!(entry.root_cause || entry.fix)) continue;

      const severity = (entry.confidence === 'high') ? 'warning' : 'info';
      const symptomPreview = (entry.symptom || '').slice(0, 80);

      issues.push({
        id: `internal-error-${idx}`,
        title: `Error pattern: ${symptomPreview}`,
        severity,
        url: '',
        age: entry.ts ? formatAgeFromMtime(new Date(entry.ts)) : '',
        created_at: entry.ts || new Date().toISOString(),
        meta: entry.fix ? `Fix: ${(entry.fix || '').slice(0, 100)}` : `Cause: ${(entry.root_cause || '').slice(0, 100)}`,
        source_type: 'internal',
        issue_type: 'issue',
        _route: '/nf:solve'
      });
    }
  }
} catch (err) {
  console.warn(`[observe-internal] Warning scanning error patterns: ${err.message}`);
}
```

Also update the JSDoc comment at the top of the file:
- Add line: ` * 16. Accumulated error patterns (errors.jsonl via memory-store.cjs)`
- Update the function JSDoc to say "Scans 16 categories" instead of "Scans 15 categories".
  </action>
  <verify>
Run: `node -e "const {handleInternal} = require('./bin/observe-handler-internal.cjs'); const r = handleInternal({}, {projectRoot: process.cwd()}); console.log('issues:', r.issues.length); const errIssues = r.issues.filter(i => i.id.startsWith('internal-error-')); console.log('error-pattern issues:', errIssues.length); if (errIssues.length > 0) console.log('sample:', JSON.stringify(errIssues[0], null, 2));"` and confirm error-pattern issues appear.

Grep verify: `grep -c 'Category 16' bin/observe-handler-internal.cjs` returns 1.
Grep verify: `grep 'internal-error-' bin/observe-handler-internal.cjs` returns match.
  </verify>
  <done>
Category 16 reads from errors.jsonl via memory-store.cjs readLastN, filters to entries with non-empty root_cause or fix, surfaces them as observe issues with source_type 'internal' and _route '/nf:solve'. Errors.jsonl is now bridged into the solve debt pipeline via the existing observe -> debt.json flow.
  </done>
</task>

</tasks>

<verification>
1. Full observe handler runs without error: `node -e "const {handleInternal} = require('./bin/observe-handler-internal.cjs'); const r = handleInternal({}, {projectRoot: process.cwd()}); console.log(JSON.stringify({status: r.status, totalIssues: r.issues.length, errorPatternIssues: r.issues.filter(i => i.id.startsWith('internal-error-')).length}))"`
2. Revalidate purges noise: `node bin/memory-store.cjs revalidate-errors` shows removed > 0
3. Post-revalidate query shows clean entries: `node bin/memory-store.cjs query-errors --limit 3`
4. No test regressions: `npm test 2>&1 | tail -5`
</verification>

<success_criteria>
- errors.jsonl entries surface as observe issues routed to /nf:solve
- Noisy entries (file dumps, JSON blobs, >500 char symptoms) are filtered at extraction time
- Historical noise can be purged via `node bin/memory-store.cjs revalidate-errors`
- All existing tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/258-bridge-errors-jsonl-into-solve-debt-pipe/258-SUMMARY.md`
</output>
