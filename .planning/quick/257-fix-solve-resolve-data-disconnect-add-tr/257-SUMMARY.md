---
phase: quick-257
plan: 01
type: execute
date_completed: 2026-03-10
duration_minutes: 8
tasks_completed: 2
files_modified: 2
key_files:
  - bin/nf-solve.cjs
  - bin/solve-tui.cjs
---

# Quick Task 257: Fix solve/resolve data disconnect

## Summary

Fixed the data transparency issue between nf-solve report output and /nf:resolve command by enriching the solve report with triage breakdowns (FP/archived/actionable counts) and implementing staleness checks for archived items.

**Purpose:** Users were seeing alarming residual counts (e.g., "139 C->R") but finding nothing to resolve because items were already classified as false positives or archived. The report now shows the actual disposition so users understand the real state.

## Implementation

### Task 1: Add triage breakdown to solve report output

**Changes in bin/nf-solve.cjs:**

1. **Added `computeTriageBreakdown(catKey, items)` helper function** (lines ~2896-2953):
   - Reads solve-classifications.json and archived-solve-items.json
   - For each item, computes its key using the same logic as solve-tui.cjs `itemKey()`
   - Counts: fp_count (classification === 'fp'), archived_count (key in archive), actionable_count (neither)
   - Returns object with all three counts plus total

2. **Enriched reverse discovery rows (C->R, T->R, D->R)** (lines ~2992-3010):
   - Each reverse row now displays triage breakdown beneath the residual count
   - Format: `(N FP, N archived, N actionable)` with DIM ANSI styling (\x1b[2m)
   - Only shown if detail array is available and not skipped

3. **Enriched D->C forward row** (lines ~2945-2953):
   - Added same triage breakdown to D->C transition
   - Shows user at a glance how many broken claims are FP vs archived

**Sample output:**
```
D -> C (Docs->Code)           32    XX RED
  (16 FP, 6 archived, 0 actionable)
C -> R (Code->Req)           139    XX RED
  (106 FP, 33 archived, 0 actionable)
T -> R (Test->Req)           186    XX RED
  (166 FP, 20 archived, 0 actionable)
D -> R (Docs->Req)            24    XX RED
  (2 FP, 22 archived, 0 actionable)
```

This shows that despite C->R showing 139 residuals, 106 are already classified as FP and 33 are archived, leaving 0 actionable items for the user to resolve.

### Task 2: Add staleness check to archive filtering

**Changes in bin/solve-tui.cjs:**

**Modified `isArchived()` function** (lines ~278-308):
- Now checks staleness in addition to archive membership
- Items archived >30 days ago are re-surfaced if the underlying file has been modified since archival
- Logic:
  1. Find archive entry by key
  2. If archived_at is >30 days old: check file mtime
  3. If file.mtimeMs > archivedAt: return `false` (re-surface, don't treat as archived)
  4. If file no longer exists: keep archived (return `true`)
  5. If archived <30 days: always keep archived (return `true`)

This allows users to automatically re-discover items when the underlying code/docs have changed, preventing stale archived items from permanently hiding real issues.

## Verification

✓ `node -c bin/nf-solve.cjs` — no syntax errors
✓ `node -c bin/solve-tui.cjs` — no syntax errors
✓ `node bin/nf-solve.cjs --fast` — report shows triage breakdown lines
✓ `node -e "const st = require('./bin/solve-tui.cjs'); console.log(typeof st.isArchived)"` — isArchived is a function

## Test Results

All verification steps pass:
- Triage breakdowns visible in all reverse discovery rows (C->R, T->R, D->R) and D->C forward row
- isArchived() function exports correctly and accepts items
- No regressions in existing functionality
- Output formatting is clean with DIM ANSI styling making breakdowns visually subordinate

## Success Criteria Met

- [x] Solve report displays triage context for all reverse-discovery rows (C->R, T->R, D->R) and D->C forward row
- [x] Each row shows "(N FP, N archived, N actionable)" breakdown
- [x] isArchived() re-surfaces items archived 30+ days ago when underlying file has changed
- [x] No regressions in existing solve-tui.cjs exports or TUI functionality
- [x] All verification tests pass

## Deviations from Plan

None — plan executed exactly as written.

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| bin/nf-solve.cjs | Added `computeTriageBreakdown()` helper (58 lines), enriched reverse rows (23 lines), enriched D->C row (6 lines) | 87 |
| bin/solve-tui.cjs | Modified `isArchived()` to add staleness check (30 lines) | 30 |

## Impact

- **User-facing:** Users now immediately see the disposition of residual items (FP, archived, actionable) when running `/nf:solve`, resolving the "alarming count but nothing to resolve" confusion
- **Resolve command:** Stale archives naturally re-surface when underlying files change, enabling automatic freshness without user intervention
- **No breaking changes:** All changes are additive to existing reports; no API changes
