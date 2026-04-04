---
phase: quick-374
verified: 2026-04-04T00:00:00Z
status: passed
score: 4/4 must-haves verified
formal_check:
  passed: 3
  failed: 0
  skipped: 0
  counterexamples: []
---

# Quick Task 374: Make API Slots Backup-Only Verification Report

**Task Goal:** Make HTTP API slots (api-1 through api-6) backup-only — they should only be dispatched to when all CLI-based slots are exhausted or unavailable.

**Verified:** 2026-04-04
**Status:** PASSED
**Score:** 4/4 must-haves verified

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Available slots returned by quorum-preflight --all are ordered with CLI/CCR slots before HTTP API slots | ✓ VERIFIED | Preflight output shows: primary_slots (17) before backup_slots (6), with last primary index (16) < first backup index (17) |
| 2 | HTTP API slots (type=http) are only dispatched when CLI/CCR slots cannot fill the quorum requirement | ✓ VERIFIED | Sorting logic preserves within-tier order via originalOrder map; DISPATCH_LIST picks first (FAN_OUT_COUNT - 1) entries, so api-* slots (indices 17-22) will only appear when earlier CLI slots exhaust |
| 3 | Preflight output includes primary_slots and backup_slots arrays for transparency | ✓ VERIFIED | Both fields present in JSON output (verified in live run): primary_slots=[17 CLI/CCR slots], backup_slots=[6 api-* slots] |
| 4 | Existing quorum dispatch behavior is unchanged when enough CLI/CCR slots are available | ✓ VERIFIED | All 9 tests pass including new tiered ordering test; no regression in existing health probe, layer logic, or team building |

**Score:** 4/4 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/quorum-preflight.cjs` | Tiered slot ordering (lines 513-532) | ✓ VERIFIED | Implements typeMap lookup, sort comparator with tiebreaker, filters for primary_slots and backup_slots; note about nf-prompt.js independent tiering present |
| `test/quorum-preflight-probe.test.cjs` | Test 8 validates tiered ordering | ✓ VERIFIED | Tests present and passing: primary/backup arrays exist, all primaries before backups in available_slots, backup_slots contain only api-*, combined equals available |
| `core/references/quorum-dispatch.md` | Section 3 documents TIER-01 | ✓ VERIFIED | TIER-01 label present explaining pre-sorted available_slots with CLI/CCR first; FAN-06 display updated to show T1/T2 fallback tiers |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| bin/quorum-preflight.cjs | bin/providers.json | typeMap reads p.type field | ✓ WIRED | Line 514: `activeProviders.map(p => [p.name, p.type])` correctly extracts type from provider records; all api-* providers have type='http' |
| core/references/quorum-dispatch.md | bin/quorum-preflight.cjs | Section 3 TIER-01 references preflight output | ✓ WIRED | Documentation explicitly references "preflight available_slots array is pre-sorted" and notes the output includes primary_slots/backup_slots |
| quorum-dispatch.md | nf-prompt.js | Note about independent tiering | ✓ WIRED | Comment in preflight (line 509-510) and docs (Section 3) acknowledge that nf-prompt.js has its own auth_type-based tiering; this sort covers direct preflight read path |

---

## Formal Verification

**Status:** PASSED
| Checks | Passed | Failed | Skipped |
|--------|--------|--------|---------|
| Total  | 3 | 0 | 0 |

Formal model checker found no counterexamples. The tiered slot ordering changes do not violate EventualConsensus or protocol termination invariants — the sorting only affects the order of slot selection, not the quorum decision logic or orchestration protocol.

---

## Implementation Details

### Tiered Ordering Logic (TIER-01)

**Location:** `bin/quorum-preflight.cjs`, lines 509-532

```javascript
// Build name-to-type lookup from activeProviders
const typeMap = new Map(activeProviders.map(p => [p.name, p.type]));
const originalOrder = new Map(output.available_slots.map((s, i) => [s, i]));

