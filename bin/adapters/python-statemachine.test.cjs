#!/usr/bin/env node
'use strict';
// bin/adapters/python-statemachine.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./python-statemachine.cjs');

const fixture = `
from statemachine import StateMachine, State

class TrafficLightMachine(StateMachine):
    green = State(initial=True)
    yellow = State()
    red = State()

    slow_down = green.to(yellow)
    stop = yellow.to(red)
    go = red.to(green)
`;

test('adapter id is python-statemachine', () => {
  assert.strictEqual(id, 'python-statemachine');
});

test('detect returns high confidence for python-statemachine code', () => {
  assert.ok(detect('traffic.py', fixture) >= 90);
});

test('detect returns 0 for unrelated Python code', () => {
  assert.strictEqual(detect('app.py', 'import os\nimport sys'), 0);
});

test('extract parses python-statemachine fixture', () => {
  const tmpFile = path.join(os.tmpdir(), 'python-statemachine-test-' + Date.now() + '.py');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'python-statemachine');
    assert.strictEqual(ir.initial, 'green');
    assert.strictEqual(ir.stateNames.length, 3);
    assert.strictEqual(ir.transitions.length, 3);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
