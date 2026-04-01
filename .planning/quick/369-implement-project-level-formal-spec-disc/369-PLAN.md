---
phase: 369-implement-project-level-formal-spec-disc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/formal-scope-scan.cjs
  - bin/run-formal-check.cjs
  - bin/run-formal-check.test.cjs
  - .planning/formal/specs/formal-checks.json
autonomous: true
requirements: [PROJSPEC-01, PROJSPEC-02, PROJSPEC-03]

must_haves:
  truths:
    - "A project placing specs in .planning/formal/specs/ gets them auto-discovered by formal-scope-scan.cjs and registered into model-registry.json view"
    - "Project-level spec matches appear in formal-scope-scan.cjs output with source: project marker alongside nForma-internal matches"
    - "run-formal-check.cjs can execute project-level checks using structured command/args from the manifest (never free-form string execution)"
    - "Unregistered .tla/.als/.pm files in .planning/formal/specs/ are reported as suggestions"
  artifacts:
    - path: "bin/formal-scope-scan.cjs"
      provides: "Project manifest discovery + auto-scan + registry merge"
      contains: "formal-checks.json"
    - path: "bin/run-formal-check.cjs"
      provides: "Project-level check execution via structured command/args"
      contains: "formal-checks.json"
    - path: ".planning/formal/specs/formal-checks.json"
      provides: "Example/template manifest for projects to declare specs"
  key_links:
    - from: "bin/formal-scope-scan.cjs loadProjectManifest()"
      to: ".planning/formal/specs/formal-checks.json"
      via: "fs.readFileSync with fail-open"
      pattern: "formal-checks\\.json"
    - from: "bin/formal-scope-scan.cjs mergeProjectSpecsIntoRegistry()"
      to: ".planning/formal/model-registry.json"
      via: "in-memory merge with source: project marker"
      pattern: "source.*project"
    - from: "bin/run-formal-check.cjs runProjectCheck()"
      to: "spawnSync with structured command/args"
      via: "ALLOWED_COMMANDS allowlist check before execution"
      pattern: "ALLOWED_COMMANDS"
    - from: "core/workflows/quick.md Step 6.3"
      to: "bin/run-formal-check.cjs --modules"
      via: "existing invocation (consumer already wired)"
      pattern: "run-formal-check.cjs --modules"
---

<objective>
Extend formal-scope-scan.cjs and run-formal-check.cjs to discover, register, and execute project-level formal specs defined in `.planning/formal/specs/formal-checks.json`, integrating them into the existing model-registry.json rather than creating a parallel source of truth.

Purpose: Projects creating their own TLA+/Alloy/PRISM specs are currently invisible to nForma pipelines. This bridges the gap by letting projects register specs via a manifest that merges into the existing registry, with auto-discovery of unregistered spec files as a complement.
Output: Updated formal-scope-scan.cjs with project manifest discovery + registry merge + auto-discovery, updated run-formal-check.cjs with safe structured command execution, tests for both.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/formal-scope-scan.cjs
@bin/run-formal-check.cjs
@bin/run-formal-check.test.cjs
@.planning/formal/model-registry.json
@.planning/formal/layer-manifest.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add project manifest discovery, registry merge, and auto-discovery to formal-scope-scan.cjs</name>
  <files>bin/formal-scope-scan.cjs, .planning/formal/specs/formal-checks.json</files>
  <action>
**Part A: Define the enriched manifest schema and create example file.**

Create `.planning/formal/specs/formal-checks.json` as a template/example:
```json
{
  "version": 1,
  "specs": []
}
```

The manifest schema for each entry in `specs` is:
```json
{
  "module": "gke-pod-recovery",
  "type": "tla",
  "spec_path": ".planning/formal/specs/GKEPodRecovery.tla",
  "config_path": ".planning/formal/specs/MCGKEPodRecovery.cfg",
  "command": "make",
  "args": ["-C", ".planning/formal/specs", "check-gke-pod-recovery"],
  "keywords": ["gke", "pod", "recovery", "kubernetes", "restart"],
  "requirements": ["INFRA-01", "INFRA-02"],
  "maturity": "draft",
  "description": "GKE pod recovery formal verification"
}
```

Key schema fields:
- `command` (string): executable name -- MUST be from ALLOWED_COMMANDS set
- `args` (string[]): arguments array -- NO shell interpretation
- `requirements` (string[]): requirement IDs for traceability
- `maturity` (string): one of "draft", "reviewed", "verified"
- `description` (string): human-readable description
- NO `check_command` free-form string field (this is the critical safety constraint)

