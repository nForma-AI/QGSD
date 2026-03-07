---
phase: quick-219
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/observe-handler-internal.cjs
  - bin/observe-handler-internal.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-219]

must_haves:
  truths:
    - "Running /nf:observe in the QGSD repo surfaces health check errors/warnings as observe issues"
    - "Running /nf:observe in a consumer repo (no core/bin/gsd-tools.cjs) silently skips Category 15"
    - "Health check failures do not crash observe (fail-open)"
  artifacts:
    - path: "bin/observe-handler-internal.cjs"
      provides: "Category 15 health diagnostics block"
      contains: "Category 15"
    - path: "bin/observe-handler-internal.test.cjs"
      provides: "Tests for Category 15 gate and issue mapping"
      contains: "Category 15"
  key_links:
    - from: "bin/observe-handler-internal.cjs"
      to: "core/bin/gsd-tools.cjs"
      via: "spawnSync with 'node' and 'validate health' args"
      pattern: "gsd-tools\\.cjs.*validate.*health"
  consumers:
    - artifact: "Category 15 in observe-handler-internal.cjs"
      consumed_by: "observe-registry.cjs via handleInternal"
      integration: "Already wired — handleInternal is the internal handler"
      verify_pattern: "handleInternal"
---

<objective>
Add Category 15 (nf:health diagnostics) to observe-handler-internal.cjs so that /nf:observe surfaces
planning health issues (E*/W*/I* codes) as observe issues when running inside the QGSD repo.

Purpose: Self-development feedback loop — health check problems appear automatically in observe output
rather than requiring manual /nf:health runs.

Output: Updated observe-handler-internal.cjs with Category 15, plus tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/observe-handler-internal.cjs
@bin/observe-handler-internal.test.cjs
@core/bin/gsd-tools.cjs (lines 3848-4165 — cmdValidateHealth function)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Category 15 health diagnostics to handleInternal</name>
  <files>bin/observe-handler-internal.cjs</files>
  <action>
Add Category 15 block after Category 14 (issue classification), before the final `return` statement
(around line 742). Follow the exact same try/catch fail-open pattern used by all other categories.

**Self-development gate:** Check `path.join(projectRoot, 'core', 'bin', 'gsd-tools.cjs')` existence
(NOT `resolveScript()` which checks installed path first). This file only exists in the QGSD repo
itself. If not found, skip silently (no console.warn for expected absence).

**Implementation:**
```js
// Category 15: nf:health diagnostics (self-development only)
try {
  const gsdToolsPath = path.join(projectRoot, 'core', 'bin', 'gsd-tools.cjs');
  if (fs.existsSync(gsdToolsPath)) {
    const result = spawnSync(process.execPath, [gsdToolsPath, 'validate', 'health'], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: projectRoot
    });
    if (result.status === 0 && result.stdout) {
      let healthData;
      try { healthData = JSON.parse(result.stdout); } catch (_) { /* non-JSON */ }
      if (healthData) {
        // Map errors -> severity 'error'
        for (const e of (healthData.errors || [])) {
          issues.push({
            id: `internal-health-${e.code}`,
            title: `Health: ${e.message}`,
            severity: 'error',
            url: '',
            age: '',
            created_at: new Date().toISOString(),
            meta: e.fix || '',
            source_type: 'internal',
            issue_type: 'issue',
            _route: '/nf:solve'
          });
        }
        // Map warnings -> severity 'warning', route to /nf:health --repair if repairable
        for (const w of (healthData.warnings || [])) {
          issues.push({
            id: `internal-health-${w.code}`,
            title: `Health: ${w.message}`,
            severity: 'warning',
            url: '',
            age: '',
            created_at: new Date().toISOString(),
            meta: w.fix || '',
            source_type: 'internal',
            issue_type: 'issue',
            _route: w.repairable ? '/nf:health --repair' : '/nf:solve'
          });
        }
        // Map info -> severity 'info'
        for (const i of (healthData.info || [])) {
          issues.push({
            id: `internal-health-${i.code}`,
            title: `Health: ${i.message}`,
            severity: 'info',
            url: '',
            age: '',
            created_at: new Date().toISOString(),
            meta: i.fix || '',
            source_type: 'internal',
            issue_type: 'issue',
            _route: '/nf:solve'
          });
        }
      }
    }
  }
} catch (err) {
  console.warn(`[observe-internal] Warning running health diagnostics: ${err.message}`);
}
```

