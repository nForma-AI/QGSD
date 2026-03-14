#!/usr/bin/env node
'use strict';
// bin/adapters/jsm.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./jsm.cjs');

test('adapter id is jsm', () => {
  assert.strictEqual(id, 'jsm');
});

test('detect returns high confidence for JSM content', () => {
  const content = `const config = { init: "green", transitions: [ { name: "warn", from: "green", to: "yellow" } ] };`;
  assert.ok(detect('traffic.js', content) >= 85);
});

test('detect returns 0 for unrelated content', () => {
  assert.strictEqual(detect('app.py', 'from transitions import Machine'), 0);
});

test('extract parses JSM fixture', () => {
  const fixture = `module.exports = { init: "green", transitions: [ { name: "warn", from: "green", to: "yellow" }, { name: "stop", from: "yellow", to: "red" }, { name: "go", from: "red", to: "green" } ] };`;
  const tmpFile = path.join(os.tmpdir(), 'jsm-test-' + Date.now() + '.js');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'jsm');
    assert.strictEqual(ir.initial, 'green');
    assert.strictEqual(ir.stateNames.length, 3);
    assert.strictEqual(ir.transitions.length, 3);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