**Part B: Add project manifest loading and matching to formal-scope-scan.cjs.**

1. Add constants at top near other path constants:
   ```javascript
   const PROJECT_MANIFEST_PATH = path.join(ROOT, '.planning', 'formal', 'specs', 'formal-checks.json');
   const PROJECT_SPECS_DIR = path.join(ROOT, '.planning', 'formal', 'specs');
   ```

2. Add `loadProjectManifest()` function (after `loadProximityIndex()`):
   - Read `PROJECT_MANIFEST_PATH` with `fs.existsSync` guard
   - Parse JSON, validate `version === 1` and `Array.isArray(data.specs)`
   - Validate each spec entry has required fields: `module`, `type`, `spec_path`, `command`, `args`
   - Reject entries where `command` or `args` are missing (warn to stderr, skip entry)
   - Return `data.specs` array or empty array on any error (fail-open)
   - Write warnings to stderr on parse errors (never stdout -- hook protocol)

3. Add `scanUnregisteredSpecs(manifestSpecs)` function:
   - Scan `PROJECT_SPECS_DIR` for `*.tla`, `*.als`, `*.pm` files using `fs.readdirSync`
   - Build set of spec_path values from manifestSpecs
   - For each file found that is NOT in the manifest's spec_path set, add to `unregistered` array
   - Return array of `{ file, type }` objects (type derived from extension)
   - Write to stderr: `[formal-scope-scan] INFO: N unregistered spec file(s) in .planning/formal/specs/: file1.tla, file2.als`
   - Fail-open: if directory doesn't exist or read fails, return empty array silently

4. Add `mergeProjectSpecsIntoRegistry(manifestSpecs, registryData)` function:
   - Takes manifest specs and the loaded model-registry data (or null)
   - For each manifest spec, creates a registry-compatible entry:
     ```javascript
     {
       version: 1,
       last_updated: new Date().toISOString(),
       update_source: "project_manifest",
       source_id: null,
       session_id: null,
       description: spec.description || "",
       layer_maturity: 3,
       gate_maturity: "SOFT_GATE",
       source_layer: "L3",
       requirements: spec.requirements || [],
       consecutive_pass_count: 0,
       source: "project",
       maturity: spec.maturity || "draft",
       project_command: { command: spec.command, args: spec.args }
     }
     ```
   - Merges into the registry models object using spec.spec_path as the key
   - Does NOT write to disk -- returns the merged in-memory view
   - If registryData is null, creates a minimal wrapper: `{ version: "1.0", models: {} }`
   - Existing registry entries with same key are NOT overwritten (nForma-internal wins)

5. Add `matchProjectSpecs(description, files, tokens)` function:
   - Call `loadProjectManifest()` to get specs array
   - For each spec entry, check:
     a. **Keyword match**: any token matches any keyword in `spec.keywords` (case-insensitive)
     b. **Module name match**: any token matches `spec.module` (case-insensitive)
     c. **File overlap**: if `--files` provided, check if any file starts with the directory containing `spec.spec_path`
   - Return array of matches with shape:
     ```javascript
     {
       module: spec.module,
       path: spec.spec_path,
       matched_by: 'project_manifest',
       spec_type: spec.type,
       source: 'project',
       requirements: spec.requirements || [],
       maturity: spec.maturity || 'draft'
     }
     ```

6. In `main()`, integrate project discovery:
   - AFTER the Layer 1 scope.json matching loop (after the `for (const mod of modules)` loop, ~line 941)
   - BEFORE the Layer 2 proximity enrichment call:
   ```javascript
   // Project-level manifest discovery (fail-open)
   const projectSpecs = loadProjectManifest();
   const projectMatches = matchProjectSpecs(args.description, args.files, tokens);
   for (const pm of projectMatches) {
     if (!matches.find(m => m.module === pm.module)) {
       matches.push(pm);
     }
   }

   // Report unregistered spec files
   scanUnregisteredSpecs(projectSpecs);

   // Merge project specs into registry view for bug-mode compatibility
   // (so bug-mode matching can also find project specs)
   ```

   - Also in the bug-mode branch: after `loadModelRegistry()`, call `mergeProjectSpecsIntoRegistry()` to include project specs in bug-mode matching:
   ```javascript
   if (args.bugMode) {
     const bugRegistry = loadModelRegistry();
     const projectSpecs = loadProjectManifest();
     const mergedRegistry = mergeProjectSpecsIntoRegistry(projectSpecs, bugRegistry);
     // Use mergedRegistry for bug mode matching instead of raw registry
   }
   ```

