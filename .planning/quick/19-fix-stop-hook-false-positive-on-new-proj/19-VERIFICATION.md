---
phase: quick-19
verified: 2026-02-21T00:00:00Z
status: passed
score: 5/5 must-haves verified
gaps: []
---

# Quick Task 19: Stop Hook False-Positive Fix — Verification Report

**Task Goal:** Fix Stop hook false positive — `hasQuorumCommand` matched @file-expanded content containing `/qgsd:new-project` text, causing spurious quorum blocks when `/qgsd:quick` was invoked via skill expansion.
**Verified:** 2026-02-21
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/qgsd:quick` invocation whose `@file-expanded` message body contains `/qgsd:new-project` as error text does NOT trigger a false-positive quorum block | VERIFIED | TC20 passes: `userLineWithTag('/qgsd:quick', body_with_new_project)` → exit 0, empty stdout |
| 2 | A genuine `/qgsd:new-project` invocation still triggers quorum enforcement on decision turns | VERIFIED | TC20c passes: real `/qgsd:new-project` tag + ROADMAP.md commit + no quorum → decision:block |
| 3 | `hasQuorumCommand` prefers the `<command-name>` XML tag over full-message JSON scan | VERIFIED | `hooks/qgsd-stop.js` lines 84-89: tag extracted first; `if (tag !== null)` path tests only the tag, never falls through to body scan |
| 4 | `extractCommand` prefers the `<command-name>` XML tag for accurate command identification | VERIFIED | `hooks/qgsd-stop.js` lines 115-119: same XML-tag-first strategy with explicit `continue` on tag mismatch |
| 5 | All existing tests continue to pass after the fix | VERIFIED | `npm test`: 144/144 tests pass, 0 failures across all 4 test files |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `hooks/qgsd-stop.js` | Fixed `hasQuorumCommand` and `extractCommand` functions with `extractCommandTag` helper | VERIFIED | Lines 62-73: `extractCommandTag()` present; lines 79-105: `hasQuorumCommand` uses XML-tag-first; lines 110-137: `extractCommand` uses XML-tag-first; both contain literal `"command-name"` |
| `hooks/dist/qgsd-stop.js` | Rebuilt dist matching source | VERIFIED | `diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js` produces empty output — files are identical |
| `hooks/qgsd-stop.test.js` | Regression tests TC20/TC20b/TC20c for the @file-expansion false positive | VERIFIED | Lines 684-785: all three test cases present with `userLineWithTag()` helper |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `hooks/qgsd-stop.js` | `hooks/dist/qgsd-stop.js` | `npm run build:hooks` | VERIFIED | `diff` returns empty — dist is a verbatim copy of source |
| `hasQuorumCommand` | `extractCommandTag` | XML tag-first matching before body scan | VERIFIED | Line 84: `const tag = extractCommandTag(entry);` called on every user entry; line 86: tag tested exclusively when non-null; line 89: `continue` prevents fallthrough |

---

### Anti-Patterns Found

None detected.

Scanned `hooks/qgsd-stop.js` and `hooks/qgsd-stop.test.js` for TODO/FIXME/placeholder comments, empty implementations, and console.log-only handlers. None found.

---

### Human Verification Required

None. All goal outcomes are mechanically verifiable via test execution.

---

## Verification Details

### extractCommandTag Function (lines 62-73)

The helper extracts text from both string and array-form `message.content`, applies the regex `/<command-name>([\s\S]*?)<\/command-name>/`, and returns the trimmed match or null. This correctly handles both content formats Claude Code produces.

### hasQuorumCommand XML-Tag-First Logic (lines 84-89)

When `extractCommandTag` returns a non-null value, the function tests only that tag value against `cmdPattern`. If the tag is present but does not match (e.g., the tag is `/qgsd:quick` but `cmdPattern` requires `new-project`), the `continue` statement prevents any fallback to body scanning. This is the precise fix for the false-positive: expanded workflow content in the body is never scanned when a tag is present.

### extractCommand XML-Tag-First Logic (lines 115-119)

Identical strategy: tag extracted first, regex applied only to tag when present, explicit `continue` on tag mismatch. Falls back to first 300 characters of message text only when no tag is found. Ultimate fallback to `/qgsd:plan-phase` string preserved (line 136).

### Test Coverage for the Fix

- **TC20** (false-positive regression): tag = `/qgsd:quick`; body contains `/qgsd:new-project` text. GUARD 4 returns false because `/qgsd:quick` is not in `quorum_commands`. Result: exit 0, empty stdout. Pass.
- **TC20b** (positive control — real command, non-decision turn): tag = `/qgsd:new-project`; GUARD 4 triggers but GUARD 5 passes (no artifact commit, no decision marker). Result: exit 0, empty stdout. Pass.
- **TC20c** (end-to-end enforcement): tag = `/qgsd:new-project`; ROADMAP.md artifact commit present; no quorum tool calls. Result: `decision:block` with `QUORUM REQUIRED:` reason. Pass.

### npm test Summary

```
tests 144
suites 18
pass 144
fail 0
```

All four test files pass: `hooks/qgsd-stop.test.js`, `hooks/config-loader.test.js`, `get-shit-done/bin/gsd-tools.test.cjs`, `hooks/qgsd-circuit-breaker.test.js`.

---

_Verified: 2026-02-21_
_Verifier: Claude (gsd-verifier)_
