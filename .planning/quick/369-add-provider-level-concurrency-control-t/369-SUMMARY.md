---
phase: quick-369
plan: 01
type: execute
wave: 1
completed: 2
duration: "~6 minutes"
completed_date: 2026-04-01
commits:
  - feat(quick-369): add provider concurrency semaphore module with file-based locking
  - feat(quick-369): integrate provider concurrency control into HTTP dispatch
---

# Quick Task 369: Add Provider-Level Concurrency Control to Quorum Dispatch

## Summary

Implemented file-based provider concurrency control to prevent rate-limit cascades when multiple quorum slots share the same API provider (e.g., 6 Together.xyz slots firing simultaneously).

## What Was Built

### 1. Provider Concurrency Semaphore Module (`bin/provider-concurrency.cjs`)

**Architecture:**
- File-based cross-process locks in `/tmp/nf-provider-locks/`
- Lock file format: `{providerKey}-{slotIndex}.lock` containing PID, timestamp, slot name
- Stale lock detection via process PID check and 5-minute TTL
- Staggered backoff: `200ms * attempt + jitter (0-100ms)` for competing slots

**Exports:**
- `acquireSlot(providerKey, maxConcurrency, timeoutMs)` — acquire a concurrency slot with timeout
- `releaseSlot(providerKey, slotIndex)` — release a slot (idempotent)
- `providerKeyFromUrl(baseUrl)` — derive lock key from provider baseUrl (host + path)

**Fail-Open Design:**
- Any filesystem error returns `{ acquired: true, release: noop }` — dispatch never blocked
- Lock acquisition timeout (30s max) ensures bounded wait
- Double-release is safe (idempotent)

**Key Features:**
- Stale lock cleanup: removes locks from dead processes or TTL-expired locks
- Path-aware keys: `https://api.together.xyz/v1` and `/v2` produce different lock pools
- No external dependencies (fs, crypto, path, os stdlib only)

### 2. Integration into HTTP Dispatch (`bin/call-quorum-slot.cjs`)

**Changes:**
- Added require: `const { acquireSlot, releaseSlot, providerKeyFromUrl } = require('./provider-concurrency.cjs')`
- Modified `runHttp()` function to wrap HTTP requests with concurrency control
- Acquires slot before request: `const lock = acquireSlot(providerKey, maxConcurrency, 30000)`
- Releases slot in finally block (guaranteed on success, error, timeout, or abort)
- Default `max_concurrency` fallback: 3 if provider config absent

**Subprocess Unaffected:**
- Concurrency control applies ONLY to HTTP dispatch (`provider.type === 'http'`)
- Subprocess CLI slots (codex, gemini, opencode, copilot) manage their own rate limiting
- `runSubprocess()` unchanged

### 3. Provider Configuration (`bin/providers.json`)

**Updated HTTP Providers:**
Added `"max_concurrency": 3` to all 6 Together.xyz HTTP slots:
- claude-1 (DeepSeek-V3.1)
- claude-2 (Qwen3.5-397B)
- claude-3 (Qwen3-Coder-480B)
- claude-4 (Kimi-K2.5)
- claude-5 (GPT-OSS-120B)
- claude-6 (GLM-5)

All share the same baseUrl (`https://api.together.xyz/v1`), so concurrency is shared: max 3 simultaneous HTTP requests at a time.

## Test Coverage

### Unit Tests (`bin/provider-concurrency.test.cjs`)

16 tests covering:
1. Basic slot acquisition (slot 0 available)
2. Concurrency limit enforcement (N+1 waits)
3. Lock file cleanup on release
4. Stale lock detection (dead PID cleanup)
5. TTL-based cleanup (6-minute-old locks removed)
6. Provider key derivation from baseUrl (path-aware)
7. Double-release idempotency
8. Fail-open on filesystem errors

**Test Results:** 16 passed, 0 failed

### Verification Checks

- `grep 'provider-concurrency' bin/call-quorum-slot.cjs` — shows integration ✓
- `node -e "const p = require('./bin/providers.json'); ..."` — all HTTP providers have max_concurrency=3 ✓
- `acquireSlot('test', 1, 100)` — fail-open returns acquired:true ✓
- Subprocess dispatch unaffected (no provider-concurrency calls in runSubprocess) ✓

## Invariant Preservation

1. **EventualConsensus (quorum/invariants.md):**
   - Fail-open design ensures concurrency control never blocks dispatch
   - Bounded 30s timeout prevents permanent blocking
   - Lock release in finally block guarantees cleanup on all exit paths

2. **AllTransitionsValid (safety/invariants.md):**
   - Concurrency control operates below phase transition layer (HTTP dispatch timing only)
   - No impact on state machine semantics

3. **FullRecruitment (recruiting/invariants.md):**
   - All slots eventually fire (concurrency limiting only staggered backoff)
   - Fail-open timeout ensures no permanent slot blocking

## Deviations

None — plan executed exactly as specified.

## Performance Impact

- **Throughput:** At most 3 Together.xyz HTTP requests simultaneously (instead of 6)
- **Latency:** Remaining 3 slots stagger with backoff, max 30s wait
- **Rate-limit prevention:** Reduces cascading failures when provider quota exhausted

## Implementation Notes

- Lock directory `/tmp/nf-provider-locks/` is temporary and OS-cleaned, no git noise
- Synchronous semaphore (fs.writeFileSync) blocks before HTTP call (intentional for staggering)
- Fail-open pattern: no exceptions ever thrown, all errors logged to stderr
- Provider key includes full path component, not just hostname (different API versions get separate pools)

## Files Modified

| File | Changes |
|------|---------|
| bin/provider-concurrency.cjs | NEW: 178 lines (semaphore module) |
| bin/provider-concurrency.test.cjs | NEW: 273 lines (16 test cases) |
| bin/call-quorum-slot.cjs | +8 lines (require, acquireSlot, finally release) |
| bin/providers.json | +6 lines (max_concurrency=3 on claude-1..6) |

## Success Criteria Met

- [x] Provider concurrency semaphore module exists and is fully tested
- [x] HTTP dispatch in call-quorum-slot.cjs acquires/releases provider locks
- [x] max_concurrency=3 configured for all Together.xyz HTTP slots
- [x] Fail-open: lock errors never block dispatch (EventualConsensus preserved)
- [x] Bounded 30s wait prevents permanent blocking (FullRecruitment preserved)
- [x] Subprocess slots unchanged (no regression to CLI-based providers)
- [x] Lock files use /tmp/ (not repo-tracked, no git noise)
- [x] All unit tests pass (16/16)
