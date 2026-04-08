---
phase: quick-380
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/feature-telemetry-schema.cjs
  - bin/feature-telemetry-schema.test.cjs
  - bin/feature-report.cjs
  - bin/feature-report.test.cjs
  - bin/observe-handler-internal.cjs
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "Feature interaction events conform to a validated schema with feature_id, action, session_id, timestamp, outcome, and duration_ms fields"
    - "Schema validation tests exist and catch invalid events (missing fields, bad types, unknown features)"
    - "Per-feature metrics are aggregated over a selectable time range: usage count, unique sessions, success/failure rate, average duration"
    - "Bugs detected or prevented are linked to the feature events that surfaced them via bug_link records"
    - "Human-friendly narrative insights summarize notable findings (e.g., high failure rates, features that caught real bugs)"
    - "The reporting pipeline runs end-to-end from JSONL events to a structured report with metrics and insights"
    - "The report integrates into the existing observe-handler-internal pipeline as a new telemetry category"
  artifacts:
    - path: "bin/feature-telemetry-schema.cjs"
      provides: "Feature event schema definition and validation"
      exports: ["FEATURE_IDS", "FEATURE_ACTIONS", "validateFeatureEvent", "createFeatureEvent"]
    - path: "bin/feature-telemetry-schema.test.cjs"
      provides: "Schema validation unit tests"
      min_lines: 80
    - path: "bin/feature-report.cjs"
      provides: "Feature usefulness report generator with metrics, bug linkage, and narrative insights"
      exports: ["generateReport"]
    - path: "bin/feature-report.test.cjs"
      provides: "Report generation unit tests including end-to-end pilot"
      min_lines: 120
  key_links:
    - from: "bin/feature-report.cjs"
      to: "bin/feature-telemetry-schema.cjs"
      via: "require() for schema validation during event parsing"
      pattern: "feature-telemetry-schema"
    - from: "bin/feature-report.cjs"
      to: ".planning/telemetry/feature-events.jsonl"
      via: "fs.readFileSync for raw event data"
      pattern: "feature-events\\.jsonl"
    - from: "bin/observe-handler-internal.cjs"
      to: "bin/feature-report.cjs"
      via: "require() and spawnSync in new Category 17"
      pattern: "feature-report"
  consumers:
    - artifact: "bin/feature-telemetry-schema.cjs"
      consumed_by: "bin/feature-report.cjs"
      integration: "require() for validateFeatureEvent during parsing"
      verify_pattern: "feature-telemetry-schema"
    - artifact: "bin/feature-report.cjs"
      consumed_by: "bin/observe-handler-internal.cjs"
      integration: "Category 17 in handleInternal()"
      verify_pattern: "feature-report"
---

<objective>
Add structured feature-usefulness reporting to nForma: a schema-validated telemetry event format for feature interactions, an aggregation + narrative-insights report generator, bug-to-feature linkage, and integration into the existing observe pipeline.

Purpose: Enable measurement of which nForma features (formal loops, quorum consensus, debug pipeline, etc.) are most useful and which bugs they detect/prevent, providing actionable insights for product improvement.
Output: `bin/feature-telemetry-schema.cjs` (event schema + validation), `bin/feature-report.cjs` (report generator), integration into observe-handler-internal.cjs, comprehensive test suites.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/conformance-schema.cjs (existing event schema pattern — 12 lines, follow same module structure)
@bin/telemetry-collector.cjs (existing telemetry aggregation pattern — reads sources, writes report.json)
@bin/observe-handler-internal.cjs (16 existing categories — add Category 17 following same try/catch pattern)
@bin/observe-handler-session-insights.cjs (observe handler pattern — return { source_label, source_type, status, issues[] })
@bin/observe-handler-session-insights.test.cjs (test pattern — node:test, node:assert, temp dirs)
@bin/planning-paths.cjs (path resolver — add 'feature-events' type for canonical path resolution)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create feature telemetry event schema with validation and tests</name>
  <files>bin/feature-telemetry-schema.cjs, bin/feature-telemetry-schema.test.cjs, bin/planning-paths.cjs</files>
  <action>
Create `bin/feature-telemetry-schema.cjs` (CommonJS, 'use strict') following the pattern of `bin/conformance-schema.cjs`:

