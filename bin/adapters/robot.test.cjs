#!/usr/bin/env node
'use strict';
// bin/adapters/robot.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./robot.cjs');

test('adapter id is robot', () => {
  assert.strictEqual(id, 'robot');
});

test('detect returns high confidence for Robot content', () => {
  const content = `
import { createMachine, state, transition } from 'robot3';
const machine = createMachine({ idle: state(transition('start', 'running')) });`;
  assert.ok(detect('machine.js', content) >= 80);
});

test('detect returns 0 for unrelated content', () => {
  assert.strictEqual(detect('app.py', 'import sys'), 0);
});

test('extract parses Robot fixture', () => {
  const fixture = `
import { createMachine, state, transition } from 'robot3';
const machine = createMachine({
  idle: state(transition('start', 'running')),
  running: state(transition('stop', 'idle'), transition('finish', 'done')),
  done: state()
});`;
  const tmpFile = path.join(os.tmpdir(), 'robot-test-' + Date.now() + '.js');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'robot');
    assert.strictEqual(ir.initial, 'idle');
    assert.strictEqual(ir.stateNames.length, 3);
    assert.strictEqual(ir.transitions.length, 3);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
