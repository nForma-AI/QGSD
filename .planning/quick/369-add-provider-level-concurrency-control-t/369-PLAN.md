---
phase: quick-369
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/provider-concurrency.cjs
  - bin/provider-concurrency.test.cjs
  - bin/call-quorum-slot.cjs
  - bin/providers.json
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "HTTP slots sharing a provider baseUrl are limited to max_concurrency simultaneous requests"
    - "Slots exceeding the concurrency limit wait with staggered backoff before dispatching"
    - "Concurrency control is fail-open -- lock acquisition failure never blocks dispatch"
    - "Lock files are automatically cleaned up (stale lock TTL prevents deadlocks)"
    - "Subprocess CLI slots are unaffected by provider concurrency limits"
  artifacts:
    - path: "bin/provider-concurrency.cjs"
      provides: "File-based provider concurrency semaphore"
      exports: ["acquireSlot", "releaseSlot"]
    - path: "bin/provider-concurrency.test.cjs"
      provides: "Unit tests for concurrency module"
      min_lines: 60
  key_links:
    - from: "bin/call-quorum-slot.cjs"
      to: "bin/provider-concurrency.cjs"
      via: "require() in runHttp() wrapper"
      pattern: "provider-concurrency"
    - from: "bin/providers.json"
      to: "bin/call-quorum-slot.cjs"
      via: "max_concurrency field read at dispatch time"
      pattern: "max_concurrency"
---

<objective>
Add provider-level concurrency control to quorum HTTP dispatch to prevent rate-limit cascades when multiple slots share the same API provider (e.g., 6 Together.xyz slots firing simultaneously).

Purpose: Together.xyz rate-limits concurrent requests, causing STALL and RATE_LIMITED errors that waste quorum slots. By limiting concurrent HTTP requests per provider baseUrl and staggering excess slots with backoff, we prevent rate-limit cascades while preserving quorum throughput.

Output: A file-based concurrency semaphore module, integration into call-quorum-slot.cjs HTTP path, and provider config for max_concurrency.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/call-quorum-slot.cjs
@bin/providers.json
@bin/quorum-slot-dispatch.cjs
@.planning/formal/spec/quorum/invariants.md
@.planning/formal/spec/safety/invariants.md
</context>

<formal_invariants>
The following invariants MUST NOT be violated by this change:

1. **EventualConsensus** (quorum/invariants.md): Quorum must eventually reach DECIDED phase.
   - Concurrency control MUST be fail-open: if lock acquisition fails, dispatch proceeds without waiting.
   - Lock wait MUST have a bounded timeout (max 30s) to prevent permanent blocking.

2. **AllTransitionsValid** (safety/invariants.md): Phase transitions must remain valid.
   - Concurrency control operates BELOW the phase transition layer -- it gates HTTP dispatch timing only.

3. **FullRecruitment** (recruiting/invariants.md): All responsive slots must eventually be recruited.
   - Concurrency limiting delays but MUST NOT prevent slot dispatch. All slots eventually fire.
</formal_invariants>

<tasks>

<task type="auto">
  <name>Task 1: Create provider concurrency semaphore module and tests</name>
  <files>bin/provider-concurrency.cjs, bin/provider-concurrency.test.cjs</files>
  <action>
Create `bin/provider-concurrency.cjs` -- a file-based concurrency semaphore for cross-process coordination.

**Architecture:**
- Lock directory: `/tmp/nf-provider-locks/` (OS temp dir, not repo-tracked)
- Each "slot" in the semaphore is a lock file: `/tmp/nf-provider-locks/{providerKey}-{N}.lock`
  where providerKey is a hash/slug of the baseUrl, N is 0..max_concurrency-1
- `acquireSlot(providerKey, maxConcurrency, timeoutMs)` -- tries to create a lock file (exclusive).
  If all slots occupied, waits with staggered backoff (200ms * attempt + jitter) up to timeoutMs.
  Returns `{ acquired: true, slotIndex: N, release: Function }` or `{ acquired: false }` on timeout.
  MUST be fail-open: any fs error returns `{ acquired: true, release: noop }` (proceed without lock).
- `releaseSlot(providerKey, slotIndex)` -- removes the lock file. Fail-open on errors.
- Lock files contain: `{ pid: process.pid, ts: ISO timestamp, slot: slotName }` for debugging.
- Stale lock detection: if a lock file exists but the PID is not running (check via `process.kill(pid, 0)`),
  remove it and acquire. TTL fallback: remove locks older than 5 minutes regardless of PID.
- `providerKeyFromUrl(baseUrl)` -- helper that extracts hostname from baseUrl for the lock key
  (e.g., "api.together.xyz" from "https://api.together.xyz/v1").
- Export: `acquireSlot`, `releaseSlot`, `providerKeyFromUrl`.
- Use `'use strict'` and CommonJS per project conventions.

**Test file** `bin/provider-concurrency.test.cjs`:
- Test acquireSlot returns acquired:true when no locks exist
- Test acquireSlot respects max_concurrency (acquire N+1 should wait/fail)
- Test releaseSlot removes lock file
- Test stale lock cleanup (create lock with non-existent PID, verify acquisition succeeds)
- Test providerKeyFromUrl extracts hostname correctly
- Test fail-open: acquireSlot with invalid lock dir returns acquired:true
- Clean up test lock files in afterEach
  </action>
  <verify>
Run tests: `cd /Users/jonathanborduas/code/QGSD && node bin/provider-concurrency.test.cjs`
All tests pass. Lock files are created in /tmp/nf-provider-locks/ during test and cleaned up after.
  </verify>
  <done>
