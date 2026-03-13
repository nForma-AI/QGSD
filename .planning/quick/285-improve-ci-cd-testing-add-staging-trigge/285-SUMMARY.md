---
phase: quick-285
plan: 01
type: execute
subsystem: CI/CD
tags: [ci, cd, staging, npm, workflows]
tech-stack:
  - GitHub Actions
  - Node.js (matrix: 18, 20, 22)
  - npm (pack, publish)
requirements:
  - CI-STAGING-01
  - CI-MATRIX-01
  - CI-PACK-01
  - CI-PUBLISH-01
decisions:
  - "Staging triggers added to ci.yml, ci-install.yml, and secret-scan.yml with 2 matches per file (push + PR branches)"
  - "ci.yml expanded to Node 18/20/22 matrix with strategy.fail-fast: false"
  - "npm pack --dry-run verification added to ci.yml (copied from release.yml pattern)"
  - "staging-publish.yml created with test → publish dependency, using npm-publish environment and NPM_TOKEN"
key-files:
  - created:
      - .github/workflows/staging-publish.yml
  - modified:
      - .github/workflows/ci.yml
      - .github/workflows/ci-install.yml
      - .github/workflows/secret-scan.yml
dependencies:
  - provides: "Staging branch CI/CD protection with multi-version testing and automated npm publishing"
  - affects: "GitHub Actions workflow execution on staging branch pushes and PRs"
---

# Phase Quick-285 Plan 01: Improve CI/CD Testing Summary

Improve CI/CD coverage: add staging branch triggers to ci.yml, ci-install.yml, and secret-scan.yml; expand ci.yml to a Node 18/20/22 matrix with npm pack verification; create staging-publish.yml for auto-publishing @staging dist-tag on staging pushes.

## Objective

Ensure staging branch gets the same CI protection as main, expand test coverage across supported Node versions, and enable automated staging pre-releases with verification steps to prevent test files in the published package.

## Tasks Completed

### Task 1: Add staging triggers and Node matrix to existing workflows

**Status:** COMPLETE

**Changes:**

1. **ci.yml** — Three enhancements applied:
   - Added `staging` to both push.branches and pull_request.branches
   - Converted test job to use Node matrix: `['18', '20', '22']` with `strategy.fail-fast: false`
   - Updated job name to `Unit tests (Node ${{ matrix.node }})`
   - Updated setup-node to use `node-version: ${{ matrix.node }}`
   - Added npm pack --dry-run verification step after "Run TUI unit tests" step (exact copy from release.yml pattern)

2. **ci-install.yml** — Trigger addition:
   - Added `staging` to push.branches: `[main, staging]`
   - Added `staging` to pull_request.branches: `[main, staging]`
   - Kept existing paths filters intact

3. **secret-scan.yml** — Trigger addition:
   - Added `staging` to push.branches: `[main, staging]`
   - Added `staging` to pull_request.branches: `[main, staging]`

**Verification:**
- `grep -c 'staging'` output: ci.yml=2, ci-install.yml=2, secret-scan.yml=2 (push + PR branches)
- `grep "matrix"` confirms Node matrix configuration present
- `grep "npm pack"` confirms verification step present
- All YAML syntax valid

**Commit:** b3de0ef9 — feat(quick-285): add staging triggers and Node matrix to CI workflows

### Task 2: Create staging-publish.yml workflow

**Status:** COMPLETE

**Changes:**

Created `.github/workflows/staging-publish.yml` with:

- **Trigger:** push to staging branch only (no PRs, no tags)
- **test job:**
  - Runs on ubuntu-latest, 10-minute timeout
  - Node 20 (stable), npm ci --ignore-scripts
  - Full pre-publish test pipeline: build:hooks, build:machines, check:assets, test:ci, test:tui
  - npm pack --dry-run verification (prevents test files in distribution)
- **publish-staging job:**
  - Depends on test job completion (needs: test)
  - Uses npm-publish environment and NPM_TOKEN secret
  - Sets registry-url and scope for @nforma.ai namespace
  - Runs npm publish with:
    - `--access public` (public registry)
    - `--tag staging` (publishes as @staging dist-tag, does NOT affect latest)
    - `--provenance` flag (enables SLSA provenance)
  - Includes id-token: write permission for provenance generation

**Verification:**
- File exists at correct path
- Contains `--tag staging` flag
- References NPM_TOKEN secret
- publish-staging depends on test job
- Includes npm pack verification step

**Commit:** b18e97d5 — feat(quick-285): create staging-publish workflow for auto-publish

## Verification Results

All plan success criteria met:

1. ✓ All 4 workflow files exist and contain valid YAML
2. ✓ `grep -r staging .github/workflows/` shows staging in:
   - ci.yml (2 occurrences)
   - ci-install.yml (2 occurrences)
   - secret-scan.yml (2 occurrences)
   - formal-verify.yml (already present, not modified per plan)
   - staging-publish.yml (new file)
3. ✓ ci.yml matrix includes Node 18, 20, 22 with fail-fast: false
4. ✓ ci.yml includes npm pack --dry-run verification (prevents test files in package)
5. ✓ staging-publish.yml publishes with --tag staging, gated by test job

## Deviations from Plan

None — plan executed exactly as written.

## Duration

Execution time: ~5 minutes
- Task 1: ~2 minutes (3 file modifications)
- Task 2: ~2 minutes (1 new file creation)
- Verification & documentation: ~1 minute

## Notes

- staging-publish.yml follows the exact pattern from release.yml for test-before-publish gating
- Node matrix in ci-install.yml already covered OS variations (ubuntu-latest, macos-latest); ci.yml matrix focuses on Node version coverage
- npm pack verification uses same test-file detection pattern as release.yml (grep for `.test.` files)
- All workflows maintain backward compatibility with main branch (no changes to main branch triggers)
- Staging branch now has feature parity with main for CI protection and additional publishing capability
