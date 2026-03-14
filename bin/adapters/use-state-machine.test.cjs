#!/usr/bin/env node
'use strict';
// bin/adapters/use-state-machine.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./use-state-machine.cjs');

const fixture = `
import useStateMachine from '@cassiozen/usestatemachine';

function App() {
  const [state, send] = useStateMachine({
    initial: "idle",
    states: {
      idle: {
        on: { START: "loading", RESET: "idle" }
      },
      loading: {
        on: { SUCCESS: "success", FAILURE: "error" }
      },
      success: {
        on: { RESET: "idle" }
      },
      error: {
        on: { RETRY: "loading" }
      }
    }
  });
}
`;

test('adapter id is use-state-machine', () => {
  assert.strictEqual(id, 'use-state-machine');
});

test('detect returns high confidence for useStateMachine code', () => {
  assert.ok(detect('App.tsx', fixture) >= 90);
});

test('detect returns 0 for unrelated content', () => {
  assert.strictEqual(detect('app.py', 'import flask'), 0);
});

test('extract parses useStateMachine fixture', () => {
  const tmpFile = path.join(os.tmpdir(), 'use-state-machine-test-' + Date.now() + '.tsx');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'use-state-machine');
    assert.strictEqual(ir.initial, 'idle');
    assert.strictEqual(ir.stateNames.length, 4);
    assert.strictEqual(ir.transitions.length, 6);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
