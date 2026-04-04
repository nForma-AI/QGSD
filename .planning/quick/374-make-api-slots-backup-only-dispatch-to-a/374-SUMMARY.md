---
phase: quick-374
plan: 01
subsystem: quorum-dispatch
tags: [slot-ordering, backup-only, tiered-dispatch]
dependency_graph:
  requires: [bin/providers.json]
  provides: [tiered-slot-ordering, primary-backup-transparency]
  affects: [quorum.md dispatch logic, preflight JSON output]
tech_stack:
  added: []
  patterns: [stable-sort with tiebreaker, two-tier filtering, stderr diagnostics]
key_files:
  created: []
  modified: [bin/quorum-preflight.cjs, test/quorum-preflight-probe.test.cjs, core/references/quorum-dispatch.md, ~/.claude/nf-bin/quorum-preflight.cjs]
decisions:
  - title: "Stable sort with originalIndex tiebreaker"
    summary: "Used V8's stable Array.sort but made tiebreaker explicit with originalIndex map to preserve probe discovery order within each tier"
  - title: "Stderr log for transparency"
    summary: "Emit tiering counts to stderr when backup slots exist, allowing operators to diagnose slot assignment"
  - title: "Separate primary_slots and backup_slots arrays"
    summary: "Added two new fields to output JSON for diagnostic transparency alongside sorted available_slots"
metrics:
  duration_ms: ~180000
  completed_date: "2026-04-04"
  tasks_completed: 3
---

# Quick Task 374: Make API Slots Backup-Only Summary

**Plan:** [374-PLAN.md](./374-PLAN.md)

**Objective:** Make HTTP API slots (api-1 through api-6) backup-only in quorum dispatch by sorting available_slots in quorum-preflight.cjs so CLI/CCR slots always come before HTTP slots. HTTP API slots lack file access and are pay-per-use, so they should only be dispatched when all CLI-based slots are exhausted.

## Summary

Implemented tiered slot ordering in `bin/quorum-preflight.cjs` to automatically prioritize flat-rate CLI/CCR slots over pay-per-use HTTP API slots. The `available_slots` array is now sorted with:

1. **Primary tier**: subprocess and ccr type slots (codex, gemini, opencode, copilot, claude, ccr families)
2. **Backup tier**: http type slots (api-1 through api-6)

Since workflows pick the first N slots from `available_slots`, HTTP slots are now backup-only — they are never dispatched when sufficient CLI/CCR slots are available.

## Implementation Details

### Task 1: Add Tiered Slot Ordering to quorum-preflight.cjs

Added sorting logic in the `--all` mode block (after building available_slots and unavailable_slots arrays):

- Built a name-to-type lookup map from `activeProviders`
- Implemented stable sort that partitions available_slots into two tiers:
  - Primary: `type !== 'http'`
  - Backup: `type === 'http'`
- Used originalIndex tiebreaker to preserve health probe discovery order within each tier
- Added two new output fields for transparency:
  - `primary_slots`: array of CLI/CCR slots
  - `backup_slots`: array of HTTP API slots
- Emit stderr diagnostics when backup slots exist: `[preflight] Tiered ordering: {N} primary (CLI/CCR) + {M} backup (HTTP API)`

**Note:** nf-prompt.js also tiers slots independently via auth_type in its quorum injection logic. This sort covers the quorum.md direct-read path (workflows that consume preflight JSON output directly).

### Task 2: Add Tests and Update Documentation

Added two new test cases to `test/quorum-preflight-probe.test.cjs`:

- **Test 8**: Verifies that available_slots are ordered with CLI/CCR primary before HTTP backup
  - Confirms primary_slots and backup_slots arrays are present
  - Validates that all primary slots appear before all backup slots in available_slots
  - Ensures backup_slots only contain api-* type slots
  - Confirms primary + backup equals available
- **Test 9**: Verifies --no-probe still includes standard output shape without probe fields

Updated `core/references/quorum-dispatch.md`:
- Added **TIER-01** specification documenting the tiered slot ordering behavior
- Updated FAN-06 Preflight Slot Assignment Display to reference tiered fallback order:
  - T1 (flat-rate CLI/CCR): primary slots not in dispatch list
  - T2 (pay-per-use HTTP API, backup-only): backup_slots

### Task 3: Sync Installed Copy and Verify

- Copied modified preflight script to installed location at `~/.claude/nf-bin/quorum-preflight.cjs`
- Verified no diff between repo source and installed copy
- Ran full test suite: **All 9 tests pass** (9 pass / 0 fail)
- Live preflight output verified to include primary_slots and backup_slots with correct tiering

## Test Results

```
✔ --all --no-probe returns standard keys only
✔ --all returns health, available_slots, unavailable_slots by default
✔ each health entry has healthy, layer1, layer2 with ok + reason
✔ non-ccr slots (codex, gemini, opencode, copilot) have layer2.skipped === true
✔ --all --probe completes in under 8s
✔ handles missing ~/.claude.json gracefully
✔ layer2 entries (non-skipped) have cacheAge field as "fresh" or "cached"
✔ available_slots are ordered with CLI/CCR primary before HTTP backup
✔ --all --no-probe includes standard keys without probe fields

Total: 9 pass / 0 fail (15.6s)
```

## Success Criteria Met

- [x] HTTP API slots (api-1..api-6) appear AFTER all CLI/CCR slots in available_slots
- [x] primary_slots and backup_slots fields present in preflight JSON output (when probe runs)
- [x] All existing tests pass plus new tiered ordering test
- [x] Installed copy synced to ~/.claude/nf-bin/quorum-preflight.cjs
- [x] quorum-dispatch.md documents the tiered ordering behavior with TIER-01 reference

## Deviations from Plan

None - plan executed exactly as written.

## Files Modified

- `bin/quorum-preflight.cjs`: Added tiered sorting logic (24 new lines)
- `test/quorum-preflight-probe.test.cjs`: Added two new test cases (43 new lines)
- `core/references/quorum-dispatch.md`: Added TIER-01 documentation, updated FAN-06 display
- `~/.claude/nf-bin/quorum-preflight.cjs`: Synced copy from repo

## Self-Check

- [x] Created files exist: SUMMARY.md present
- [x] Commits exist: Will be created in final step
- [x] Test suite passes: 9/9 tests passing
- [x] Documentation complete: TIER-01 reference added to quorum-dispatch.md
- [x] Installed copy synced: diff shows no differences