1. **Define FEATURE_IDS** — enumeration of tracked features:
   ```javascript
   const FEATURE_IDS = [
     'formal_loop',           // Loop 1/2 autoresearch iterations
     'quorum_consensus',      // Multi-agent quorum voting
     'debug_pipeline',        // /nf:debug bug investigation
     'pre_commit_gate',       // Pre-commit simulation gate (Loop 2)
     'task_classification',   // Haiku task classifier
     'model_staleness',       // Formal model staleness detection
     'observe_pipeline',      // /nf:observe data gathering
     'solve_diagnostic',      // /nf:solve diagnostic sweep
   ];
   ```

2. **Define FEATURE_ACTIONS** — lifecycle events:
   ```javascript
   const FEATURE_ACTIONS = ['start', 'complete', 'fail', 'skip'];
   ```

3. **Define FEATURE_OUTCOMES** — result types:
   ```javascript
   const FEATURE_OUTCOMES = ['success', 'failure', 'partial', 'skipped', 'timeout'];
   ```

4. **`validateFeatureEvent(event)`** — returns `{ valid: boolean, errors: string[] }`:
   - Required fields: `feature_id` (must be in FEATURE_IDS), `action` (in FEATURE_ACTIONS), `session_id` (non-empty string), `timestamp` (ISO 8601 string), `outcome` (in FEATURE_OUTCOMES), `duration_ms` (non-negative number)
   - Optional fields: `bug_link` (object with `issue_url` string and `detection_type` enum of `['detected', 'prevented', 'related']`), `metadata` (plain object), `user_id` (string, defaults to 'local')
   - Return `{ valid: true, errors: [] }` if all checks pass, otherwise list all errors

5. **`createFeatureEvent(fields)`** — convenience constructor:
   - Accepts partial fields, fills defaults: `timestamp` = `new Date().toISOString()`, `user_id` = `'local'`, `schema_version` = `'1'`
   - Validates before returning; throws if invalid

6. **schema_version** = `'1'`

7. **Export**: `{ FEATURE_IDS, FEATURE_ACTIONS, FEATURE_OUTCOMES, validateFeatureEvent, createFeatureEvent, schema_version }`

NEVER add external dependencies. Follow the conformance-schema.cjs pattern: pure JS, no require() calls.

**Add path type to `bin/planning-paths.cjs`** — add a `'feature-events'` entry to the TYPES object (after `'token-usage'`, ~line 63):
```javascript
'feature-events': {
  canonical: (root) => path.join(root, '.planning', 'telemetry', 'feature-events.jsonl'),
  legacy:    (root) => path.join(root, '.planning', 'feature-events.jsonl'),
},
```

**Test file** `bin/feature-telemetry-schema.test.cjs` using `node:test` and `node:assert/strict`:

- Test FEATURE_IDS is a non-empty array containing 'formal_loop' and 'quorum_consensus'
- Test FEATURE_ACTIONS includes 'start', 'complete', 'fail', 'skip'
- Test FEATURE_OUTCOMES includes 'success', 'failure', 'partial', 'skipped', 'timeout'
- Test schema_version is string '1'
- Test validateFeatureEvent with valid event returns `{ valid: true, errors: [] }`
- Test validateFeatureEvent catches missing feature_id (returns valid: false with error)
- Test validateFeatureEvent catches unknown feature_id
- Test validateFeatureEvent catches missing action
- Test validateFeatureEvent catches invalid action value
- Test validateFeatureEvent catches missing session_id
- Test validateFeatureEvent catches empty string session_id
- Test validateFeatureEvent catches missing timestamp
- Test validateFeatureEvent catches missing outcome
- Test validateFeatureEvent catches invalid outcome value
- Test validateFeatureEvent catches negative duration_ms
- Test validateFeatureEvent catches non-number duration_ms
- Test validateFeatureEvent accepts valid bug_link
- Test validateFeatureEvent catches bug_link with missing issue_url
- Test validateFeatureEvent catches bug_link with invalid detection_type
- Test createFeatureEvent returns valid event with defaults
- Test createFeatureEvent throws on invalid input
- Test createFeatureEvent fills timestamp and user_id defaults
  </action>
  <verify>
