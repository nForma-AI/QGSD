---
phase: 54
slug: adapter-foundation
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-08
---

# Phase 54 — Validation Strategy

> Template created by `/nf:plan-phase 54` (step 5.5) after research.
> Populated by `/nf:plan-phase 54` (step 11.5) after plan-checker approval.
> Governs feedback sampling during `/nf:execute-phase 54`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | none (native test runner) |
| **Quick run command** | `node --test bin/coderlm-cache.test.cjs bin/coderlm-adapter.test.cjs` |
| **Full suite command** | `npm run test:ci` |
| **Estimated runtime** | ~60 seconds |
| **CI pipeline** | `.github/workflows/` — existing CI pipeline |

---

## Nyquist Sampling Rate

> The minimum feedback frequency required to reliably catch errors in this phase.

- **After every task commit:** Run `node --test bin/coderlm-cache.test.cjs bin/coderlm-adapter.test.cjs`
- **After every plan wave:** Run `npm run test:ci`
- **Before `/nf:verify-work`:** Full suite must be green
- **Maximum acceptable task feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 054-01-01 | 01 | 1 | CADP-01 | unit | `node --test bin/coderlm-cache.test.cjs 2>&1 \| grep -E "FAIL\|Error\|Cannot find module"` | ❌ W0 | ⬜ pending |
| 054-01-02 | 01 | 1 | CADP-01 | unit | `node --test bin/coderlm-cache.test.cjs 2>&1 \| tail -5` | ❌ W0 | ⬜ pending |
| 054-02-01 | 02 | 1 | CDIAG-01 | unit | `grep -n 'getImplementationSync' bin/coderlm-adapter.cjs bin/nf-solve.cjs` | ✅ N/A | ⬜ pending |
| 054-02-02 | 02 | 1 | CDIAG-04 | unit | `grep -n 'reindex' bin/coderlm-lifecycle.cjs \| grep -E "function reindex\|module.exports"` | ✅ N/A | ⬜ pending |
| 054-03-01 | 03 | 2 | CADP-01,CADP-02,CADP-03 | integration | `node -e "const a=require('./bin/coderlm-adapter.cjs'); const ad=a.createAdapter({enabled:false}); console.log(JSON.stringify(ad.getSessionMetrics()))"` | ✅ N/A | ⬜ pending |
| 054-03-02 | 03 | 2 | CADP-03 | integration | `node --test bin/coderlm-adapter.test.cjs 2>&1 \| tail -5` | ❌ W0 | ⬜ pending |

*Status values: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Test scaffolding committed BEFORE any implementation task. Executor runs Wave 0 first.

Existing infrastructure covers most phase requirements. Wave 0 needed for new test files:

- [ ] `bin/coderlm-cache.test.cjs` — TDD stubs for CADP-01 (Plan 01 Task 1 creates this)
- [ ] `bin/coderlm-adapter.test.cjs` — stubs for CADP-02, CADP-03 metrics tests (Plan 03 Task 2 creates/updates this)

Note: Plan 01 Task 1 is a TDD task — the test file IS the Wave 0 artifact. The executor should treat Plan 01 Task 1 as the Wave 0 step.

---

## Manual-Only Verifications

> Behaviors that genuinely cannot be automated, with justification.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| nf:solve with coderlm running shows cache hit stats in stderr | CADP-01 | Requires live coderlm server running locally | 1. Start coderlm server. 2. Run `nf:solve` on a project with repeated symbol queries. 3. Check stderr for "cache hit rate" output |
| nf:solve with coderlm unavailable completes without errors | CADP-02 | Requires coderlm server to be absent | 1. Ensure coderlm not running. 2. Run `nf:solve`. 3. Verify convergence loop completes normally |

---

## Validation Sign-Off

Updated by `nf-plan-checker` when plans are approved:

- [x] All tasks have `<automated>` verify commands or Wave 0 dependencies
- [x] No 3 consecutive implementation tasks without automated verify (sampling continuity)
- [x] Wave 0 test files identified (Plan 01 Task 1 = TDD, creates test file first)
- [x] No watch-mode flags in any automated command
- [x] Feedback latency per task: < 30s (node:test is fast)
- [x] `nyquist_compliant: true` set in frontmatter

**Plan-checker approval:** approved on 2026-04-08

---

## Execution Tracking

Updated during `/nf:execute-phase 54`:

| Wave | Tasks | Tests Run | Pass | Fail | Sampling Status |
|------|-------|-----------|------|------|-----------------|
| 1 | 4 | — | — | — | ⬜ pending |
| 2 | 2 | — | — | — | ⬜ pending |

**Phase validation complete:** pending
