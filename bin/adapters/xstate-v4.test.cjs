#!/usr/bin/env node
'use strict';
// bin/adapters/xstate-v4.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./xstate-v4.cjs');

const fixture = `module.exports = { initial: "idle", states: { idle: { on: { START: { target: "running" } } }, running: { on: { STOP: { target: "idle" }, FINISH: { target: "done" } } }, done: {} }, context: {} };`;

test('adapter id is xstate-v4', () => {
  assert.strictEqual(id, 'xstate-v4');
});

test('detect returns high confidence for XState v4 content', () => {
  const content = `
    import { Machine } from 'xstate';
    const machine = Machine({
      initial: 'idle',
      states: { idle: {}, running: {} }
    });
  `;
  assert.ok(detect('machine.ts', content) >= 85);
});

test('detect returns 0 for unrelated content', () => {
  assert.strictEqual(detect('app.py', 'from transitions import Machine'), 0);
});

test('extract parses XState v4 fixture with correct counts', () => {
  const tmpFile = path.join(os.tmpdir(), 'xstate-v4-test-' + Date.now() + '.js');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'xstate-v4');
    assert.strictEqual(ir.initial, 'idle');
    assert.strictEqual(ir.stateNames.length, 3);
    assert.strictEqual(ir.transitions.length, 3);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
