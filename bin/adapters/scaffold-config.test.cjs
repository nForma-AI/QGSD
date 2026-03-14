#!/usr/bin/env node
'use strict';
// bin/adapters/scaffold-config.test.cjs
// Tests for scaffold-config.

const { test } = require('node:test');
const assert = require('node:assert');
const { scaffoldConfig } = require('./scaffold-config.cjs');

test('scaffoldConfig produces guards and vars from IR', () => {
  const ir = {
    machineId: 'test',
    initial: 'idle',
    stateNames: ['idle', 'running', 'done'],
    finalStates: ['done'],
    transitions: [
      { fromState: 'idle', event: 'START', guard: 'isReady', target: 'running', assignedKeys: [] },
      { fromState: 'running', event: 'FINISH', guard: 'hasData', target: 'done', assignedKeys: [] },
    ],
    ctxVars: ['count', 'name', 'flag'],
    ctxDefaults: { count: 0, name: '', flag: false },
    sourceFile: 'test.ts',
    framework: 'xstate-v5',
  };

  const config = scaffoldConfig(ir);
  assert.ok(config.guards);
  assert.ok(config.vars);

  // 2 guards
  assert.ok(config.guards.isReady);
  assert.ok(config.guards.hasData);
  assert.ok(config.guards.isReady.includes('FIXME'));
  assert.ok(config.guards.hasData.includes('FIXME'));

  // 3 vars
  assert.ok(config.vars.count);
  assert.ok(config.vars.name);
  assert.ok(config.vars.flag);
  assert.ok(config.vars.count.includes('FIXME'));
});

test('scaffoldConfig handles IR with no guards', () => {
  const ir = {
    machineId: 'test',
    initial: 'a',
    stateNames: ['a', 'b'],
    finalStates: [],
    transitions: [
      { fromState: 'a', event: 'GO', guard: null, target: 'b', assignedKeys: [] },
    ],
    ctxVars: [],
    ctxDefaults: {},
    sourceFile: 'test.ts',
    framework: 'test',
  };

  const config = scaffoldConfig(ir);
  assert.deepStrictEqual(config.guards, {});
  assert.deepStrictEqual(config.vars, {});
});
