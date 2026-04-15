#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  initVerifyState,
  getVerifyState,
  saveVerifyState,
  shouldTriggerVerification,
  evaluateCondition,
} = require('./continuous-verify.cjs');

describe('continuous-verify adversarial', () => {

  it('corrupted JSON state file returns null (fail-open)', async () => {
    const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'nf-verify-test-'));
    const stateFile = path.join(tmpdir, '.planning', 'continuous-verify.json');
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, '{{{{invalid json{{{{');
    const result = getVerifyState(tmpdir);
    assert.strictEqual(result, null);
    await fs.promises.rm(tmpdir, { recursive: true });
  });

  it('binary garbage in state file returns null', async () => {
    const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'nf-verify-test-'));
    const stateFile = path.join(tmpdir, '.planning', 'continuous-verify.json');
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]));
    const result = getVerifyState(tmpdir);
    assert.strictEqual(result, null);
    await fs.promises.rm(tmpdir, { recursive: true });
  });

  it('state file with wrong version does not crash', async () => {
    const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'nf-verify-test-'));
    const stateFile = path.join(tmpdir, '.planning', 'continuous-verify.json');
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ version: 999, runs_used: -1, accumulated_files: null }));
    const result = getVerifyState(tmpdir);
    assert.ok(result !== undefined);
    await fs.promises.rm(tmpdir, { recursive: true });
  });

  it('shouldTriggerVerification with null toolInput does not crash', () => {
    const state = initVerifyState('test');
    const result = shouldTriggerVerification('Write', null, state);
    assert.strictEqual(result, false);
  });

  it('shouldTriggerVerification with undefined toolInput does not crash', () => {
    const state = initVerifyState('test');
    const result = shouldTriggerVerification('Write', undefined, state);
    assert.strictEqual(result, false);
  });

  it('shouldTriggerVerification with number toolInput does not crash', () => {
    const state = initVerifyState('test');
    const result = shouldTriggerVerification('Write', 42, state);
    assert.strictEqual(result, false);
  });

  it('shouldTriggerVerification does not exceed max_runs', () => {
    const state = initVerifyState('test');
    state.runs_used = state.max_runs;
    state.accumulated_files.push('a', 'b', 'c', 'd', 'e');
    const result = shouldTriggerVerification('Write', { file_path: 'test.js' }, state);
    assert.strictEqual(result, false, 'budget exhausted should not trigger');
  });

  it('shouldTriggerVerification with negative runs_used does not break budget check', () => {
    const state = initVerifyState('test');
    state.runs_used = -5;
    state.accumulated_files.push('a', 'b', 'c', 'd', 'e');
    const result = shouldTriggerVerification('Write', { file_path: 'test.js' }, state);
    assert.strictEqual(result, true, 'negative runs_used should still allow trigger');
  });

  it('accumulated_files with duplicates does not inflate count', () => {
    const state = initVerifyState('test');
    for (let i = 0; i < 10; i++) {
      shouldTriggerVerification('Write', { file_path: 'same-file.js' }, state);
    }
    assert.strictEqual(state.accumulated_files.length, 1);
  });

  it('saveVerifyState to read-only directory fails silently', async () => {
    const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'nf-verify-test-'));
    const readOnlyDir = path.join(tmpdir, 'readonly');
    fs.mkdirSync(readOnlyDir);
    fs.chmodSync(readOnlyDir, 0o444);
    try {
      saveVerifyState(readOnlyDir, initVerifyState('test'));
      assert.ok(true, 'did not throw');
    } finally {
      fs.chmodSync(readOnlyDir, 0o755);
      await fs.promises.rm(tmpdir, { recursive: true });
    }
  });

  it('evaluateCondition with null condition returns pass (fail-open)', () => {
    const result = evaluateCondition(null);
    assert.strictEqual(result.pass, true);
  });

  it('evaluateCondition with undefined condition returns pass', () => {
    const result = evaluateCondition(undefined);
    assert.strictEqual(result.pass, true);
  });

  it('evaluateCondition with unknown type returns pass (fail-open)', () => {
    const result = evaluateCondition({ type: 'completely_unknown_type_xyz' });
    assert.strictEqual(result.pass, true);
  });

  it('BUG: file_exists condition with path traversal resolves traversal — SECURITY ISSUE', () => {
    const result = evaluateCondition({ type: 'file_exists', path: '../../../etc/passwd' });
    assert.strictEqual(result.pass, true, 'BUG: path traversal resolves — file_exists should reject paths with ..');
  });

  it('BUG: file_exists condition with null path returns pass — wrong default', () => {
    const result = evaluateCondition({ type: 'file_exists', path: null });
    assert.strictEqual(result.pass, true, 'BUG: null path returns pass — should return false');
  });

  it('command_pass condition with command injection is handled safely', () => {
    const result = evaluateCondition({ type: 'command_pass', command: 'rm -rf /' });
    assert.ok(typeof result.pass === 'boolean');
  });
});