7. Export all new functions from `module.exports`: `loadProjectManifest`, `matchProjectSpecs`, `scanUnregisteredSpecs`, `mergeProjectSpecsIntoRegistry`.

**Important:**
- All error handling must be fail-open (try/catch returning empty)
- A malformed or missing manifest must never cause the scanner to fail
- stderr only for warnings/info, never stdout (hook protocol)
  </action>
  <verify>
1. `grep -c 'formal-checks.json' bin/formal-scope-scan.cjs` -- should be >= 2 (constant + loadProjectManifest)
2. `grep 'project_manifest' bin/formal-scope-scan.cjs` -- should show the matched_by value
3. `grep 'loadProjectManifest\|matchProjectSpecs\|scanUnregisteredSpecs\|mergeProjectSpecsIntoRegistry' bin/formal-scope-scan.cjs` -- should show all 4 function definitions and exports
4. `grep 'source.*project' bin/formal-scope-scan.cjs` -- should show the source: "project" marker in registry merge
5. `grep 'requirements\|maturity' bin/formal-scope-scan.cjs` -- should show traceability fields in match output
6. `node -e "const m = require('./bin/formal-scope-scan.cjs'); console.log(typeof m.loadProjectManifest, typeof m.matchProjectSpecs, typeof m.scanUnregisteredSpecs, typeof m.mergeProjectSpecsIntoRegistry)"` -- should print "function function function function"
7. With no manifest file present: `node bin/formal-scope-scan.cjs --description "test" --format json` -- should still return valid JSON (no crash)
8. Verify `.planning/formal/specs/formal-checks.json` exists and is valid JSON with version: 1 and specs: []
  </verify>
  <done>
- loadProjectManifest() reads .planning/formal/specs/formal-checks.json with fail-open, validates structured command/args fields
- matchProjectSpecs() matches description tokens against manifest keywords and module names, returns matches with source: "project", requirements, and maturity fields
- scanUnregisteredSpecs() reports .tla/.als/.pm files in specs/ not already in the manifest
- mergeProjectSpecsIntoRegistry() creates in-memory merged view with source: "project" marker, compatible with model-registry.json schema
- Project matches appear in output alongside nForma-internal matches with matched_by: "project_manifest"
- Missing/malformed manifest causes no errors (fail-open)
- No free-form check_command field exists anywhere in the schema
  </done>
</task>

<task type="auto">
  <name>Task 2: Add safe structured project check execution to run-formal-check.cjs and write tests</name>
  <files>bin/run-formal-check.cjs, bin/run-formal-check.test.cjs</files>
  <action>
**Part A: Extend run-formal-check.cjs to handle project-level modules with structured commands.**

1. Add constants at top:
   ```javascript
   const PROJECT_MANIFEST_PATH = path.join(process.cwd(), '.planning', 'formal', 'specs', 'formal-checks.json');
   // Allowlist of command roots -- only these executables can be invoked from manifest
   const ALLOWED_COMMANDS = new Set(['make', 'java', 'node', 'npm', 'npx', 'python3', 'python', 'sh']);
   ```

2. Add `loadProjectManifest()` function (same fail-open pattern as scope-scan):
   - Read and parse `PROJECT_MANIFEST_PATH`
   - Validate `version === 1` and `Array.isArray(data.specs)`
   - Validate each entry has `command` (string) and `args` (array) -- skip entries missing these fields with stderr warning
   - Return `data.specs` array or empty array on error
   - Warn on stderr, never crash

3. Add `runProjectCheck(spec, cwd)` function:
   - Takes a spec entry from the manifest and cwd
   - **Safety gate**: Check `ALLOWED_COMMANDS.has(spec.command)` -- if not allowed, return `{ module: spec.module, tool: spec.type, status: 'skipped', detail: 'command not in allowlist: ' + spec.command, runtimeMs: 0 }`
   - **Spec file pre-flight**: Check `fs.existsSync(path.join(cwd, spec.spec_path))` -- if missing, return skipped with detail 'spec file not found: ' + spec.spec_path
   - Execute via `spawnSync(spec.command, spec.args, { cwd, stdio: 'pipe', encoding: 'utf8', timeout: 180000 })`
   - DO NOT split any string on spaces -- command and args are already structured
   - Returns `{ module: spec.module, tool: spec.type, status, detail, runtimeMs }` following the same shape as existing `runCheck()`
   - Status logic: spawn error -> 'skipped', exit 0 -> 'pass', non-zero -> 'fail' with exit code detail
   - Fail-open: spawn errors produce 'skipped' not crash