provider-concurrency.cjs exports acquireSlot, releaseSlot, providerKeyFromUrl.
All unit tests pass. Module is fail-open (fs errors never throw, always return acquired:true).
  </done>
</task>

<task type="auto">
  <name>Task 2: Integrate concurrency control into HTTP dispatch and configure providers</name>
  <files>bin/call-quorum-slot.cjs, bin/providers.json</files>
  <action>
**In `bin/call-quorum-slot.cjs`:**

1. Add require at top (after existing requires):
   `const { acquireSlot, releaseSlot, providerKeyFromUrl } = require('./provider-concurrency.cjs');`

2. Modify the `runHttp()` function to wrap the HTTP request with concurrency control:
   - Before the HTTP request, call `acquireSlot(providerKeyFromUrl(baseUrl), maxConcurrency, 30000)`
     where maxConcurrency comes from `provider.max_concurrency || 3`.
   - After the HTTP response (success or error), call the release function.
   - Pattern:
     ```
     const providerKey = providerKeyFromUrl(baseUrl);
     const maxConc = provider.max_concurrency || 3;
     const lock = acquireSlot(providerKey, maxConc, 30000);
     try {
       // existing HTTP request logic
     } finally {
       if (lock.acquired && lock.release) lock.release();
     }
     ```
   - Since runHttp is async (returns Promise), the acquire/release wraps the entire promise lifecycle.
   - The acquireSlot function is synchronous (uses fs.mkdirSync/writeFileSync) so it blocks before
     the HTTP call -- this is intentional to stagger requests.
   - Log to stderr when a slot waits: `[call-quorum-slot] CONCURRENCY: ${slot} waiting for ${providerKey} slot (${maxConc} max)`
   - Log to stderr when acquired after wait: `[call-quorum-slot] CONCURRENCY: ${slot} acquired ${providerKey} slot ${slotIndex}`

3. Do NOT modify the subprocess dispatch path (`runSubprocess`). Subprocess CLIs manage their own
   rate limiting internally. Only HTTP API slots need provider-level concurrency control.

**In `bin/providers.json`:**

Add `"max_concurrency": 3` to each HTTP provider entry (claude-1 through claude-6).
This means at most 3 of the 6 Together.xyz slots will fire HTTP requests simultaneously.
The remaining 3 will stagger with backoff (200ms * attempt + jitter).

Place the field after `"latency_budget_ms"` in each provider object for consistency.
Only add to `type: "http"` providers. Do NOT add to subprocess providers (codex-1, gemini-1, etc.).

**Important:** The `runHttp` function signature must gain the `provider` object parameter (it currently
only receives `provider, prompt, timeoutMs`). It already has `provider` as first arg, so `provider.max_concurrency`
is accessible. No signature change needed.
  </action>
  <verify>
1. Verify integration: `cd /Users/jonathanborduas/code/QGSD && grep -n 'provider-concurrency' bin/call-quorum-slot.cjs` -- shows require and usage
2. Verify config: `cd /Users/jonathanborduas/code/QGSD && node -e "const p = require('./bin/providers.json'); const http = p.providers.filter(x => x.type === 'http'); console.log(http.every(x => x.max_concurrency === 3) ? 'OK: all HTTP providers have max_concurrency=3' : 'FAIL')"` -- prints OK
3. Verify fail-open: `cd /Users/jonathanborduas/code/QGSD && node -e "const { acquireSlot } = require('./bin/provider-concurrency.cjs'); const r = acquireSlot('test-verify', 1, 100); console.log(r.acquired ? 'OK: acquired' : 'FAIL'); if (r.release) r.release();"` -- prints OK
4. Verify subprocess unaffected: `cd /Users/jonathanborduas/code/QGSD && grep -c 'provider-concurrency' bin/call-quorum-slot.cjs` -- exactly 1 require line + usage in runHttp only
5. Run existing tests if any: `cd /Users/jonathanborduas/code/QGSD && node bin/provider-concurrency.test.cjs`
  </verify>
  <done>
call-quorum-slot.cjs wraps HTTP dispatch with provider concurrency semaphore.
providers.json has max_concurrency: 3 on all HTTP providers.
Subprocess slots are unaffected. Concurrency control is fail-open.
At most 3 Together.xyz HTTP requests fire simultaneously; remaining 3 stagger with backoff.
  </done>
</task>

</tasks>

<verification>
1. All provider-concurrency.test.cjs tests pass
2. `grep 'provider-concurrency' bin/call-quorum-slot.cjs` shows integration
3. `node -e` spot-checks confirm acquireSlot/releaseSlot work correctly
4. providers.json HTTP entries all have max_concurrency: 3
5. No changes to subprocess dispatch path (codex-1, gemini-1, opencode-1, copilot-1)
6. Lock files use /tmp/ (not repo-tracked, no git noise)
</verification>

<success_criteria>
- Provider concurrency semaphore module exists and is tested
- HTTP dispatch in call-quorum-slot.cjs acquires/releases provider locks
- max_concurrency=3 configured for all Together.xyz HTTP slots
- Fail-open: any lock error proceeds without blocking (EventualConsensus preserved)
- Bounded wait (30s max) prevents permanent blocking (FullRecruitment preserved)
- Subprocess slots unchanged (no regression to CLI-based providers)
</success_criteria>

<output>
After completion, create `.planning/quick/369-add-provider-level-concurrency-control-t/369-SUMMARY.md`
</output>
