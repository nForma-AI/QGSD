---
phase: quick-197
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - test/install-virgin.test.cjs
  - .github/workflows/ci-install.yml
  - Dockerfile.test-install
  - package.json
autonomous: true
requirements: [CI-INSTALL-01]
formal_artifacts: none

must_haves:
  truths:
    - "Virgin install for Claude runtime produces correct file layout in temp dir"
    - "Virgin install for OpenCode runtime produces correct file layout with flat command/ structure"
    - "Virgin install for Gemini runtime produces correct file layout"
    - "Content adaptation is verified per runtime (OpenCode frontmatter, Gemini agent conversion, hook config dir)"
    - "CI workflow runs install tests on ubuntu + macOS with Node 18, 20, 22"
    - "Idempotent re-install produces identical layout (OverridesPreserved invariant)"
  artifacts:
    - path: "test/install-virgin.test.cjs"
      provides: "Virgin install integration tests for all 3 runtimes"
      min_lines: 150
    - path: ".github/workflows/ci-install.yml"
      provides: "GitHub Actions workflow with OS x Node matrix"
      contains: "matrix"
  key_links:
    - from: "test/install-virgin.test.cjs"
      to: "bin/install.js"
      via: "execFileSync (safe, no shell injection) with --config-dir flag"
      pattern: "execFileSync.*install\\.js.*--config-dir"
    - from: ".github/workflows/ci-install.yml"
      to: "test/install-virgin.test.cjs"
      via: "node --test"
      pattern: "node --test.*install-virgin"
---

<objective>
Add virgin install integration tests for all 3 runtimes (Claude, OpenCode, Gemini) and a CI workflow that runs them on a multi-OS x multi-Node matrix.

Purpose: The installer (`bin/install.js`) is the primary user-facing entry point but has zero automated test coverage for the actual install flow. A regression in file layout or content adaptation breaks every new user. This task closes that gap.

Output: `test/install-virgin.test.cjs` (test suite), `.github/workflows/ci-install.yml` (matrix CI), updated `Dockerfile.test-install` (rebrand fix), `package.json` (test:install script).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/install.js (the installer under test)
@.github/workflows/ci.yml (existing CI workflow)
@package.json (test scripts)
@.planning/formal/spec/installer/invariants.md (OverridesPreserved invariant)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create virgin install integration test suite</name>
  <files>test/install-virgin.test.cjs</files>
  <action>
Create `test/install-virgin.test.cjs` using Node.js built-in `node:test` and `node:assert` (matching project pattern from existing tests like `bin/conformance-schema.test.cjs`).

The test invokes `bin/install.js` via `require('node:child_process').execFileSync` against temp directories created with `fs.mkdtempSync`. Each runtime gets its own temp dir via `--config-dir`. The test MUST NOT touch the user's real home directory. Use `execFileSync` (NOT `exec`) — it is the safe variant that does not spawn a shell and prevents injection.

**Test structure — 3 runtime describe blocks (claude, opencode, gemini), each with these test cases:**

1. **File layout** — After `node bin/install.js --{runtime} --global --config-dir {tmpDir}`:
   - `{tmpDir}/nf/` directory exists and contains `.md` files (workflows)
   - `{tmpDir}/nf/VERSION` exists and contains the version from `package.json`
   - `{tmpDir}/nf-bin/` directory exists and contains `.cjs` files
   - `{tmpDir}/hooks/` directory exists and contains `.js` files (nf-stop.js, nf-prompt.js, nf-circuit-breaker.js at minimum)
   - `{tmpDir}/agents/` directory exists and contains `.md` files
   - `{tmpDir}/nf.json` exists and is valid JSON
   - `{tmpDir}/settings.json` exists and is valid JSON with hooks configured
   - `{tmpDir}/package.json` exists and contains `{"type":"commonjs"}`
   - For Claude/Gemini: `{tmpDir}/commands/nf/` exists with `.md` files
   - For OpenCode: `{tmpDir}/command/` exists with `nf-*.md` files (flat structure)

2. **Content adaptation** — Read specific installed files and assert:
   - Claude hooks contain `'.claude'` in path.join calls
   - OpenCode hooks contain `'.config', 'opencode'` in path.join calls
   - Gemini hooks contain `'.gemini'` in path.join calls
   - OpenCode command files do NOT have `---` YAML frontmatter (converted to TOML-style)
   - OpenCode agent files have TOML frontmatter (not YAML `---`)

3. **Idempotency** — Run the same install command twice into the same tmpDir:
   - Second run exits 0
   - File count is identical before and after
   - VERSION file content is identical
   - This validates the OverridesPreserved formal invariant from `installer/invariants.md`