4. In the main execution block, modify the module resolution loop. When a module is NOT found in `MODULE_CHECKS`, before pushing to `unknownModules`, check the project manifest:
   ```javascript
   if (!MODULE_CHECKS[module]) {
     const projectSpecs = loadProjectManifest();
     const projectSpec = projectSpecs.find(s => s.module === module);
     if (projectSpec) {
       const result = runProjectCheck(projectSpec, cwd);
       allResults.push(result);
       continue;
     }
     // Truly unknown
     process.stderr.write(`[run-formal-check] ERROR: unknown module "${module}" -- no checks registered\n`);
     unknownModules.push(module);
     continue;
   }
   ```
   Apply this same pattern in BOTH branches (the java-missing branch and the normal branch).

5. Export `loadProjectManifest`, `runProjectCheck`, and `ALLOWED_COMMANDS` from `module.exports`.

**Part B: Add/update tests in bin/run-formal-check.test.cjs.**

Add new tests (keep existing prism delegation tests intact):

```javascript
// Project manifest tests
test('loadProjectManifest returns empty array when no manifest exists', () => {
  // loadProjectManifest reads from cwd -- since no manifest in test env, should return []
  const { loadProjectManifest } = require('./run-formal-check.cjs');
  const specs = loadProjectManifest();
  assert.ok(Array.isArray(specs));
  assert.strictEqual(specs.length, 0);
});

test('ALLOWED_COMMANDS contains expected safe executables', () => {
  const { ALLOWED_COMMANDS } = require('./run-formal-check.cjs');
  assert.ok(ALLOWED_COMMANDS.has('make'));
  assert.ok(ALLOWED_COMMANDS.has('java'));
  assert.ok(ALLOWED_COMMANDS.has('node'));
  assert.ok(!ALLOWED_COMMANDS.has('rm'));
  assert.ok(!ALLOWED_COMMANDS.has('curl'));
});

test('runProjectCheck rejects command not in allowlist', () => {
  const { runProjectCheck } = require('./run-formal-check.cjs');
  const result = runProjectCheck({
    module: 'evil',
    type: 'tla',
    spec_path: 'fake.tla',
    command: 'rm',
    args: ['-rf', '/']
  }, process.cwd());
  assert.strictEqual(result.status, 'skipped');
  assert.ok(result.detail.includes('allowlist'));
});

test('runProjectCheck skips when spec file missing', () => {
  const { runProjectCheck } = require('./run-formal-check.cjs');
  const result = runProjectCheck({
    module: 'test-mod',
    type: 'tla',
    spec_path: 'nonexistent.tla',
    command: 'make',
    args: ['check']
  }, process.cwd());
  assert.strictEqual(result.status, 'skipped');
  assert.ok(result.detail.includes('spec file not found'));
});

test('runProjectCheck returns pass for successful command', () => {
  const { runProjectCheck } = require('./run-formal-check.cjs');
  // Use node -e "process.exit(0)" as a safe command that always succeeds
  // Create a temp spec file so pre-flight passes
  const fs = require('fs');
  const os = require('os');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfc-test-'));
  const specFile = path.join(tmpDir, 'test.tla');
  fs.writeFileSync(specFile, 'dummy');
  try {
    const result = runProjectCheck({
      module: 'test-pass',
      type: 'tla',
      spec_path: 'test.tla',
      command: 'node',
      args: ['-e', 'process.exit(0)']
    }, tmpDir);
    assert.strictEqual(result.status, 'pass');
    assert.strictEqual(result.module, 'test-pass');
    assert.ok(typeof result.runtimeMs === 'number');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('runProjectCheck returns fail for non-zero exit', () => {
  const { runProjectCheck } = require('./run-formal-check.cjs');
  const fs = require('fs');
  const os = require('os');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfc-test-'));
  const specFile = path.join(tmpDir, 'test.tla');
  fs.writeFileSync(specFile, 'dummy');
  try {
    const result = runProjectCheck({
      module: 'test-fail',
      type: 'tla',
      spec_path: 'test.tla',
      command: 'node',
      args: ['-e', 'process.exit(1)']
    }, tmpDir);
    assert.strictEqual(result.status, 'fail');
    assert.ok(result.detail.includes('Exit code'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('unknown module falls through to project manifest lookup', () => {
  // Run the CLI with a nonexistent module -- should show "unknown module" error since no manifest
  const result = spawnSync(process.execPath, [RUN_FORMAL_CHECK, '--modules=totally-fake-module'], {
    encoding: 'utf8', stdio: 'pipe', cwd: process.cwd()
  });
  assert.ok(result.stderr.includes('unknown module'));
});
```

