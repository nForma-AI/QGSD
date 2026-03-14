#!/usr/bin/env node
'use strict';
// bin/adapters/asl.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./asl.cjs');

const fixture = JSON.stringify({
  StartAt: 'ProcessOrder',
  States: {
    ProcessOrder: { Type: 'Task', Next: 'CheckStatus' },
    CheckStatus: {
      Type: 'Choice',
      Choices: [{ Variable: '$.status', StringEquals: 'approved', Next: 'Complete' }],
      Default: 'Failed',
    },
    Complete: { Type: 'Succeed' },
    Failed: { Type: 'Fail' },
  },
});

test('adapter id is asl', () => {
  assert.strictEqual(id, 'asl');
});

test('detect returns high confidence for ASL JSON', () => {
  assert.ok(detect('workflow.json', fixture) >= 90);
});

test('detect returns 0 for non-ASL content', () => {
  assert.strictEqual(detect('data.json', '{"key": "value"}'), 0);
});

test('extract parses ASL fixture', () => {
  const tmpFile = path.join(os.tmpdir(), 'asl-test-' + Date.now() + '.json');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'asl');
    assert.strictEqual(ir.initial, 'ProcessOrder');
    assert.strictEqual(ir.stateNames.length, 4);
    assert.strictEqual(ir.finalStates.length, 2);
    assert.strictEqual(ir.transitions.length, 3); // Next + Choice(guarded) + Choice(default)
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
