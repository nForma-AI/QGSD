---
phase: 056
slug: diagnostic-enrichment
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-08
---

# Phase 056 — Validation Strategy

> Template created by `/nf:plan-phase 056` after plan-checker approval.
> Governs feedback sampling during `/nf:execute-phase 056`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js (custom test runner via npm test) |
| **Config file** | package.json |
| **Quick run command** | `npm run test:ci` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |
| **CI pipeline** | .github/workflows/ — exists |

---

## Nyquist Sampling Rate

- **Quick run command:** `npm run test:ci`
- **Full suite command:** `npm test`
- **Feedback latency:** ~60s (integration-heavy)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Verify Command | Result | Status |
|---------|------|------|-------------|-----------|----------------|--------|--------|
| 056-01-01 | 056-01 | 1 | CREM-03 | unit | `node -e "const {computePriority} = require('./bin/git-heatmap.cjs'); console.log(computePriority(10,1,0,0), computePriority(10,1,0,10))"` | TBD | ⬜ pending |
| 056-01-02 | 056-01 | 1 | CREM-03 | integration | `grep -c "CREM-03" bin/nf-solve.cjs && npm run test:ci 2>&1 \| tail -5` | TBD | ⬜ pending |
| 056-02-01 | 056-02 | 2 | CREM-04 | integration | `grep -n "caller_count\|dead_code_flag" bin/nf-solve.cjs \| head -10` | TBD | ⬜ pending |
| 056-02-02 | 056-02 | 2 | CREM-04 | integration | `grep -n "0 callers\|likely dead" bin/nf-solve.cjs \| head -5 && npm run test:ci 2>&1 \| tail -5` | TBD | ⬜ pending |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no Wave 0 test tasks needed.

---

## Manual-Only Verifications

All phase behaviors have automated verification coverage.

---

## Validation Sign-Off

- [x] Test framework and commands identified
- [x] All tasks have verify commands
- [x] All tasks have done criteria
- [x] Fail-open behavior is verifiable (calling with undefined adapter)
- [x] No Wave 0 scaffolding needed

---

## Execution Tracking

| Plan | Status | Started | Completed |
|------|--------|---------|-----------|
| 056-01 | ⬜ pending | - | - |
| 056-02 | ⬜ pending | - | - |
