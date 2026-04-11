---
phase: 55
slug: remediation-enrichment
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-08
---

# Phase 55 — Validation Strategy

> Populated by `/nf:plan-phase 55` (step 11.5) after plan-checker approval.
> Governs feedback sampling during `/nf:execute-phase 55`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | none (native test runner) |
| **Quick run command** | `node --test bin/formal-test-sync.test.cjs` |
| **Full suite command** | `npm run test:ci` |
| **Estimated runtime** | ~60 seconds |
| **CI pipeline** | `.github/workflows/` — existing CI pipeline |

---

## Nyquist Sampling Rate

- **After every task commit:** Run `node --test bin/formal-test-sync.test.cjs`
- **After every plan wave:** Run `npm run test:ci`
- **Before `/nf:verify-work`:** Full suite must be green
- **Maximum acceptable task feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 055-01-01 | 01 | 1 | CREM-01 | integration | `grep -r "\-\-seed-files" core/workflows/close-formal-gaps.md` | ✅ N/A | ⬜ pending |
| 055-01-02 | 01 | 1 | CREM-01 | integration | `grep -n "SEED_FILES_ARG\|getImplementationSync\|getCallersSync" commands/nf/solve-remediate.md` | ✅ N/A | ⬜ pending |
| 055-02-01 | 02 | 1 | CREM-02 | unit | `node --test bin/formal-test-sync.test.cjs 2>&1 \| tail -5` | ❌ W0 | ⬜ pending |
| 055-02-02 | 02 | 1 | CREM-02 | integration | `grep -n "enrich-recipes\|observed_test_patterns" commands/nf/solve-remediate.md` | ✅ N/A | ⬜ pending |

*Status values: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Plan 02 Task 1 adds a new `--enrich-recipes` flag to `bin/formal-test-sync.cjs` and tests in `bin/formal-test-sync.test.cjs`. The test file is created/updated as part of Task 1 itself (TDD-adjacent: tests written alongside implementation). No pre-existing test scaffolding needed for Plan 01 (workflow markdown changes only).

- [ ] `bin/formal-test-sync.test.cjs` — tests for --enrich-recipes flag, enrichment path, idempotency, combined flags (created in Plan 02 Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| R->F close-formal-gaps generates spec referencing actual function signatures | CREM-01 | Requires live coderlm server + a failing requirement to trigger R->F path | 1. Start coderlm. 2. Run nf:solve on a project with a formal gap. 3. Inspect generated spec for real function names vs. boilerplate |
| F->T stub generation contains observed assert patterns | CREM-02 | Requires live coderlm + F->T path to trigger | 1. Start coderlm. 2. Run nf:solve with F->T dispatch. 3. Compare generated stubs to generic boilerplate |

---

## Validation Sign-Off

- [x] All tasks have `<verify>` commands or Wave 0 dependencies
- [x] No 3 consecutive implementation tasks without automated verify
- [x] Wave 0 test file identified (Plan 02 Task 1 creates formal-test-sync.test.cjs)
- [x] No watch-mode flags in any automated command
- [x] Feedback latency per task: < 30s (grep + node:test is fast)
- [x] `nyquist_compliant: true` set in frontmatter

**Plan-checker approval:** approved on 2026-04-08

---

## Execution Tracking

Updated during `/nf:execute-phase 55`:

| Wave | Tasks | Tests Run | Pass | Fail | Sampling Status |
|------|-------|-----------|------|------|-----------------|
| 1 | 4 | — | — | — | ⬜ pending |

**Phase validation complete:** pending