Run: `node --test bin/feature-telemetry-schema.test.cjs` — all tests pass.
Run: `node -e "const s = require('./bin/feature-telemetry-schema.cjs'); console.log(JSON.stringify(Object.keys(s)))"` — prints array containing FEATURE_IDS, FEATURE_ACTIONS, FEATURE_OUTCOMES, validateFeatureEvent, createFeatureEvent, schema_version.
Run: `grep 'feature-events' bin/planning-paths.cjs` — confirms the path type is registered.
  </verify>
  <done>
Feature telemetry event schema is defined with FEATURE_IDS, FEATURE_ACTIONS, FEATURE_OUTCOMES enumerations. validateFeatureEvent validates all required/optional fields with error messages. createFeatureEvent constructs events with sensible defaults. Schema validation tests cover all positive and negative cases. planning-paths.cjs resolves feature-events.jsonl paths.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create feature report generator with metrics aggregation, bug linkage, and narrative insights</name>
  <files>bin/feature-report.cjs, bin/feature-report.test.cjs</files>
  <action>
Create `bin/feature-report.cjs` (CommonJS, 'use strict') following the pattern of `bin/telemetry-collector.cjs`:

1. **CLI interface**: `node bin/feature-report.cjs [--json] [--since=7d] [--project-root=PATH]`
   - `--since=Nd` or `--since=Nh` — time window filter (default: 30d)
   - `--json` — JSON output to stdout (default: human-readable)
   - `--project-root=PATH` — override project root (default: process.cwd())

2. **Event loading**:
   - Read `.planning/telemetry/feature-events.jsonl` using planning-paths.cjs `resolveWithFallback(root, 'feature-events')`
   - Parse each JSONL line, validate with `validateFeatureEvent()` from feature-telemetry-schema.cjs
   - Skip invalid events (log count to stderr), filter by `--since` time window
   - If file missing, output empty report (not an error — fail-open)

3. **Per-feature metrics aggregation** (`generateMetrics(events)`):
   For each unique `feature_id`, compute:
   - `usage_count`: total events with action 'complete' or 'fail'
   - `unique_sessions`: Set of distinct session_id values
   - `success_count`: events with outcome 'success'
   - `failure_count`: events with outcome 'failure'
   - `success_rate`: success_count / usage_count (0 if no usage)
   - `avg_duration_ms`: mean of duration_ms for all events
   - `p95_duration_ms`: 95th percentile of duration_ms

4. **Bug linkage** (`generateBugLinks(events)`):
   - Filter events with `bug_link` field present
   - Group by `bug_link.issue_url`
   - For each bug: list feature_ids that detected/prevented it, detection_type, earliest timestamp
   - Output: `{ bugs: [{ issue_url, detection_type, features: [feature_id], first_detected }] }`

5. **Narrative insights** (`generateInsights(metrics, bugLinks)`):
   Generate 3-7 insight strings based on data patterns:
   - High failure rate: "Feature '{id}' has a {rate}% failure rate over {N} uses — investigate recurring failures"
   - Bug catcher: "Feature '{id}' detected {N} bugs including {url} — demonstrating strong defect detection"
   - Unused feature: "Feature '{id}' had 0 uses in the last {window} — consider if it needs promotion or removal"
   - Performance outlier: "Feature '{id}' p95 duration is {ms}ms — {N}x slower than average feature"
   - Top feature: "Feature '{id}' is the most-used feature with {N} invocations and {rate}% success rate"
   - If no events at all: "No feature telemetry events found. Emit events using createFeatureEvent() from feature-telemetry-schema.cjs to start tracking."

6. **Report output** (`generateReport(root, { since, json })`):
   ```json
   {
     "generated_at": "ISO timestamp",
     "time_window": "30d",
     "total_events": N,
     "invalid_events": N,
     "features": {
       "formal_loop": { "usage_count": N, "unique_sessions": N, "success_rate": 0.95, ... },
       ...
     },
     "bug_links": [{ "issue_url": "...", "detection_type": "detected", "features": [...] }],
     "insights": ["...", "..."]
   }
   ```

7. **Human-readable output** (when --json not specified):
   Print a formatted table of per-feature metrics, a bug linkage summary, and numbered insights.
   Use stderr for diagnostics, stdout for data (consistent with telemetry-collector.cjs pattern).

8. **Export**: `generateReport(root, opts)` for programmatic use (returns the report object).

