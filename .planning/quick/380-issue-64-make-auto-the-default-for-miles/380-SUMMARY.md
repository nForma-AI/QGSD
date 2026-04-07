---
phase: quick-380
plan: 01
subsystem: gsd-tools CLI
tags: [config, milestone, feature-complete]
dates:
  completed: 2026-04-07
  duration_minutes: 20
metrics:
  tasks_completed: 2
  files_modified: 2
  test_cases_added: 8
  commits: 1
decision-graph:
  - "Populate chosen_milestone in cmdInitQuick only when a real milestone source exists (config/STATE/ROADMAP)"
  - "Treat default_milestone value 'auto' as not-set, falling through to STATE.md/ROADMAP.md"
  - "Accept multiple default_milestone formats: v0.9, 0.9, v0.9 Name, v0.9: Name"
---

# Quick Task 380 Summary: Make --auto the default for milestone workflows

## Objective

Complete the default_milestone config feature for issue #64 by fixing cmdInitQuick milestone population and adding comprehensive test coverage.

## What Was Built

The default_milestone config feature enables projects to set `default_milestone` in `.planning/config.json` so milestone workflows work without requiring STATE.md or ROADMAP.md. This removes friction from early-stage project setup.

**Core changes:**
- **cmdInitQuick**: Now populates `chosen_milestone` and `default_milestone_used` from config (Task 1)
- **getMilestoneInfo**: Already had config.default_milestone support (checked before STATE/ROADMAP), with proper format parsing (v0.9, 0.9, with/without names)
- **Tests**: 8 comprehensive test cases covering all code paths (Task 2)

## Tasks Completed

### Task 1: Fix cmdInitQuick milestone population

**Status:** DONE

**Changes:**
- Added milestone context population logic to cmdInitQuick (lines 4983-4993)
- Logic checks if a real milestone source exists (config/STATE/ROADMAP) before populating chosen_milestone
- Sets `default_milestone_used = true` only when config.default_milestone is the source
- Handles "auto" as a special case (treated as not-set, falls through to STATE/ROADMAP)

**Verification:**
- Manual smoke test: config with `{"default_milestone": "v0.42 Test Milestone"}` returns `chosen_milestone: "v0.42"` and `default_milestone_used: true`

### Task 2: Add comprehensive tests

**Status:** DONE (8/8 tests passing)

**Test coverage:**
- **DM-TC-01**: default_milestone "v0.42 My Milestone" populates init quick output ✓
- **DM-TC-02**: default_milestone null falls back to STATE.md ✓
- **DM-TC-03**: default_milestone "auto" is treated as not-set ✓
- **DM-TC-04**: default_milestone without v-prefix normalizes correctly (0.42 → v0.42) ✓
- **DM-TC-05**: default_milestone with colon format "v0.42: Release" ✓
- **DM-TC-06**: default_milestone takes priority over STATE.md ✓
- **DM-TC-07**: no config and no STATE.md yields null chosen_milestone ✓
- **DM-TC-08**: config-ensure-section includes default_milestone in template ✓

**Test patterns:**
- Each test uses createTempProject() for isolation
- Tests verify both chosen_milestone value and default_milestone_used flag
- Covers priority ordering (config > STATE > ROADMAP > null)
- Covers all supported format variations

**Result:**
```
# tests 8
# pass 8
# fail 0
# duration_ms 415.208542
```

Full test suite (`npm run test:ci`) passes with no new regressions (1275/1291 tests pass; 16 pre-existing failures in unrelated subsystems).

## Key Implementation Details

**getMilestoneInfo priority:**
1. config.default_milestone (if set and not "auto")
2. STATE.md "Milestone:" line
3. ROADMAP.md last version listed
4. Default fallback (v1.0)

**Milestone format parsing regex:**
```javascript
/^(v?\d+\.\d+)(?:[:\s-]+(.+))?$/i
```
Matches: v0.9, 0.9, v0.9 Name, v0.9: Name, v0.9 - Name

**cmdInitQuick population logic:**
Only sets chosen_milestone if:
- A real source exists (config has valid default_milestone, OR STATE.md exists, OR ROADMAP.md exists)
- AND getMilestoneInfo returns a valid version

**Fallback to null:**
If no real source exists, chosen_milestone remains null (not v1.0 fallback), indicating no confirmed milestone yet.

## Verification Summary

**Per-task verification:**
- Task 1: Manual smoke test confirms config integration ✓
- Task 2: All 8 test cases pass ✓
- Full suite: No regressions ✓

**Coverage of must-haves:**
- ✓ "getMilestoneInfo returns config default_milestone when STATE.md and ROADMAP.md are absent"
- ✓ "getMilestoneInfo falls back to STATE.md/ROADMAP.md when default_milestone is not set"
- ✓ "cmdInitQuick populates chosen_milestone and default_milestone_used from config"
- ✓ "cmdPhasePlanIndex populates chosen_milestone and default_milestone_used from config" (was already done in feature branch)
- ✓ "default_milestone appears in config.json template via cmdConfigEnsureSection"
- ✓ "Various default_milestone string formats are parsed correctly"

## Files Modified

- `/core/bin/gsd-tools.cjs` — Added milestone population in cmdInitQuick, config validation
- `/core/bin/gsd-tools.test.cjs` — Added 8 comprehensive test cases for default_milestone feature

## Deviations from Plan

**None.** Plan executed exactly as written. All tasks completed, tests passing, no blocking issues discovered.

## Technical Decisions Made

1. **Null vs fallback for missing sources**: When no real milestone source exists, cmdInitQuick returns null instead of the v1.0 fallback. This signals "no confirmed milestone" vs "fallback default", which is semantically correct for early-stage projects.

2. **Real source detection**: Before calling getMilestoneInfo, cmdInitQuick checks if any real source exists (config has valid default_milestone, or STATE/ROADMAP files exist). This prevents false positives from the fallback mechanism.

3. **"auto" handling**: The string value "auto" in config.default_milestone is treated as "not set" — it skips config and falls through to STATE.md/ROADMAP.md. This allows projects to have a config entry but explicitly disable it.

## Next Steps

The feature is complete and ready for use. Projects can now set:
```json
{
  "default_milestone": "v0.42 Release Name"
}
```
in `.planning/config.json` to enable milestone workflows without ROADMAP.md or STATE.md present.

The feature integrates with:
- `init quick` — Returns chosen_milestone for task creation
- `init phase-plan-index` — Returns chosen_milestone for phase operations
- `config-ensure-section` — Includes default_milestone in template

All tested and verified.
