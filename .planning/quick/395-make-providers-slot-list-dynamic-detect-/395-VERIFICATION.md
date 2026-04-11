---
phase: quick-395
verified: 2026-04-09T20:15:00Z
status: passed
score: 5/5 must-haves verified
formal_check:
  passed: 9
  failed: 0
  skipped: 0
  counterexamples: []
---

# Quick Task 395: Make Providers Slot List Dynamic Verification Report

**Task Goal:** Make providers slot list dynamic — detect installed CLIs at startup and build active slots from what is found instead of hardcoding all slots in providers.json

**Verified:** 2026-04-09T20:15:00Z
**Status:** PASSED
**Formal Check:** All 9 checks passed — no counterexamples found

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Slots whose CLI binary cannot be found are excluded from the active provider list at server startup | ✓ VERIFIED | `detectInstalledProviders([{name:'missing-cli',type:'subprocess',cli:'/nonexistent/path/foobar'}])` returns empty array; stderr logs exclusion message with slot name, type, and binary path |
| 2 | Slots whose CLI binary IS found remain available exactly as before — no regression in behavior | ✓ VERIFIED | Live providers.json: 11 total providers, 11 installed (all CLIs present on system); filtered list matches total; backward compatibility test: `/usr/bin/env` exists → slot included |
| 3 | HTTP-only slots (type=http, no cli field) are always included regardless of detection | ✓ VERIFIED | `detectInstalledProviders([{name:'http-only',type:'http',url:'http://localhost:9999'}])` returns array with 1 element; HTTP slots never probed |
| 4 | Multiple slots sharing the same CLI binary perform only one filesystem/which probe per unique binary path | ✓ VERIFIED | Deduplication test: 3 slots using `/usr/bin/env` + 1 using nonexistent path; only 1 `fs.accessSync` call per unique binary (Map-keyed dedup); 3 included, 1 excluded |
| 5 | The detection is fail-open: if probing throws unexpectedly, the full providers list is used rather than crashing | ✓ VERIFIED | Try/catch wrapper at top level of `detectInstalledProviders` returns full providers array on exception; stderr logs error message with fail-open behavior; function never throws |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Location | Status | Details |
| --- | --- | --- | --- |
| `detectInstalledProviders` function | `bin/manage-agents-core.cjs` lines 339-385 | ✓ VERIFIED | Exists, contains all required logic (HTTP-only check, resolvedCli fallback, deduplication Map, per-slot stderr logging, fail-open catch block) |
| `detectInstalledProviders` export | `bin/manage-agents-core.cjs` line 934 | ✓ VERIFIED | Exported via `module.exports._pure.detectInstalledProviders`; confirmed type is `function` |
| Import in unified-mcp-server.mjs | `bin/unified-mcp-server.mjs` line 23 | ✓ VERIFIED | `const { _pure: { detectInstalledProviders } } = require('./manage-agents-core.cjs');` |
| Call site in unified-mcp-server.mjs | `bin/unified-mcp-server.mjs` line 70 | ✓ VERIFIED | `providers = detectInstalledProviders(providers);` after CLI resolution loop (line 43) |
| Zero-provider WARNING | `bin/unified-mcp-server.mjs` lines 71-75 | ✓ VERIFIED | Conditional check `if (providers.length === 0)` with stderr WARNING message using distinct `[unified-mcp-server]` prefix |

### Key Link Verification

| From | To | Via | Status | Evidence |
| --- | --- | --- | --- | --- |
| unified-mcp-server.mjs | manage-agents-core.cjs | require + _pure.detectInstalledProviders | ✓ WIRED | Import at line 23; usage at line 70; function called with providers array after resolveCli loop |
| detectInstalledProviders | fs module | fs.accessSync(binaryPath, fs.constants.X_OK) | ✓ WIRED | fs.accessSync used to probe binary executability at line 368; falls back to raw cli field if resolvedCli absent |
| CLI resolution | Binary probe | resolveCli() populates resolvedCli field; detectInstalledProviders probes it | ✓ WIRED | Line 43-63: resolveCli loop sets `provider.resolvedCli`; line 70: detectInstalledProviders called after, uses resolvedCli at line 364 |

**All key links verified as WIRED.**

### Ordering Verification

Dependency: `detectInstalledProviders` call must come AFTER `resolveCli` loop so that `resolvedCli` field is populated before probing.

- resolveCli loop: lines 43-63
- detectInstalledProviders call: line 70
- Ordering: CORRECT (call is after loop)
- Code comments document this ordering requirement (lines 66-69)