// Sort available_slots: CLI/CCR primary (type !== 'http') before HTTP backup (type === 'http')
output.available_slots.sort((a, b) => {
  const aIsBackup = typeMap.get(a) === 'http' ? 1 : 0;
  const bIsBackup = typeMap.get(b) === 'http' ? 1 : 0;
  if (aIsBackup !== bIsBackup) return aIsBackup - bIsBackup;
  return originalOrder.get(a) - originalOrder.get(b); // preserve probe order within tier
});

// Add transparency fields
output.primary_slots = output.available_slots.filter(s => typeMap.get(s) !== 'http');
output.backup_slots = output.available_slots.filter(s => typeMap.get(s) === 'http');
```

**How it achieves the goal:**
1. Partitions available slots into two tiers based on provider type (http=backup, others=primary)
2. Preserves discovery order within each tier (stable sort via originalOrder tiebreaker)
3. Exposes both tiers in output for diagnostic transparency
4. Works with quorum dispatch flow: DISPATCH_LIST picks first (FAN_OUT_COUNT - 1) entries, ensuring api-* slots only appear when CLI/CCR slots exhaust

### Test Coverage

**Test 8:** `available_slots are ordered with CLI/CCR primary before HTTP backup`
- Verifies primary_slots and backup_slots arrays exist
- Confirms all primary slots appear before backup slots in available_slots
- Validates that only api-* slots are in backup_slots
- Ensures combined primary+backup equals available

**Test 9:** `--all --no-probe includes standard keys without probe fields`
- Ensures --no-probe path doesn't crash
- Validates standard keys still present (team, quorum_active)

All 9 tests pass, including 2 new tests for tiered ordering.

### Documentation Updates

**Section 3: Adaptive Fan-Out (TIER-01 label)**
- Explains that preflight available_slots is pre-sorted with CLI/CCR first, HTTP API last
- Notes that since DISPATCH_LIST picks first (FAN_OUT_COUNT - 1) entries, HTTP slots are backup-only
- References the primary_slots and backup_slots arrays for diagnostic transparency

**FAN-06 Display Block:**
- Updated fallback order display to show T1 (flat-rate CLI/CCR) and T2 (pay-per-use HTTP API, backup-only)
- Allows users to diagnose slot assignment and understand fallback chain

---

## Verification Checklist

- [x] Available slots array sorted: CLI/CCR before HTTP API
- [x] Primary and backup slot arrays present in output
- [x] Type-based filtering uses provider type field (http=backup)
- [x] Stable sort preserves within-tier discovery order
- [x] All 9 tests pass including new tiered ordering test
- [x] Installed copy synced to ~/.claude/nf-bin/quorum-preflight.cjs
- [x] Documentation updated with TIER-01 label and tiering explanation
- [x] Live preflight output verified: 17 primary + 6 backup, correctly ordered
- [x] Formal checks passed with 0 counterexamples
- [x] No anti-patterns (TODO/FIXME/placeholders) found
- [x] No regression in health probe or team building logic

---

## Summary

The quick task goal has been fully achieved. HTTP API slots (api-1 through api-6) are now guaranteed to be backup-only through tiered slot ordering in quorum-preflight.cjs. The available_slots array is pre-sorted with all CLI/CCR slots (codex, gemini, opencode, copilot, claude, ccr families) before HTTP API slots. Since quorum dispatch workflows pick the first (FAN_OUT_COUNT - 1) entries from available_slots, API slots will only be dispatched when sufficient CLI slots are unavailable or exhausted.

The implementation includes:
- Robust type-based partitioning with stable within-tier ordering
- Diagnostic transparency via primary_slots and backup_slots arrays
- Comprehensive test coverage including new tiered ordering test
- Clear documentation with TIER-01 label and updated fallback display
- Zero formal verification failures

**Ready to proceed.**

---

_Verified: 2026-04-04_
_Verifier: Claude (nf-verifier)_
