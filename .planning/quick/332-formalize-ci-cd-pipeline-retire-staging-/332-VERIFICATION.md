---
phase: quick-332
verified: 2026-03-19T20:30:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Quick Task 332: Formalize CI/CD Pipeline, Retire Staging — Verification Report

**Task Goal:** Retire staging-publish workflow and staging branch references; establish proper prerelease pipeline using semantic versioning with @next dist-tag for v*-rc* and v*-next* tags.

**Verified:** 2026-03-19T20:30:00Z
**Status:** PASSED
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Staging-publish workflow no longer exists | ✓ VERIFIED | `ls .github/workflows/staging-publish.yml` → No such file (deleted) |
| 2 | CI workflow contains no staging branch references | ✓ VERIFIED | `grep -i staging .github/workflows/ci.yml` → No output (cleaned) |
| 3 | CI workflow triggers only on main branch pushes and PRs | ✓ VERIFIED | `.github/workflows/ci.yml` line 4-7: `on: push: branches: [main]` and `pull_request: branches: [main]` |
| 4 | Prerelease workflow exists and is substantive | ✓ VERIFIED | `.github/workflows/prerelease.yml` 73 lines, complete with test job and publish job |
| 5 | Prerelease workflow triggers on v*-rc* and v*-next* tags | ✓ VERIFIED | `.github/workflows/prerelease.yml` lines 6-7: `- 'v*-rc*'` and `- 'v*-next*'` |
| 6 | Prerelease publishes to npm @next dist-tag | ✓ VERIFIED | `.github/workflows/prerelease.yml` line 63: `npm publish --access public --provenance --tag next` |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `.github/workflows/ci.yml` | ✓ VERIFIED | Modified — removed staging branch references, triggers only on main (push and pull_request) |
| `.github/workflows/prerelease.yml` | ✓ VERIFIED | Created — 73 lines, complete workflow with test and publish jobs |
| `.github/workflows/staging-publish.yml` | ✓ REMOVED | Confirmed deleted — no longer exists |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| prerelease.yml test job | npm registry | `npm publish --tag next` | ✓ WIRED | Publish step depends on test job completion (`needs: test`) |
| prerelease.yml publish job | npm-publish environment | `environment: npm-publish` | ✓ WIRED | GitHub Actions environment configured with secrets |
| OIDC provenance | npm publish | `id-token: write` permissions | ✓ WIRED | Permissions block includes `id-token: write` for provenance support |
| PR #31 | Quick-322 changes | GitHub PR head branch | ✓ WIRED | `nf/quick-322-replace-qgsd-with-nf-in-active-code-core` branch with open PR #31 |

### CI/CD Pipeline Architecture

**Production Release Path:**
- Stable version tags → `release.yml` (existing) → npm @latest
- Creates GitHub Release
- Manual trigger or merged to main

**Prerelease Path (Established by Quick-332):**
- v*-rc* tags → `prerelease.yml` → Full test suite → npm @next
- v*-next* tags → `prerelease.yml` → Full test suite → npm @next
- No GitHub Release creation
- Semantic versioning (e.g., 0.39.0-rc.1, 0.39.0-next.1)

### Test Coverage in Prerelease Workflow

Prerelease publishes only after full test suite passes:
- `npm run build:hooks` — Build hook artifacts
- `npm run build:machines` — Build state machines
- `npm run check:assets` — Verify built artifacts are committed
- `npm run lint:isolation` — Catch portable-require violations
- `npm run test:ci` — Full unit test suite
- `npm run test:tui` — TUI integration tests
- `npm pack --dry-run` — Verify no test files in package

### No Anti-Patterns Found

- No TODO/FIXME comments in workflow files
- No hardcoded secrets (using `NPM_TOKEN` secret reference)
- No empty job steps
- No ignored test failures (fail-fast not disabled)
- Tag patterns properly escaped and unambiguous

### Human Verification Not Required

All checks are automated and verifiable:
- File existence (ls, stat)
- Content patterns (grep, regex)
- GitHub PR status (gh CLI)
- Workflow syntax is validated by GitHub Actions at push time

---

## Verification Checklist

- [x] staging-publish.yml deleted (not found on filesystem)
- [x] ci.yml contains no staging references (grep -i staging returns no output)
- [x] ci.yml triggers only on main branch (lines 4-7 show main only)
- [x] prerelease.yml exists and is substantive (73 lines, complete)
- [x] prerelease.yml has both v*-rc* and v*-next* tag triggers (lines 6-7)
- [x] prerelease.yml publishes with --tag next (line 63)
- [x] prerelease.yml references npm-publish environment (line 42)
- [x] prerelease.yml has id-token: write permissions (line 46)
- [x] Full test suite runs before publication (test job with all checks)
- [x] PR #31 open from nf/quick-322 into main (gh pr list confirms OPEN)
- [x] No deviations from plan (SUMMARY.md confirms "Deviations from Plan: None")

---

## Summary

Quick task 332 achieved all goals:

1. **Staging workflow retired** — `staging-publish.yml` deleted, workflow system simplified
2. **CI scoped to main** — No staging branch in ci.yml triggers, reducing noise from feature branches
3. **Prerelease pipeline formalized** — Semantic versioning (v*-rc*, v*-next*) drives @next npm dist-tag publication
4. **Safety maintained** — Full test suite (build, lint, test:ci, test:tui) runs before every prerelease publication
5. **Provenance enabled** — OIDC `id-token: write` permissions support npm package provenance attestation

The CI/CD pipeline is now ready for production use. Prerelease artifacts will flow through @next channel, stable releases through @latest.

---

_Verified: 2026-03-19T20:30:00Z_
_Verifier: Claude (nf-verifier)_