**Implementation details:**
- Use `before()` / `after()` hooks per describe block to create/cleanup temp dirs via `fs.mkdtempSync(path.join(os.tmpdir(), 'nf-install-test-'))` and `fs.rmSync(tmpDir, { recursive: true, force: true })`
- The install command is: `process.execPath` (current node), `[path.join(__dirname, '..', 'bin', 'install.js'), '--{runtime}', '--global', '--config-dir', tmpDir]`
- Set `stdio: 'pipe'` to capture output, `timeout: 30000` to prevent hangs
- Helper function `countFiles(dir, ext)` to recursively count files with a given extension
- Helper function `readIfExists(filePath)` that returns file content or null
- All assertions use `node:assert/strict`

**Do NOT:**
- Import or require install.js directly (it has side effects and calls process.exit)
- Use any npm test runner (no jest, no mocha) — use `node:test` only
- Touch any real config directories
  </action>
  <verify>
Run: `node --test test/install-virgin.test.cjs`
All tests pass. Verify stdout shows 3 runtime blocks with all subtests passing.
Also verify no files were written outside of /tmp/ by checking `~/.claude/` modification time is unchanged.
  </verify>
  <done>
Virgin install tests exist for all 3 runtimes covering file layout, content adaptation, and idempotency. All tests pass locally on the developer machine.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create CI install workflow and update stale Dockerfile</name>
  <files>.github/workflows/ci-install.yml, Dockerfile.test-install, package.json</files>
  <action>
**A) Create `.github/workflows/ci-install.yml`:**

```yaml
name: CI Install Tests

on:
  push:
    branches: [main]
    paths:
      - 'bin/install.js'
      - 'hooks/dist/**'
      - 'commands/**'
      - 'agents/**'
      - 'core/**'
      - 'test/install-virgin.test.cjs'
      - '.github/workflows/ci-install.yml'
  pull_request:
    branches: [main]
    paths:
      - 'bin/install.js'
      - 'hooks/dist/**'
      - 'commands/**'
      - 'agents/**'
      - 'core/**'
      - 'test/install-virgin.test.cjs'
      - '.github/workflows/ci-install.yml'

jobs:
  install-test:
    name: Install (${{ matrix.os }}, Node ${{ matrix.node }})
    runs-on: ${{ matrix.os }}
    timeout-minutes: 10
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: ['18', '20', '22']

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js ${{ matrix.node }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}

      - name: Install dependencies
        run: npm ci

      - name: Build hooks
        run: npm run build:hooks

      - name: Run install tests
        run: node --test test/install-virgin.test.cjs
```

Key design choices:
- `paths` filter ensures this only runs when installer-related files change (not on every push)
- `fail-fast: false` so all matrix combinations run even if one fails
- No Windows in matrix (install.js uses forward-slash normalization but hooks reference $HOME which is shell-specific; Windows support is not currently claimed)
- `build:hooks` step required because install.js copies from `hooks/dist/` which must be built first

**B) Update `Dockerfile.test-install`:**

Replace stale QGSD references with nForma. Change the final verification line from `'QGSD ' + pkg.version` to `'nForma ' + pkg.version`. Update the build comment at top from `qgsd-test-install` to `nforma-test-install`. This file is unused in CI but should not have stale branding.

**C) Add `test:install` script to `package.json`:**

Add to the `scripts` section:
```
"test:install": "node --test test/install-virgin.test.cjs"
```

Place it after the `test:formal` line. This gives a convenient `npm run test:install` shortcut. Do NOT add it to the `test:ci` script — install tests are heavier (spawns 3 child processes) and run in their own CI workflow.
  </action>
  <verify>
1. Validate YAML syntax: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci-install.yml'))"`
2. Verify Dockerfile has no QGSD references: `grep -c QGSD Dockerfile.test-install` returns 0
3. Verify package.json has test:install script: `node -e "const p=require('./package.json'); console.log(p.scripts['test:install']);"`
4. Run `npm run test:install` locally to confirm the shortcut works
  </verify>
  <done>
CI workflow exists with ubuntu+macOS x Node 18/20/22 matrix, path-filtered to installer-related changes. Dockerfile rebranded. package.json has test:install shortcut. All verification commands pass.
  </done>
</task>

</tasks>

<verification>
1. `npm run test:install` passes (all 3 runtimes, all test cases)
2. `.github/workflows/ci-install.yml` exists with correct matrix
3. `Dockerfile.test-install` has no QGSD references
4. No files written outside /tmp/ during test runs
5. Existing `npm run test:ci` still passes (no interference)
</verification>

<success_criteria>
- Virgin install test suite covers Claude, OpenCode, and Gemini runtimes
- Each runtime verifies: file layout (9+ assertions), content adaptation (3+ assertions), idempotency (3+ assertions)
- CI workflow runs on 6 matrix combinations (2 OS x 3 Node versions)
- CI workflow is path-filtered to avoid unnecessary runs
- All existing tests remain green
</success_criteria>

<output>
After completion, create `.planning/quick/197-add-ci-virgin-install-tests-and-workflow/197-SUMMARY.md`
</output>
