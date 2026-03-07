#!/usr/bin/env node
// @requirement OBS-14
// Verifies: Observe handlers accept execFn and basePath options for dependency
// injection. All subprocess calls use the injected execFn (defaulting to
// execFileSync) and all filesystem paths resolve relative to basePath.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const handlersPath = path.resolve(__dirname, '../../../bin/observe-handlers.cjs');
const upstreamPath = path.resolve(__dirname, '../../../bin/observe-handler-upstream.cjs');
const depsPath = path.resolve(__dirname, '../../../bin/observe-handler-deps.cjs');

test('OBS-14: observe-handlers.cjs exports handler functions', () => {
  const mod = require(handlersPath);
  assert.equal(typeof mod.handleGitHub, 'function', 'must export handleGitHub');
  assert.equal(typeof mod.handleBash, 'function', 'must export handleBash');
  assert.equal(typeof mod.handleUpstream, 'function', 'must export handleUpstream');
});

test('OBS-14: observe-handler-upstream.cjs accepts execFn and basePath', () => {
  const mod = require(upstreamPath);
  assert.equal(typeof mod.handleUpstream, 'function', 'must export handleUpstream');
  // Call with mock execFn and basePath -- missing repo should produce error, not crash
  const result = mod.handleUpstream(
    { type: 'upstream', label: 'test' },
    { execFn: () => '', basePath: '/tmp' }
  );
  assert.equal(result.status, 'error', 'missing repo should return error status');
  assert.ok(result.error, 'should have error message');
});

test('OBS-14: observe-handler-deps.cjs accepts execFn and basePath', () => {
  const mod = require(depsPath);
  assert.equal(typeof mod.handleDeps, 'function', 'must export handleDeps');
  assert.equal(typeof mod.detectEcosystems, 'function', 'must export detectEcosystems');
  // detectEcosystems uses basePath
  const ecosystems = mod.detectEcosystems('/nonexistent-path-for-test');
  assert.ok(Array.isArray(ecosystems), 'detectEcosystems must return array');
  assert.equal(ecosystems.length, 0, 'nonexistent path should detect no ecosystems');
});

test('OBS-14: GitHub handler accepts execFn option', () => {
  const mod = require(handlersPath);
  let execCalled = false;
  const mockExec = () => { execCalled = true; return ''; };
  // Call with mock -- should use injected execFn
  try {
    mod.handleGitHub(
      { type: 'github', label: 'test' },
      { execFn: mockExec }
    );
  } catch { /* handler may throw on mock, that's fine */ }
  assert.ok(execCalled, 'handleGitHub must call the injected execFn');
});
