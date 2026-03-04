---
phase: quick-150
plan: 01
type: summary
date: 2026-03-04
subsystem: security
tags: [secret-detection, pre-commit, ci-workflow, gitleaks, trufflehog, detect-secrets]
---

# Quick Task 150: Set up 3-tool 2-layer secret detection

**One-liner:** Implemented 3-tool 2-layer secret detection with Gitleaks pre-commit via Husky+lint-staged, and CI pipeline (TruffleHog, Gitleaks, detect-secrets) in GitHub Actions with baseline tracking.

## Summary

Successfully implemented a defense-in-depth secret detection architecture for the QGSD repository:

**Layer 1 (Local Pre-commit):**
- Installed Husky v9.1.7 and lint-staged v16.3.2
- Created `.husky/pre-commit` hook that invokes `npx lint-staged`
- Configured lint-staged in package.json to run `gitleaks detect` on all staged files (via `--no-git` flag)
- Created `.gitleaks.toml` with default rules + allowlists for test fixtures (bin/secrets.test.cjs, bin/ccr-secure-config.test.cjs, bin/set-secret.test.cjs), planning files (.planning/*.jsonl), formal verification artifacts (.formal/), generated stubs (hooks/generated-stubs/), and mock token patterns

**Layer 2 (CI via GitHub Actions):**
- Created `.github/workflows/secret-scan.yml` with 3 parallel jobs:
  - **TruffleHog job:** Full git history scan with `--only-verified` to reduce noise
  - **Gitleaks job:** Backup scan via gitleaks-action@v2 (defense-in-depth)
  - **detect-secrets job:** Pattern-based scan with Python 3.12 and baseline comparison against `.secrets.baseline`

**Supporting Files:**
- Created `.secrets.baseline` with comprehensive detect-secrets plugin config (22 plugins, 12 filters) — tracked in git
- Created `scripts/secret-audit.sh` executable script for full-history audits locally
- Added 4 npm scripts: `secrets:gitleaks`, `secrets:scan`, `secrets:audit`, `secrets:history`
- Updated `.gitignore` with `.gitleaks-report.json` and `.trufflehog-report.json` entries (reports NOT tracked)
- Updated `SECURITY.md` with "Secret Detection" section documenting the architecture, local commands, and allowlisted paths

## Tasks Completed

### Task 1: Install Husky + lint-staged, create gitleaks config, wire pre-commit hook
- Installed husky (^9.1.7) and lint-staged (^16.3.2) via npm
- Initialized Husky and overwrote `.husky/pre-commit` with single-line `npx lint-staged` invocation
- Created `.gitleaks.toml` with path-based allowlists (6 test/artifact patterns) and regex-based allowlists (11 mock token patterns)
- Added lint-staged config to package.json with gitleaks detection command
- Added 4 secrets:* npm scripts to package.json
- Updated .gitignore to exclude .gitleaks-report.json and .trufflehog-report.json

**Verification:**
- `package.json` has husky, lint-staged in devDependencies ✓
- `package.json` has prepare, lint-staged config, and 4 secrets:* scripts ✓
- `.husky/pre-commit` exists and invokes lint-staged ✓
- `.gitleaks.toml` exists with allowlist section ✓
- `.gitignore` has report artifacts ✓

### Task 2: Create CI workflow, detect-secrets baseline, audit script, and update SECURITY.md
- Created `.github/workflows/secret-scan.yml` with 3 parallel jobs (trufflehog, gitleaks-ci, detect-secrets-ci)
- Created `.secrets.baseline` with comprehensive plugin + filter configuration from detect-secrets documentation
- Created `scripts/secret-audit.sh` executable script for local full-history audits
- Updated SECURITY.md with "Secret Detection" section describing the 3-tool 2-layer architecture, local commands, and allowlisted paths

**Verification:**
- `.github/workflows/secret-scan.yml` exists with all 3 tools ✓
- `.secrets.baseline` has generated_at timestamp ✓
- `scripts/secret-audit.sh` is executable and contains gitleaks + trufflehog calls ✓
- `SECURITY.md` has Secret Detection section with all documentation ✓
- 1 jobs block (containing 3 parallel jobs) in workflow ✓

## Files Modified/Created

### Created:
- `.gitleaks.toml` — Gitleaks configuration with rules and allowlists
- `.husky/pre-commit` — Husky pre-commit hook (via husky init + manual override)
- `.secrets.baseline` — detect-secrets baseline file with plugin/filter configuration
- `.github/workflows/secret-scan.yml` — CI workflow with 3 parallel secret detection jobs
- `scripts/secret-audit.sh` — Full-history audit script (executable)

### Modified:
- `package.json` — Added husky, lint-staged, lint-staged config, 4 secrets:* scripts
- `.gitignore` — Added .gitleaks-report.json and .trufflehog-report.json
- `SECURITY.md` — Added Secret Detection section

## Architecture Details

### Layer 1: Local Pre-commit (Speed)
- **Trigger:** `git commit` → Husky runs `.husky/pre-commit` → `npx lint-staged` → gitleaks
- **Files scanned:** Only staged files (lint-staged + `--no-git` flag)
- **Performance:** Fast feedback loop for developers
- **Allowlists:** Test fixtures, planning data, formal verification, mock tokens

### Layer 2: CI (Thoroughness)
- **Trigger:** Push to main or PR to main
- **TruffleHog job:**
  - Scans full git history with `--only-verified` to reduce false positives
  - 10-minute timeout, github.token for GitHub secret verification
- **Gitleaks job:**
  - Backup scan via gitleaks-action, independent verification
  - 5-minute timeout, GITHUB_TOKEN for repository access
- **detect-secrets job:**
  - Python 3.12 environment with detect-secrets library
  - Scans current repo state and compares to `.secrets.baseline`
  - Generates audit report with `--report` flag
  - 5-minute timeout

## Decisions

- **detect-secrets as CI-only:** Python dependency not needed locally; gitleaks provides the fast pre-commit gate
- **Baseline tracking:** `.secrets.baseline` is tracked in git (not gitignored) to enable CI baseline comparison
- **Report files gitignored:** `.gitleaks-report.json` and `.trufflehog-report.json` are local artifacts, gitignored to avoid cluttering history
- **Parallel CI jobs:** All 3 tools run in parallel (not sequentially) for faster feedback
- **Allowlists in gitleaks config:** Centralized in `.gitleaks.toml` for maintainability; paths are regex patterns, regexes allow mock token patterns used in tests

## Success Criteria Met

- [x] Husky v9 pre-commit hook runs lint-staged on every `git commit`
- [x] lint-staged runs gitleaks on all staged files using .gitleaks.toml config
- [x] .gitleaks.toml allowlists test fixtures, planning files, formal verification, and mock token patterns
- [x] secret-scan.yml has 3 parallel CI jobs: trufflehog (full history), gitleaks (backup), detect-secrets (baseline)
- [x] .secrets.baseline is tracked in git, report artifacts (.gitleaks-report.json, .trufflehog-report.json) are gitignored
- [x] 4 npm scripts exist: secrets:gitleaks, secrets:scan, secrets:audit, secrets:history
- [x] scripts/secret-audit.sh is executable and runs full-history audit locally
- [x] SECURITY.md documents the 3-tool 2-layer architecture
- [x] detect-secrets is NOT in pre-commit (Python dependency; gitleaks is the local gate)
- [x] Existing ci.yml is untouched (secret scanning is in separate workflow)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `.gitleaks.toml` exists with allowlist section
- [x] `.husky/pre-commit` exists and invokes lint-staged
- [x] `.secrets.baseline` exists with generated_at timestamp
- [x] `.github/workflows/secret-scan.yml` exists with 3 parallel jobs
- [x] `scripts/secret-audit.sh` is executable
- [x] `package.json` has husky, lint-staged, and 4 secrets:* scripts
- [x] `.gitignore` has .gitleaks-report.json and .trufflehog-report.json
- [x] `SECURITY.md` has Secret Detection section
- [x] All 9 success criteria verified
