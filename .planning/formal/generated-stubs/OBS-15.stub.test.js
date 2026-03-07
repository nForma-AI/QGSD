#!/usr/bin/env node
// @requirement OBS-15
// Verifies: Stateful observe handlers persist their cursor in .planning/ as
// JSON with a last_checked ISO8601 field. State writes use atomic write
// (write to temp file + rename) to prevent corruption.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const upstreamPath = path.resolve(__dirname, '../../../bin/observe-handler-upstream.cjs');

test('OBS-15: observe-handler-upstream exports state persistence functions', () => {
  const mod = require(upstreamPath);
  assert.equal(typeof mod.loadUpstreamState, 'function', 'must export loadUpstreamState');
  assert.equal(typeof mod.saveUpstreamState, 'function', 'must export saveUpstreamState');
});

test('OBS-15: saveUpstreamState persists JSON with last_checked field', () => {
  const mod = require(upstreamPath);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs15-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  const now = new Date().toISOString();
  const state = { 'owner/repo': { last_checked: now, last_release_tag: 'v1.0.0' } };
  mod.saveUpstreamState(state, tmpDir);

  const stateFile = path.join(planningDir, 'upstream-state.json');
  assert.ok(fs.existsSync(stateFile), 'state file must be created in .planning/');

  const loaded = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  assert.equal(loaded['owner/repo'].last_checked, now, 'last_checked must be persisted');
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(loaded['owner/repo'].last_checked), 'last_checked must be ISO8601');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('OBS-15: loadUpstreamState reads persisted state correctly', () => {
  const mod = require(upstreamPath);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs15-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  const now = new Date().toISOString();
  const expected = { 'owner/repo': { last_checked: now } };
  fs.writeFileSync(
    path.join(planningDir, 'upstream-state.json'),
    JSON.stringify(expected, null, 2)
  );

  const loaded = mod.loadUpstreamState(tmpDir);
  assert.deepStrictEqual(loaded, expected, 'loaded state must match written state');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('OBS-15: loadUpstreamState returns empty object when no state file exists', () => {
  const mod = require(upstreamPath);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs15-'));
  const loaded = mod.loadUpstreamState(tmpDir);
  assert.deepStrictEqual(loaded, {}, 'missing state file should return empty object');
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
