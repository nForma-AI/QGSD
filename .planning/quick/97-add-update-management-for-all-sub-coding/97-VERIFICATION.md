---
phase: quick-97
verified: 2026-02-24T00:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase quick-97: Add Update Management for All Sub-Coding Agents — Verification Report

**Phase Goal:** Add full update management for all sub-coding agents — Upd column in listAgents() table showing update status inline, getUpdateStatuses() parallel version checks, updateAgents() interactive update flow, menu item 10.
**Verified:** 2026-02-24
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running 'Update coding agents' from main menu shows CLI/install/current/latest/status table for all 5 agents | VERIFIED | `updateAgents()` implemented at line 285 in update-agents.cjs with full printTable() that renders CLI, Install, Current, Latest, Status columns with ANSI color. getUpdateStatuses() returned map size 5 in live test. |
| 2 | User can select 'Update all outdated' and each agent is upgraded via correct command | VERIFIED | `action === 'all'` path at line 336 iterates `toUpdate`, calling `runUpdate()` which dispatches `npm install -g pkg@latest` for npm-global or `gh extension upgrade copilot` for gh-extension per CLI_META. |
| 3 | User can select an individual agent to update from a filtered list of outdated agents | VERIFIED | `action === 'select'` path at line 338 shows checkbox prompt of outdated CLIs only; user picks subset which is filtered to `toUpdate`. |
| 4 | User can skip without making changes | VERIFIED | `action === 'skip'` path at line 331 prints "Skipped." and returns. |
| 5 | If a CLI is not installed, status shows '? unknown' and it is excluded from update prompts | VERIFIED | `deriveStatus()` returns `'unknown'` when current or latest is null; `outdated` filter (line 311) uses `status === 'update-available'` only, excluding unknown entries. |
| 6 | listAgents() table has 'Upd' column showing dim checkmark / yellow arrow / dim question mark inline | VERIFIED | Column header 'Upd' at line 228 in manage-agents.cjs; per-row updCell built at lines 288-297 using `\x1b[2m\u2713\x1b[0m`, `\x1b[33m\u2191\x1b[0m`, `\x1b[2m?\x1b[0m`; updCell included in row join at line 306. |
| 7 | getUpdateStatuses() exported from bin/update-agents.cjs, called from listAgents() at start | VERIFIED | `module.exports = { updateAgents, getUpdateStatuses }` at line 369; imported at manage-agents.cjs line 12; called at manage-agents.cjs line 194 inside try/catch at start of listAgents(). |
| 8 | node --test bin/manage-agents.test.cjs still passes with no regressions | VERIFIED | Test run output: 26 pass, 0 fail. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/update-agents.cjs` | Standalone update management module with detect/display/update logic | VERIFIED | 369 lines, exports `updateAgents` and `getUpdateStatuses`. Live load check printed "loaded ok". getUpdateStatuses() returned Map size 5. |
| `bin/manage-agents.cjs` | Main menu with item 10 wired to updateAgents(), listAgents() table with Upd column | VERIFIED | 1568 lines. require at line 12, getUpdateStatuses() call at line 194, 'Upd' header at line 228, updCell in row at line 306, menu choice at line 1425, dispatch at line 1442. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `bin/manage-agents.cjs` | `bin/update-agents.cjs` | `require('./update-agents.cjs')` | WIRED | Line 12: `const { updateAgents, getUpdateStatuses } = require('./update-agents.cjs');` — both exports destructured and used (getUpdateStatuses at line 194, updateAgents at line 1442). |
| `bin/update-agents.cjs` | `bin/providers.json` | `require('./providers.json')` — deduplicate by cli path | WIRED | Line 34: `const data = require('./providers.json');` inside buildCliList(). Live test confirmed Map size 5 — all 5 providers resolved from providers.json. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| QUICK-97 | 97-PLAN.md | Add full update management for all sub-coding agents | SATISFIED | Both tasks completed; all success criteria met. No matching entry in REQUIREMENTS.md (quick task — not in phase requirements tracking). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `bin/update-agents.cjs` | 37, 129, 162, 167 | `return []` / `return null` | Info | These are legitimate defensive returns: empty list when providers.json is unavailable; null when a CLI version cannot be detected. Not stubs — they are intentional fallback values. |

No blockers. No warnings.

### Human Verification Required

#### 1. Interactive update flow with real outdated agents

**Test:** Run `node bin/manage-agents.cjs`, select item 10 (Update coding agents). Wait for version table to render.
**Expected:** Table shows CLI, Install, Current, Latest, Status for codex/gemini/opencode/copilot/ccr. If any are outdated, prompt appears with 3 choices. "Update all outdated" triggers npm/gh commands.
**Why human:** Interactive TTY prompt cannot be exercised programmatically; actual update execution requires a live npm registry connection.

#### 2. Upd column visible in agent list view

**Test:** Run `node bin/manage-agents.cjs`, select item 1 (List agents).
**Expected:** Agent table includes an "Upd" column showing ✓, ↑, or ? for each agent row. Column appears after Billing and before Timeout.
**Why human:** Visual table layout and ANSI rendering require terminal display to confirm.

### Gaps Summary

No gaps. All automated checks passed.

- `bin/update-agents.cjs` is fully implemented (369 lines), exports both required functions, uses Promise.all for parallel detection in getUpdateStatuses(), has proper semverGte implementation, ANSI table, inquirer prompts.
- `bin/manage-agents.cjs` is correctly wired: require at top, getUpdateStatuses() called defensively in listAgents(), Upd column rendered per row, menu item 10 exists with separator, dispatch handler present.
- Test suite: 26 pass, 0 fail — no regressions.
- Commits confirmed: `9f5ccf1` (create update-agents.cjs) and `1e3b349` (wire manage-agents.cjs).

---

_Verified: 2026-02-24_
_Verifier: Claude (qgsd-verifier)_
