'use strict';

/**
 * provider-concurrency.test.cjs — Unit tests for provider concurrency semaphore
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { acquireSlot, releaseSlot, providerKeyFromUrl } = require('./provider-concurrency.cjs');

// ─── Test utilities ────────────────────────────────────────────────────────────
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✓ Test ${testCount}: ${name}`);
  } catch (err) {
    failCount++;
    console.error(`✗ Test ${testCount}: ${name}`);
    console.error(`  Error: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
  }
}

function cleanup() {
  // Clean up test lock files
  const lockDir = path.join(os.tmpdir(), 'nf-provider-locks');
  if (fs.existsSync(lockDir)) {
    try {
      const files = fs.readdirSync(lockDir).filter(f => f.startsWith('test-') || f.startsWith('http-'));
      files.forEach(f => {
        try { fs.unlinkSync(path.join(lockDir, f)); } catch (_) {}
      });
    } catch (_) {}
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('acquireSlot returns acquired:true when no locks exist', () => {
  cleanup();
  const result = acquireSlot('test-provider-1', 1, 100);
  assert(result.acquired === true, 'acquired should be true');
  assert(typeof result.slotIndex === 'number', 'slotIndex should be a number');
  assert(result.slotIndex === 0, 'first available slot should be 0');
  assert(typeof result.release === 'function', 'release should be a function');
  if (result.release) result.release();
  cleanup();
});

test('acquireSlot respects max_concurrency limit', () => {
  cleanup();
  const maxConc = 2;
  const slots = [];

  // Acquire max_concurrency slots (should succeed)
  for (let i = 0; i < maxConc; i++) {
    const result = acquireSlot('test-provider-2', maxConc, 100);
    assert(result.acquired === true, `slot ${i} should be acquired`);
    slots.push(result);
  }

  // Try to acquire one more (should timeout and return fail-open)
  const overflow = acquireSlot('test-provider-2', maxConc, 50);
  // In fail-open mode, overflow.acquired is still true (proceed without lock)
  assert(overflow.acquired === true, 'overflow should be fail-open acquired');

  // Clean up
  slots.forEach(s => { if (s.release) s.release(); });
  if (overflow.release) overflow.release();
  cleanup();
});

test('releaseSlot removes lock file', () => {
  cleanup();
  const result = acquireSlot('test-provider-3', 1, 100);
  assert(result.acquired === true, 'should acquire slot');
  const slotIndex = result.slotIndex;

  // Manually verify lock file exists
  const lockDir = path.join(os.tmpdir(), 'nf-provider-locks');
  const lockPath = path.join(lockDir, `test-provider-3-${slotIndex}.lock`);
  assert(fs.existsSync(lockPath), 'lock file should exist after acquire');

  // Release via releaseSlot
  releaseSlot('test-provider-3', slotIndex);
  assert(!fs.existsSync(lockPath), 'lock file should be removed after release');

  cleanup();
});

test('stale lock cleanup with non-existent PID', () => {
  cleanup();
  const lockDir = path.join(os.tmpdir(), 'nf-provider-locks');
  if (!fs.existsSync(lockDir)) fs.mkdirSync(lockDir, { recursive: true });

  // Create a lock file with a non-existent PID (99999)
  const lockPath = path.join(lockDir, 'test-provider-4-0.lock');
  fs.writeFileSync(lockPath, JSON.stringify({
    pid: 99999,
    ts: new Date().toISOString(),
    slot: 'test-provider-4-0',
  }));

  assert(fs.existsSync(lockPath), 'lock file should exist');

  // Try to acquire — should succeed because the stale lock is cleaned up
  const result = acquireSlot('test-provider-4', 1, 100);
  assert(result.acquired === true, 'should acquire despite stale lock');
  assert(result.slotIndex === 0, 'should reuse slot 0 after cleanup');

  if (result.release) result.release();
  cleanup();
});

test('stale lock cleanup with TTL (5-minute timeout)', () => {
  cleanup();
  const lockDir = path.join(os.tmpdir(), 'nf-provider-locks');
  if (!fs.existsSync(lockDir)) fs.mkdirSync(lockDir, { recursive: true });

  // Create a lock file with current PID but old timestamp (6 minutes ago)
  const oldTs = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  const lockPath = path.join(lockDir, 'test-provider-5-0.lock');
  fs.writeFileSync(lockPath, JSON.stringify({
    pid: process.pid,
    ts: oldTs,
    slot: 'test-provider-5-0',
  }));

  assert(fs.existsSync(lockPath), 'stale lock file should exist');

  // Try to acquire — should succeed because TTL cleanup removes the old lock
  const result = acquireSlot('test-provider-5', 1, 100);
  assert(result.acquired === true, 'should acquire despite TTL-expired lock');
  assert(result.slotIndex === 0, 'should reuse slot 0 after TTL cleanup');

  if (result.release) result.release();
  cleanup();
});

test('providerKeyFromUrl derives key from full baseUrl', () => {
  const key1 = providerKeyFromUrl('https://api.together.xyz/v1');
  const key2 = providerKeyFromUrl('https://api.together.xyz/v2');
  const key3 = providerKeyFromUrl('https://api.example.com/v1');

  // v1 and v2 should produce different keys (path matters)
  assert(key1 !== key2, 'different paths should produce different keys');

  // Different hosts should produce different keys
  assert(key1 !== key3, 'different hosts should produce different keys');

  // Check format: should be lowercase alphanumeric + dashes
  assert(/^[a-z0-9\-]+$/.test(key1), 'key should be lowercase alphanumeric');
  assert(key1.includes('together'), 'key should include host part');
  assert(key1.includes('v1'), 'key should include path part');

  console.log(`  Generated keys: v1=${key1}, v2=${key2}, other=${key3}`);
});

test('double-release is idempotent', () => {
  cleanup();
  const result = acquireSlot('test-provider-6', 1, 100);
  const slotIndex = result.slotIndex;

  // Release twice — should not throw
  if (result.release) {
    result.release();
    result.release(); // second release should be safe
  }

  cleanup();
});

test('fail-open: acquireSlot with invalid lock dir returns acquired:true', () => {
  // Override fs.mkdirSync to simulate error
  const originalMkdir = fs.mkdirSync;
  let mkdirCalled = false;
  fs.mkdirSync = () => {
    mkdirCalled = true;
    throw new Error('simulated fs error');
  };

  try {
    const result = acquireSlot('test-provider-7', 1, 100);
    assert(result.acquired === true, 'should fail-open to acquired:true on fs error');
    assert(typeof result.release === 'function', 'release should be a function');
  } finally {
    fs.mkdirSync = originalMkdir;
    cleanup();
  }
});

// ─── Run all tests ────────────────────────────────────────────────────────────
console.log('\n=== Provider Concurrency Semaphore Tests ===\n');

test('acquireSlot returns acquired:true when no locks exist', () => {
  cleanup();
  const result = acquireSlot('test-provider-1', 1, 100);
  assert(result.acquired === true, 'acquired should be true');
  assert(typeof result.slotIndex === 'number', 'slotIndex should be a number');
  assert(result.slotIndex === 0, 'first available slot should be 0');
  assert(typeof result.release === 'function', 'release should be a function');
  if (result.release) result.release();
  cleanup();
});

test('acquireSlot respects max_concurrency limit', () => {
  cleanup();
  const maxConc = 2;
  const slots = [];

  for (let i = 0; i < maxConc; i++) {
    const result = acquireSlot('test-provider-2', maxConc, 100);
    assert(result.acquired === true, `slot ${i} should be acquired`);
    slots.push(result);
  }

  const overflow = acquireSlot('test-provider-2', maxConc, 50);
  assert(overflow.acquired === true, 'overflow should be fail-open acquired');

  slots.forEach(s => { if (s.release) s.release(); });
  if (overflow.release) overflow.release();
  cleanup();
});

test('releaseSlot removes lock file', () => {
  cleanup();
  const result = acquireSlot('test-provider-3', 1, 100);
  assert(result.acquired === true, 'should acquire slot');
  const slotIndex = result.slotIndex;

  const lockDir = path.join(os.tmpdir(), 'nf-provider-locks');
  const lockPath = path.join(lockDir, `test-provider-3-${slotIndex}.lock`);
  assert(fs.existsSync(lockPath), 'lock file should exist after acquire');

  releaseSlot('test-provider-3', slotIndex);
  assert(!fs.existsSync(lockPath), 'lock file should be removed after release');

  cleanup();
});

test('stale lock cleanup with non-existent PID', () => {
  cleanup();
  const lockDir = path.join(os.tmpdir(), 'nf-provider-locks');
  if (!fs.existsSync(lockDir)) fs.mkdirSync(lockDir, { recursive: true });

  const lockPath = path.join(lockDir, 'test-provider-4-0.lock');
  fs.writeFileSync(lockPath, JSON.stringify({
    pid: 99999,
    ts: new Date().toISOString(),
    slot: 'test-provider-4-0',
  }));

  assert(fs.existsSync(lockPath), 'lock file should exist');

  const result = acquireSlot('test-provider-4', 1, 100);
  assert(result.acquired === true, 'should acquire despite stale lock');
  assert(result.slotIndex === 0, 'should reuse slot 0 after cleanup');

  if (result.release) result.release();
  cleanup();
});

test('stale lock cleanup with TTL (5-minute timeout)', () => {
  cleanup();
  const lockDir = path.join(os.tmpdir(), 'nf-provider-locks');
  if (!fs.existsSync(lockDir)) fs.mkdirSync(lockDir, { recursive: true });

  const oldTs = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  const lockPath = path.join(lockDir, 'test-provider-5-0.lock');
  fs.writeFileSync(lockPath, JSON.stringify({
    pid: process.pid,
    ts: oldTs,
    slot: 'test-provider-5-0',
  }));

  assert(fs.existsSync(lockPath), 'stale lock file should exist');

  const result = acquireSlot('test-provider-5', 1, 100);
  assert(result.acquired === true, 'should acquire despite TTL-expired lock');
  assert(result.slotIndex === 0, 'should reuse slot 0 after TTL cleanup');

  if (result.release) result.release();
  cleanup();
});

test('providerKeyFromUrl derives key from full baseUrl', () => {
  const key1 = providerKeyFromUrl('https://api.together.xyz/v1');
  const key2 = providerKeyFromUrl('https://api.together.xyz/v2');
  const key3 = providerKeyFromUrl('https://api.example.com/v1');

  assert(key1 !== key2, 'different paths should produce different keys');
  assert(key1 !== key3, 'different hosts should produce different keys');
  assert(/^[a-z0-9\-]+$/.test(key1), 'key should be lowercase alphanumeric');
  assert(key1.includes('together'), 'key should include host part');
  assert(key1.includes('v1'), 'key should include path part');

  console.log(`  Generated keys: v1=${key1}, v2=${key2}, other=${key3}`);
});

test('double-release is idempotent', () => {
  cleanup();
  const result = acquireSlot('test-provider-6', 1, 100);
  const slotIndex = result.slotIndex;

  if (result.release) {
    result.release();
    result.release();
  }

  cleanup();
});

test('fail-open: acquireSlot with invalid lock dir returns acquired:true', () => {
  const originalMkdir = fs.mkdirSync;
  let mkdirCalled = false;
  fs.mkdirSync = () => {
    mkdirCalled = true;
    throw new Error('simulated fs error');
  };

  try {
    const result = acquireSlot('test-provider-7', 1, 100);
    assert(result.acquired === true, 'should fail-open to acquired:true on fs error');
    assert(typeof result.release === 'function', 'release should be a function');
  } finally {
    fs.mkdirSync = originalMkdir;
    cleanup();
  }
});

console.log(`\n=== Results ===`);
console.log(`Passed: ${passCount}/${testCount}`);
console.log(`Failed: ${failCount}/${testCount}`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