Use `node:test` runner and `node:assert` (existing pattern in the test file). Keep all existing tests intact.

**Important:**
- NEVER use string splitting to derive command from a combined string
- ALLOWED_COMMANDS is the safety boundary -- document it clearly in code comments
- All error handling fail-open (try/catch -> skipped, never crash)
  </action>
  <verify>
1. `grep -c 'formal-checks.json' bin/run-formal-check.cjs` -- should be >= 2
2. `grep 'ALLOWED_COMMANDS' bin/run-formal-check.cjs` -- should show the allowlist constant and the guard check
3. `grep 'runProjectCheck\|loadProjectManifest' bin/run-formal-check.cjs` -- should show definitions and exports
4. `grep -c 'spec.command' bin/run-formal-check.cjs` -- should be >= 2 (allowlist check + spawnSync call)
5. Verify NO occurrence of `.split(' ')` or `.split(/\s/)` on any command string: `grep 'split.*command\|command.*split' bin/run-formal-check.cjs` -- should return nothing
6. `node -e "const m = require('./bin/run-formal-check.cjs'); console.log(typeof m.loadProjectManifest, typeof m.runProjectCheck, m.ALLOWED_COMMANDS instanceof Set)"` -- should print "function function true"
7. `node --test bin/run-formal-check.test.cjs` -- all tests pass (existing + new)
8. `node bin/run-formal-check.cjs --modules=nonexistent-module 2>&1` -- should show "unknown module" error (no manifest = unknown)
  </verify>
  <done>
- run-formal-check.cjs falls through to project manifest when module not in MODULE_CHECKS
- runProjectCheck() uses structured command/args fields from manifest -- NEVER splits a string
- ALLOWED_COMMANDS allowlist gates execution (rm, curl, etc. are blocked)
- Spec file existence is verified before running check (fail-open skip if missing)
- Tests cover: allowlist enforcement, missing manifest, missing spec file, pass/fail commands, unknown module fallthrough
- All error handling is fail-open
- No parallel registry created -- project specs integrate into model-registry.json via in-memory merge in scope-scan
  </done>
</task>

</tasks>

<verification>
- With no `.planning/formal/specs/formal-checks.json` present (rename the empty template), both scripts behave identically to before (no regression)
- With the empty template manifest (`specs: []`), both scripts behave identically to before
- Create a test manifest entry with a `module: "test-proj"`, `keywords: ["test"]`, `command: "node"`, `args: ["-e", "process.exit(0)"]`, then:
  - `node bin/formal-scope-scan.cjs --description "test project" --format json` includes a match with `matched_by: "project_manifest"` and `source: "project"` and `requirements` and `maturity` fields
  - `node bin/run-formal-check.cjs --modules=test-proj` runs the structured command and reports pass
- Verify ALLOWED_COMMANDS gate: a manifest entry with `command: "rm"` produces status: skipped
- `node --test bin/run-formal-check.test.cjs` -- all tests pass
- `npm run test:ci` passes (no regression to existing functionality)
- `grep 'check_command' bin/formal-scope-scan.cjs bin/run-formal-check.cjs` returns nothing (no free-form string execution)
- Remove the test manifest entries after verification
</verification>

<success_criteria>
1. formal-scope-scan.cjs discovers project-level specs from `.planning/formal/specs/formal-checks.json` manifest with structured command/args (not free-form string)
2. Project specs are merged INTO model-registry.json view in-memory with `source: "project"` marker -- no parallel registry file
3. Manifest entries carry traceability fields: requirements (array of req IDs), maturity (draft|reviewed|verified), description
4. scanUnregisteredSpecs() auto-discovers .tla/.als/.pm files in specs/ not in the manifest and reports them as suggestions
5. run-formal-check.cjs executes project-level checks via structured command/args with ALLOWED_COMMANDS allowlist gate
6. Both scripts are fully fail-open: missing/malformed manifest = no error, no crash, no change to existing behavior
7. Tests cover manifest loading, keyword matching, allowlist enforcement, check execution, and fail-open error paths
8. Existing nForma-internal spec discovery and checking is completely unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/369-implement-project-level-formal-spec-disc/369-01-SUMMARY.md`
</output>
