---
phase: quick-285
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/ci.yml
  - .github/workflows/ci-install.yml
  - .github/workflows/secret-scan.yml
  - .github/workflows/staging-publish.yml
autonomous: true
formal_artifacts: none
requirements: [CI-STAGING-01, CI-MATRIX-01, CI-PACK-01, CI-PUBLISH-01]

must_haves:
  truths:
    - "CI workflow triggers on both main and staging branch pushes"
    - "CI install workflow triggers on both main and staging branch pushes"
    - "Secret scan workflow triggers on both main and staging branch pushes"
    - "CI workflow tests across Node 18, 20, and 22"
    - "CI workflow verifies npm pack produces no test files"
    - "Staging branch push auto-publishes to npm with @staging dist-tag"
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "CI with staging triggers, Node matrix, npm pack check"
      contains: "staging"
    - path: ".github/workflows/ci-install.yml"
      provides: "Install tests with staging trigger"
      contains: "staging"
    - path: ".github/workflows/secret-scan.yml"
      provides: "Secret scan with staging trigger"
      contains: "staging"
    - path: ".github/workflows/staging-publish.yml"
      provides: "Auto-publish @staging dist-tag on staging push"
      contains: "npm publish"
  key_links:
    - from: ".github/workflows/staging-publish.yml"
      to: "npm registry"
      via: "npm publish --tag staging"
      pattern: "npm publish.*--tag staging"
    - from: ".github/workflows/ci.yml"
      to: "Node matrix"
      via: "strategy.matrix.node"
      pattern: "node.*18.*20.*22"
---

<objective>
Improve CI/CD coverage: add staging branch triggers to ci.yml, ci-install.yml, and secret-scan.yml; expand ci.yml to a Node 18/20/22 matrix with npm pack verification; create staging-publish.yml for auto-publishing @staging dist-tag on staging pushes.

Purpose: Ensure staging branch gets the same CI protection as main, expand test coverage across supported Node versions, and enable automated staging pre-releases.
Output: 4 workflow files updated/created.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.github/workflows/ci.yml
@.github/workflows/ci-install.yml
@.github/workflows/secret-scan.yml
@.github/workflows/release.yml
@.github/workflows/formal-verify.yml
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add staging triggers and Node matrix to existing workflows</name>
  <files>.github/workflows/ci.yml, .github/workflows/ci-install.yml, .github/workflows/secret-scan.yml</files>
  <action>
1. **ci.yml** — Three changes:
   a. Add `staging` to push branches: `branches: [main, staging]`. Add `staging` to pull_request branches: `branches: [main, staging]`.
   b. Convert the `test` job to use a matrix strategy matching ci-install.yml pattern:
      - `strategy.fail-fast: false`
      - `matrix.node: ['18', '20', '22']`
      - Keep `runs-on: ubuntu-latest` (no OS matrix needed — ci-install already covers macOS)
      - Update job name to `Unit tests (Node ${{ matrix.node }})`
      - Update `setup-node` to use `node-version: ${{ matrix.node }}`
   c. Add an `npm pack --dry-run` verification step AFTER the "Run TUI unit tests" step. Copy the "Verify package contents" step from release.yml exactly (the block that checks for test files in the pack output).

2. **ci-install.yml** — Add `staging` to push branches: `branches: [main, staging]`. Add `staging` to pull_request branches: `branches: [main, staging]`. Keep existing paths filters intact.

3. **secret-scan.yml** — Add `staging` to push branches: `branches: [main, staging]`. Add `staging` to pull_request branches: `branches: [main, staging]`.

Do NOT modify formal-verify.yml (already has staging).
  </action>
  <verify>
Run: `grep -c 'staging' .github/workflows/ci.yml .github/workflows/ci-install.yml .github/workflows/secret-scan.yml` — each file must show at least 2 matches (push + PR branches).
Run: `grep "matrix" .github/workflows/ci.yml` — must show matrix configuration.
Run: `grep "npm pack" .github/workflows/ci.yml` — must show pack dry-run step.
Validate YAML syntax: `node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); require('assert')(y.includes('staging')); console.log('OK')"` (repeat for each file).
  </verify>
  <done>
ci.yml has staging triggers, Node 18/20/22 matrix, and npm pack verification step.
ci-install.yml has staging triggers on both push and pull_request.
secret-scan.yml has staging triggers on both push and pull_request.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create staging-publish.yml workflow</name>
  <files>.github/workflows/staging-publish.yml</files>
  <action>
Create `.github/workflows/staging-publish.yml` with the following structure:

```yaml
name: Staging Publish

on:
  push:
    branches: [staging]

jobs:
  test:
    name: Pre-publish tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - Checkout (actions/checkout@v4)
      - Setup Node 20 (actions/setup-node@v4)
      - npm ci --ignore-scripts
      - npm run build:hooks && npm run build:machines
      - npm run check:assets
      - npm run test:ci
      - npm run test:tui
      - Verify package contents (same npm pack --dry-run block from release.yml)

  publish-staging:
    name: Publish @staging to npm
    needs: test
    runs-on: ubuntu-latest
    environment: npm-publish
    timeout-minutes: 10
    permissions:
      contents: read
      id-token: write
    steps:
      - Checkout (actions/checkout@v4)
      - Setup Node 20 with registry-url 'https://registry.npmjs.org' and scope '@nforma.ai'
      - npm install -g npm@latest
      - npm ci
      - npm run build:hooks
      - npm publish --access public --tag staging --provenance
        env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Key details:
- Only triggers on push to staging (not PRs, not tags)
- Runs full test suite before publishing (same gates as release.yml)
- Uses `--tag staging` so it publishes as `@staging` dist-tag (does NOT affect `latest`)
- Uses same `npm-publish` environment and `NPM_TOKEN` secret as release.yml
- Includes `--provenance` flag and `id-token: write` permission like release.yml
  </action>
  <verify>
Run: `cat .github/workflows/staging-publish.yml` — file must exist.
Run: `grep "tag staging" .github/workflows/staging-publish.yml` — must find the --tag staging flag.
Run: `grep "NPM_TOKEN" .github/workflows/staging-publish.yml` — must reference the secret.
Run: `grep "needs: test" .github/workflows/staging-publish.yml` — publish job must depend on test job.
Run: `grep "npm pack" .github/workflows/staging-publish.yml` — must include pack verification.
  </verify>
  <done>
staging-publish.yml exists and will auto-publish with @staging dist-tag when code is pushed to the staging branch, gated behind the full test suite.
  </done>
</task>

</tasks>

<verification>
1. All 4 workflow files exist and contain valid YAML
2. `grep -r staging .github/workflows/` shows staging in ci.yml, ci-install.yml, secret-scan.yml, formal-verify.yml, and staging-publish.yml
3. ci.yml matrix includes Node 18, 20, 22
4. ci.yml includes npm pack --dry-run verification
5. staging-publish.yml publishes with --tag staging, gated by tests
</verification>

<success_criteria>
- All workflows trigger on staging branch (push and PR where applicable)
- CI runs across Node 18, 20, 22 matrix
- npm pack --dry-run verification runs in CI (not just release)
- Staging publish workflow auto-publishes @staging tag after tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/285-improve-ci-cd-testing-add-staging-trigge/285-SUMMARY.md`
</output>