Also update the file header comment to list Category 15:
` * 15. Health diagnostics (gsd-tools validate health) — QGSD repo only`

And update the JSDoc for handleInternal to say "15 categories" instead of "14 categories".
  </action>
  <verify>
Run `node -e "const {handleInternal} = require('./bin/observe-handler-internal.cjs'); const r = handleInternal({}, {projectRoot: process.cwd()}); const h = r.issues.filter(i => i.id.startsWith('internal-health-')); console.log('health issues:', h.length); console.log(JSON.stringify(h.slice(0,2), null, 2));"` — should show health issues (info/warning codes from the QGSD repo's own health check).
  </verify>
  <done>Category 15 block exists in handleInternal, gated to QGSD repo via core/bin/gsd-tools.cjs existence check, maps E*/W*/I* codes to observe issues with correct severities and routes.</done>
</task>

<task type="auto">
  <name>Task 2: Add Category 15 tests</name>
  <files>bin/observe-handler-internal.test.cjs</files>
  <action>
Add a new `describe('Category 15 — Health diagnostics')` test block to `bin/observe-handler-internal.test.cjs`.

**Test 1: Self-development gate skips when core/bin/gsd-tools.cjs absent.**
Create a tmpDir with NO `core/bin/gsd-tools.cjs`. Run `handleInternal({}, { projectRoot: tmpDir })`.
Assert zero issues with id starting `internal-health-`.

**Test 2: Maps health check JSON output to observe issues.**
Create a tmpDir. Create a mock `core/bin/gsd-tools.cjs` script that outputs known JSON:
```js
const mockScript = `#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  status: 'degraded',
  errors: [{ code: 'E001', message: '.planning/ directory not found', fix: 'Run init', repairable: false }],
  warnings: [{ code: 'W003', message: 'config.json not found', fix: 'Run repair', repairable: true }],
  info: [{ code: 'I001', message: 'Plan has no SUMMARY', fix: 'May be in progress', repairable: false }],
  repairable_count: 1
}));`;
```
Write this to `tmpDir/core/bin/gsd-tools.cjs`. Make it executable.
Run `handleInternal({}, { projectRoot: tmpDir })`.
Assert:
- Issue `internal-health-E001` exists with severity `'error'` and `_route: '/nf:solve'`
- Issue `internal-health-W003` exists with severity `'warning'` and `_route: '/nf:health --repair'` (repairable)
- Issue `internal-health-I001` exists with severity `'info'`

**Test 3: Fail-open when gsd-tools.cjs returns non-JSON.**
Create mock that writes `"not json"` to stdout. Assert status is still `'ok'` and no health issues.

**Test 4: Fail-open when gsd-tools.cjs exits non-zero.**
Create mock that does `process.exit(1)`. Assert status is still `'ok'` and no health issues.
  </action>
  <verify>Run `node --test bin/observe-handler-internal.test.cjs` and confirm all tests pass including the new Category 15 tests.</verify>
  <done>Four Category 15 tests pass: gate skip, issue mapping with correct severities/routes, fail-open on non-JSON, fail-open on non-zero exit.</done>
</task>

</tasks>

<verification>
- `node --test bin/observe-handler-internal.test.cjs` — all tests pass
- `node -e "const {handleInternal} = require('./bin/observe-handler-internal.cjs'); const r = handleInternal({}, {projectRoot: '$(pwd)'}); console.log(r.issues.filter(i => i.id.startsWith('internal-health-')).length, 'health issues surfaced');"` — returns non-zero count in QGSD repo
- `node -e "const {handleInternal} = require('./bin/observe-handler-internal.cjs'); const r = handleInternal({}, {projectRoot: '/tmp'}); console.log(r.issues.filter(i => i.id.startsWith('internal-health-')).length, 'health issues (should be 0)');"` — returns 0 for non-QGSD dir
</verification>

<success_criteria>
- Category 15 health diagnostics integrated into observe-handler-internal.cjs
- Self-development gate prevents execution outside QGSD repo
- Health E*/W*/I* codes mapped to observe issues with correct severity
- Repairable warnings route to /nf:health --repair, others to /nf:solve
- Fail-open: non-JSON output or script failure silently skipped
- All existing + new tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/219-wire-nf-health-diagnostics-into-nf-obser/219-SUMMARY.md`
</output>