Use `require('./planning-paths.cjs')` for path resolution. Use `require('./feature-telemetry-schema.cjs')` for validation. Follow fail-open: wrap in try/catch at top level, exit 0 on errors with empty report.

**Test file** `bin/feature-report.test.cjs` using `node:test` and `node:assert/strict`:

Create a helper that writes a temp dir with `.planning/telemetry/feature-events.jsonl` containing test events.

Tests:
- **Empty file / missing file**: returns report with total_events: 0, empty features, empty insights containing the "no events" message
- **Valid events**: writes 10 events across 3 features (formal_loop, quorum_consensus, debug_pipeline) with varied outcomes. Verify:
  - usage_count correct per feature
  - unique_sessions correct (use 3 different session_ids)
  - success_rate computed correctly
  - avg_duration_ms computed correctly
- **Bug linkage**: write events with bug_link field, verify bug shows in bug_links array with correct features list
- **Time window filtering**: write events with timestamps 40d ago and 5d ago, run with --since=7d, verify only recent events counted
- **Invalid event skipping**: mix valid and invalid events, verify invalid_events count and valid ones still processed
- **Insight generation**:
  - Feature with >50% failure rate generates high-failure insight
  - Feature with bug_links generates bug-catcher insight
  - Feature with 0 uses generates unused-feature insight
- **CLI integration**: run `node bin/feature-report.cjs --json --project-root={tmpDir}` via spawnSync, verify exit code 0 and valid JSON output
- **End-to-end pilot**: write a realistic set of ~20 events simulating a week of nForma usage (formal loops running, some failing, one catching a bug), generate report, verify it contains at least one meaningful insight and correct metrics. This is the acceptance criteria pilot run.

Use `fs.mkdtempSync` for temp dirs, clean up in after hooks. Follow the pattern from observe-handler-session-insights.test.cjs.
  </action>
  <verify>
Run: `node --test bin/feature-report.test.cjs` — all tests pass.
Run: `node bin/feature-report.cjs --json --project-root=$(pwd) 2>/dev/null` — exits 0, produces valid JSON (even if no events file exists yet).
Run: `node -e "const r = require('./bin/feature-report.cjs'); console.log(typeof r.generateReport)"` — prints 'function'.
  </verify>
  <done>
Feature report generator aggregates per-feature metrics (usage count, unique sessions, success/failure rate, avg/p95 duration), links bugs to detecting features, generates narrative insights based on data patterns. CLI supports --json and --since flags. End-to-end pilot test demonstrates the full pipeline with realistic event data producing a meaningful report with insights.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire feature report into observe-handler-internal as Category 17</name>
  <files>bin/observe-handler-internal.cjs</files>
  <action>
Add **Category 17: Feature usefulness report** to `bin/observe-handler-internal.cjs`, following the exact pattern of Category 10 (telemetry anomalies) and Category 14 (issue classification):

1. **Add category comment** to the file header (line ~18, after Category 16):
   ```
   * 17. Feature usefulness report (feature-report.cjs)
   ```

2. **Add category description** in the function JSDoc (line ~34):
   ```
   * telemetry, observed FSM, sensitivity sweep, security, issue classification,
   * health diagnostics, error patterns, feature usefulness
   ```

3. **Add Category 17 block** after the Category 16 block (after the error patterns section, ~line 800). Follow the try/catch fail-open pattern:

   ```javascript
   // Category 17: Feature usefulness report (feature-report.cjs)
   try {
     const reportScript = resolveScript('feature-report.cjs');
     if (reportScript) {
       const result = spawnSync(process.execPath, [reportScript, '--json', '--project-root', projectRoot], {
         encoding: 'utf8',
         timeout: 15000,
       });
       if (result.status === 0 && result.stdout) {
         const report = JSON.parse(result.stdout);
         // Surface features with high failure rates
         if (report.features) {
           for (const [featureId, metrics] of Object.entries(report.features)) {
             if (metrics.usage_count > 0 && metrics.success_rate < 0.5) {
               issues.push({
                 id: `internal-feature-high-failure-${featureId}`,
                 title: `Feature '${featureId}' has ${Math.round((1 - metrics.success_rate) * 100)}% failure rate (${metrics.usage_count} uses)`,
                 severity: 'medium',
                 source: 'internal:feature-report',
                 raw: { feature_id: featureId, ...metrics },
               });
             }
           }
         }
         // Surface bugs detected by features
         if (Array.isArray(report.bug_links)) {
           for (const bug of report.bug_links) {
             issues.push({
               id: `internal-feature-bug-${bug.issue_url.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 60)}`,
               title: `Bug ${bug.issue_url} ${bug.detection_type} by ${bug.features.join(', ')}`,
               severity: 'info',
               source: 'internal:feature-report',
               raw: bug,
             });
           }
         }
         // Surface top narrative insights as info-level issues
         if (Array.isArray(report.insights) && report.insights.length > 0) {
           issues.push({
             id: 'internal-feature-insights',
             title: `Feature report: ${report.insights.length} insight(s) — ${report.insights[0].slice(0, 80)}`,
             severity: 'info',
             source: 'internal:feature-report',
             raw: { insights: report.insights },
           });
         }
       }
     }
   } catch (e17) {
     console.warn(`[observe-internal] Warning collecting feature report: ${e17.message}`);
   }
   ```

