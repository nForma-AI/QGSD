'use strict';

/**
 * provider-concurrency.cjs — File-based provider concurrency semaphore
 *
 * Implements provider-level concurrency control via lock files in /tmp/nf-provider-locks/.
 * Prevents rate-limit cascades when multiple quorum slots share the same API provider
 * (e.g., 6 Together.xyz slots firing simultaneously).
 *
 * Exports:
 *   - acquireSlot(providerKey, maxConcurrency, timeoutMs): async acquire a slot
 *   - releaseSlot(providerKey, slotIndex): release a slot
 *   - providerKeyFromUrl(baseUrl): derive a lock key from a provider baseUrl
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Config ────────────────────────────────────────────────────────────────────
const LOCK_DIR = path.join(require('os').tmpdir(), 'nf-provider-locks');
const STALE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const BACKOFF_BASE_MS = 200; // base backoff: 200ms * attempt + jitter

// ─── Helper: normalize and hash baseUrl to lock key ────────────────────────────
function providerKeyFromUrl(baseUrl) {
  // Extract protocol, host, and path from the baseUrl
  // E.g., "https://api.together.xyz/v1" -> "api-together-xyz-v1"
  try {
    const url = new URL(baseUrl);
    const hostPart = url.hostname.replace(/\./g, '-'); // api.together.xyz -> api-together-xyz
    const pathPart = url.pathname.replace(/^\//, '').replace(/\//g, '-') || 'root'; // /v1 -> v1
    return `${hostPart}-${pathPart}`.toLowerCase();
  } catch (_) {
    // Fallback for invalid URLs: hash the baseUrl
    const hash = crypto.createHash('sha256').update(baseUrl).digest('hex').slice(0, 8);
    return `provider-${hash}`;
  }
}

// ─── Helper: check if a process is running ────────────────────────────────────
function isProcessRunning(pid) {
  try {
    // process.kill(pid, 0) returns nothing if process exists, throws if not
    process.kill(pid, 0);
    return true;
  } catch (_) {
    return false;
  }
}

// ─── Helper: clean up stale lock files ────────────────────────────────────────
function cleanupStaleLocks(providerKey, maxConcurrency) {
  try {
    // Check all slots for this provider
    for (let i = 0; i < maxConcurrency; i++) {
      const lockPath = path.join(LOCK_DIR, `${providerKey}-${i}.lock`);
      if (!fs.existsSync(lockPath)) continue;

      try {
        const content = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        const lockPid = content.pid;
        const lockTs = new Date(content.ts).getTime();
        const ageMs = Date.now() - lockTs;

        // Remove if:
        // 1. PID is not running (process exited without cleanup), OR
        // 2. Lock is older than 5 minutes (TTL-based cleanup)
        if (!isProcessRunning(lockPid) || ageMs > STALE_TTL_MS) {
          fs.unlinkSync(lockPath);
        }
      } catch (_) {
        // Malformed lock file — remove it
        try { fs.unlinkSync(lockPath); } catch (_) {}
      }
    }
  } catch (_) {
    // Cleanup errors are non-fatal — log but continue
    process.stderr.write(`[provider-concurrency] cleanup error: ${_}\n`);
  }
}

// ─── Acquire a slot with staggered backoff ─────────────────────────────────────
function acquireSlot(providerKey, maxConcurrency, timeoutMs) {
  // Fail-open pattern: any error returns acquired:true (proceed without lock)
  try {
    // Ensure lock directory exists
    if (!fs.existsSync(LOCK_DIR)) {
      fs.mkdirSync(LOCK_DIR, { recursive: true });
    }

    // Clean up stale locks first
    cleanupStaleLocks(providerKey, maxConcurrency);

    // Try to acquire an available slot with staggered backoff
    const startTime = Date.now();
    let attempt = 0;

    while (true) {
      // Try each slot in order
      for (let slotIndex = 0; slotIndex < maxConcurrency; slotIndex++) {
        const lockPath = path.join(LOCK_DIR, `${providerKey}-${slotIndex}.lock`);

        // Try to create the lock file exclusively (fail if exists)
        try {
          const lockContent = JSON.stringify({
            pid: process.pid,
            ts: new Date().toISOString(),
            slot: `${providerKey}-${slotIndex}`,
          });
          fs.writeFileSync(lockPath, lockContent, { flag: 'wx' }); // wx = write exclusive

          // Successfully acquired
          return {
            acquired: true,
            slotIndex,
            release: () => {
              try {
                fs.unlinkSync(lockPath);
              } catch (_) {
                // Idempotent: double-release is safe
              }
            },
          };
        } catch (err) {
          // EEXIST = slot occupied, try next slot
          if (err.code === 'EEXIST') continue;
          // Other errors are non-fatal in fail-open mode
          throw err;
        }
      }

      // All slots occupied — wait with backoff
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs >= timeoutMs) {
        // Timeout — return fail-open (proceed without lock)
        return {
          acquired: true,
          slotIndex: null,
          release: () => {}, // no-op
        };
      }

      // Staggered backoff: 200ms * attempt + jitter (0-100ms)
      const delayMs = BACKOFF_BASE_MS * (attempt + 1) + Math.random() * 100;
      const remainingMs = timeoutMs - elapsedMs;
      const actualDelayMs = Math.min(delayMs, remainingMs);

      // Sleep synchronously using busy-wait (non-blocking version would need async)
      // For simplicity and synchronous API, we use setTimeout's event loop
      const deadline = Date.now() + actualDelayMs;
      while (Date.now() < deadline) {
        // Busy-wait — fs operations implicitly yield
      }

      attempt++;
    }
  } catch (err) {
    // Fail-open: any error returns acquired:true (proceed without lock)
    // This ensures concurrency control failures never block dispatch
    return {
      acquired: true,
      slotIndex: null,
      release: () => {}, // no-op
    };
  }
}

// ─── Release a slot by removing its lock file ──────────────────────────────────
function releaseSlot(providerKey, slotIndex) {
  // Fail-open: release errors never throw
  try {
    if (slotIndex === null) return; // Was acquired without lock (fail-open path)
    const lockPath = path.join(LOCK_DIR, `${providerKey}-${slotIndex}.lock`);
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch (_) {
    // Non-fatal — fail-open
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────────
module.exports = {
  acquireSlot,
  releaseSlot,
  providerKeyFromUrl,
};