### Requirements Coverage

No requirement IDs declared in plan. Task goal aligns with INTENT-01 (Provider slot detection).

### Anti-Patterns Found

No blockers, stubs, or placeholders found:

| File | Pattern Search | Result |
| --- | --- | --- |
| bin/manage-agents-core.cjs | TODO/FIXME/XXX/HACK | None found |
| bin/manage-agents-core.cjs | Empty returns (return null, {}, []) | None in detectInstalledProviders; function has proper logic |
| bin/unified-mcp-server.mjs | TODO/FIXME in integration code | None found (one benign mention of "placeholder" in unrelated comment at line 275) |
| detectInstalledProviders | Console.log implementations | None; uses fs.accessSync + stderr.write only |

**No anti-patterns detected.**

### System Integration Verification

The `detectInstalledProviders` function is:
- Exported from manage-agents-core.cjs (consumer point identified)
- Imported and called in unified-mcp-server.mjs startup (consumer confirmed)
- Integrated into the providers filtering flow before tool registration (wiring confirmed)

No orphaned producer condition detected — the function has a clear system-level consumer.

### Test Suite Status

```
npm run test:ci results:
  Total: 1415
  Passed: 1413
  Failed: 2
```

Pre-existing failures (unrelated to quick-395):
- TC18: Malformed state file shows idle River (fail-open fallback) — nf-statusline.test.js
- TC24: coderlm binary absent means coderlm omitted from tools line — nf-statusline.test.js

Both failures are in nf-statusline.test.js (not related to manage-agents-core or unified-mcp-server changes). Quick-395 introduces no test regressions.

### Formal Verification Results

**Formal modules checked:** quorum, mcp-calls, installer, prefilter, recruiting

**Invariants reviewed:**
- EventualConsensus (quorum): N/A — provider filtering occurs before quorum logic
- EventualDecision (mcp-calls): N/A — filtering affects available tools but not decision/timeout logic
- OverridesPreserved (installer): N/A — detectInstalledProviders reads providers.json without modifying it
- PreFilterTerminates (prefilter): N/A — filtering occurs at server startup, before prefilter runs
- FullRecruitment (recruiting): N/A — filtering affects which providers are available but not recruitment logic itself

**Formal check result:** 9 passed, 0 failed, 0 skipped
**Status:** PASSED — No counterexamples found. All formal checks validated successfully.

### Implementation Details Verified

**Rule 1: HTTP-only slots always included**
```javascript
if (!p.cli || p.type === 'http') return true;
```
✓ Verified: Slots with no `cli` field OR `type === 'http'` skip probing and are always included.

**Rule 2: Deduplication via Map**
```javascript
const checked = new Map(); // binaryPath -> boolean (installed)
if (checked.has(binaryPath)) return checked.get(binaryPath);
checked.set(binaryPath, installed);
```
✓ Verified: Binary paths are cached in a Map, preventing duplicate filesystem probes.

**Rule 3: resolvedCli fallback**
```javascript
const binaryPath = p.resolvedCli || p.cli;
```
✓ Verified: Uses resolved path if available (set by resolveCli loop), otherwise falls back to raw cli field.

**Rule 4: Per-slot stderr logging with type**
```javascript
process.stderr.write(`[manage-agents-core] detectInstalledProviders: ${p.name} (type=${p.type || 'subprocess'}) excluded — CLI not found: ${binaryPath}\n`);
```
✓ Verified: Exclusion messages include slot name, type (or 'subprocess' default), and binary path.

**Rule 5: Fail-open on unexpected error**
```javascript
catch (err) {
  process.stderr.write(`[manage-agents-core] detectInstalledProviders: unexpected error, using full list: ${err.message}\n`);
  return providers;
}
```
✓ Verified: Outer try/catch returns full providers array unchanged if an exception occurs.

**Rule 6: Zero-provider WARNING**
```javascript
if (providers.length === 0) {
  process.stderr.write('[unified-mcp-server] WARNING: No installed providers found after CLI detection — server will start with zero tools\n');
}
```
✓ Verified: Distinct severity warning with `[unified-mcp-server]` prefix when all providers are filtered out.

## Gaps Found

None. All required truths are verified, all artifacts are present and substantive, all key links are wired, no anti-patterns detected, formal checks passed.

---

_Verified: 2026-04-09T20:15:00Z_  
_Verifier: Claude (nf-verifier)_