4. **Update the category count** in the function header from "16 categories" to "17 categories".

The feature-report integration follows existing patterns:
- Uses `resolveScript()` for portable bin path resolution (already defined in the file)
- Uses `spawnSync` with encoding and timeout (same as Categories 8-14)
- Fail-open: entire block in try/catch, warns on error but doesn't fail
- Issues use the standard `{ id, title, severity, source, raw }` shape
- Severity 'medium' for actionable problems (high failure rate), 'info' for awareness items
  </action>
  <verify>
Run: `grep -c 'Category 17' bin/observe-handler-internal.cjs` — returns at least 1.
Run: `grep 'feature-report' bin/observe-handler-internal.cjs` — confirms require/spawn of feature-report.cjs.
Run: `grep '17 categories' bin/observe-handler-internal.cjs` — confirms updated count.
Run: `grep 'internal-feature-high-failure\|internal-feature-bug\|internal-feature-insights' bin/observe-handler-internal.cjs` — confirms all 3 issue types.
Run: `node --test bin/observe-handlers.test.cjs 2>/dev/null; echo $?` — existing observe handler tests still pass (exit 0).
  </verify>
  <done>
Feature usefulness report is wired into the observe pipeline as Category 17 in observe-handler-internal.cjs. High-failure-rate features surface as medium-severity issues, detected bugs as info-level issues, and narrative insights as a summary issue. The integration follows the existing fail-open, spawn-with-timeout pattern. Existing tests pass without regression.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/feature-telemetry-schema.test.cjs` passes all schema validation tests
2. `node --test bin/feature-report.test.cjs` passes all report generation tests including end-to-end pilot
3. `node bin/feature-report.cjs --json --project-root=$(pwd) 2>/dev/null` exits 0, produces valid JSON
4. `grep 'feature-events' bin/planning-paths.cjs` confirms path type registered
5. `grep 'Category 17' bin/observe-handler-internal.cjs` confirms integration
6. `grep 'feature-report' bin/observe-handler-internal.cjs` confirms wiring
7. Existing tests pass: `node --test bin/observe-handlers.test.cjs`
8. Pilot: `node -e "const s=require('./bin/feature-telemetry-schema.cjs'); const e=s.createFeatureEvent({feature_id:'formal_loop',action:'complete',session_id:'test-1',outcome:'success',duration_ms:1500}); console.log(JSON.stringify(e))"` — produces valid event JSON
</verification>

<success_criteria>
- Feature telemetry event schema validates feature_id, action, session_id, timestamp, outcome, duration_ms with comprehensive error messages
- Schema validation tests cover all required fields, optional bug_link, and edge cases
- Per-feature metrics aggregate usage count, unique sessions, success/failure rate, avg/p95 duration over a selectable time range
- Bug linkage connects recorded bugs to detecting features via bug_link field
- Narrative insights automatically generated from metric patterns (high failure, bug catching, unused, performance outlier)
- End-to-end pilot test demonstrates full pipeline from JSONL events through aggregation to insights
- Report integrates into observe pipeline as Category 17 in observe-handler-internal.cjs
- All new tests pass, no regressions in existing tests
</success_criteria>

<output>
After completion, create `.planning/quick/380-improve-nforma-reporting-for-feature-use/380-SUMMARY.md`
</output>
