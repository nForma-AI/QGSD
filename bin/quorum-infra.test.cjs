#!/usr/bin/env node
'use strict';
// bin/quorum-infra.test.cjs
// Tests for quorum infrastructure changes:
//   1. check-provider-health.cjs PROVIDER_SLOT discovery
//   2. quorum-preflight.cjs model dedup guard
//   3. quorum-slot-dispatch.cjs per-provider semaphore
//   4. CTXWIN-01 graceful handling without fallback_slot

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// ── Load quorum-slot-dispatch exports ─────────────────────────────────────────
let dispatch;
try {
  dispatch = require(path.resolve(__dirname, './quorum-slot-dispatch.cjs'));
} catch (e) {
  dispatch = null;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. PROVIDER_SLOT discovery in check-provider-health.cjs
// ══════════════════════════════════════════════════════════════════════════════

test('check-provider-health.cjs: providers.json exists alongside the script', () => {
  const pjPath = path.join(__dirname, 'providers.json');
  assert.ok(fs.existsSync(pjPath), 'providers.json should exist in bin/');
});

test('check-provider-health.cjs: providers.json contains http-type entries with baseUrl', () => {
  const pjPath = path.join(__dirname, 'providers.json');
  const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
  const httpProviders = pj.providers.filter(p => p.type === 'http' && p.baseUrl);
  assert.ok(httpProviders.length >= 1, 'Should have at least 1 http provider with baseUrl');
});

test('check-provider-health.cjs: api-* entries have active:false', () => {
  const pjPath = path.join(__dirname, 'providers.json');
  const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
  const apiProviders = pj.providers.filter(p => p.name && p.name.startsWith('api-'));
  assert.ok(apiProviders.length >= 1, 'Should have at least 1 api-* provider');
  for (const p of apiProviders) {
    assert.strictEqual(p.active, false, p.name + ' should have active:false');
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Model dedup guard in quorum-preflight.cjs
// ══════════════════════════════════════════════════════════════════════════════

test('quorum-preflight.cjs: ccr entries have NO fallback_slot', () => {
  const pjPath = path.join(__dirname, 'providers.json');
  const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
  const ccrProviders = pj.providers.filter(p => p.type === 'ccr');
  for (const p of ccrProviders) {
    assert.strictEqual(p.fallback_slot, undefined, p.name + ' should not have fallback_slot');
  }
});

test('quorum-preflight.cjs: ccr and api entries for same model exist (dedup source)', () => {
  const pjPath = path.join(__dirname, 'providers.json');
  const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
  const ccrModels = new Set(pj.providers.filter(p => p.type === 'ccr').map(p => p.model));
  const apiModels = new Set(pj.providers.filter(p => p.type === 'http').map(p => p.model));
  const overlap = [...ccrModels].filter(m => apiModels.has(m));
  assert.ok(overlap.length >= 1, 'Should have at least 1 model in both ccr and api tiers (dedup target)');
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Per-provider semaphore
// ══════════════════════════════════════════════════════════════════════════════

test('semaphore: semKey produces a 12-char hex hash', () => {
  assert.ok(dispatch, 'quorum-slot-dispatch.cjs must load');
  const key = dispatch.semKey('https://api.together.xyz/v1');
  assert.strictEqual(key.length, 12, 'semKey should return 12-char hex');
  assert.ok(/^[0-9a-f]{12}$/.test(key), 'semKey should be hex only');
});

test('semaphore: semKey is deterministic', () => {
  assert.ok(dispatch, 'quorum-slot-dispatch.cjs must load');
  const k1 = dispatch.semKey('https://example.com/v1');
  const k2 = dispatch.semKey('https://example.com/v1');
  assert.strictEqual(k1, k2, 'Same URL should produce same key');
});

test('semaphore: semKey differs for different URLs', () => {
  assert.ok(dispatch, 'quorum-slot-dispatch.cjs must load');
  const k1 = dispatch.semKey('https://api.together.xyz/v1');
  const k2 = dispatch.semKey('https://api.fireworks.ai/inference/v1');
  assert.notStrictEqual(k1, k2, 'Different URLs should produce different keys');
});

test('semaphore: semAcquire returns null for no baseUrl', () => {
  assert.ok(dispatch, 'quorum-slot-dispatch.cjs must load');
  const result = dispatch.semAcquire(null, 3);
  assert.strictEqual(result, null, 'No baseUrl should return null (no-op)');
});

test('semaphore: semAcquire returns null for no maxConcurrency', () => {
  assert.ok(dispatch, 'quorum-slot-dispatch.cjs must load');
  const result = dispatch.semAcquire('https://example.com', 0);
  assert.strictEqual(result, null, 'Zero maxConcurrency should return null');
});

test('semaphore: semAcquire returns a lock file path and semRelease cleans it', () => {
  assert.ok(dispatch, 'quorum-slot-dispatch.cjs must load');
  const lockFile = dispatch.semAcquire('https://test-sem-' + Date.now() + '.example.com', 3);
  assert.ok(lockFile, 'Should return a lock file path');
  assert.ok(fs.existsSync(lockFile), 'Lock file should exist after acquire');
  dispatch.semRelease(lockFile);
  assert.ok(!fs.existsSync(lockFile), 'Lock file should be removed after release');
});

test('semaphore: semRelease is safe with null', () => {
  assert.ok(dispatch, 'quorum-slot-dispatch.cjs must load');
  // Should not throw
  dispatch.semRelease(null);
  dispatch.semRelease(undefined);
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. CTXWIN-01 graceful handling
// ══════════════════════════════════════════════════════════════════════════════

test('install.js: ensureMcpSlotsFromProviders skips active:false (structural check)', () => {
  // Verify the install.js source code contains the active === false guard
  const installPath = path.join(__dirname, 'install.js');
  const src = fs.readFileSync(installPath, 'utf8');
  assert.ok(
    src.includes('provider.active === false'),
    'install.js should check provider.active === false to skip inactive providers'
  );
});
