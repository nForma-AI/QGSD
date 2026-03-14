#!/usr/bin/env node
'use strict';
// bin/adapters/sismic.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./sismic.cjs');

const fixture = `
statechart:
  name: traffic
  root:
    name: root
    initial: green
    states:
      - name: green
        transitions:
          - event: timer
            target: yellow
      - name: yellow
        transitions:
          - event: timer
            target: red
      - name: red
        transitions:
          - event: timer
            target: green
`;

test('adapter id is sismic', () => {
  assert.strictEqual(id, 'sismic');
});

test('detect returns high confidence for sismic YAML', () => {
  assert.ok(detect('traffic.yaml', fixture) >= 85);
});

test('detect returns 0 for plain text', () => {
  assert.strictEqual(detect('readme.txt', 'hello world'), 0);
});

test('extract parses sismic YAML fixture', () => {
  const tmpFile = path.join(os.tmpdir(), 'sismic-test-' + Date.now() + '.yaml');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'sismic');
    assert.strictEqual(ir.initial, 'green');
    assert.strictEqual(ir.stateNames.length, 3);
    assert.strictEqual(ir.transitions.length, 3);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
