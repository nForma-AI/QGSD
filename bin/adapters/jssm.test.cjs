#!/usr/bin/env node
'use strict';
// bin/adapters/jssm.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./jssm.cjs');

const fixture = `
import { sm } from 'jssm';

const traffic = sm\`
  idle -> running;
  running -> paused;
  paused -> running;
  running -> done;
\`;
`;

test('adapter id is jssm', () => {
  assert.strictEqual(id, 'jssm');
});

test('detect returns high confidence for jssm code', () => {
  assert.ok(detect('workflow.js', fixture) >= 90);
});

test('detect returns 0 for unrelated content', () => {
  assert.strictEqual(detect('app.py', 'import sys'), 0);
});

test('extract parses jssm fixture', () => {
  const tmpFile = path.join(os.tmpdir(), 'jssm-test-' + Date.now() + '.js');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'jssm');
    assert.strictEqual(ir.initial, 'idle');
    assert.strictEqual(ir.stateNames.length, 4);
    assert.strictEqual(ir.transitions.length, 4);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
