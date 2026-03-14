#!/usr/bin/env node
'use strict';
// bin/adapters/xstate-v5.test.cjs
// Tests for XState v5 adapter.

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { id, detect, extract } = require('./xstate-v5.cjs');

test('adapter id is xstate-v5', () => {
  assert.strictEqual(id, 'xstate-v5');
});

test('detect returns high confidence for XState v5 content', () => {
  const content = `
    import { createMachine } from 'xstate';
    export const machine = createMachine({ ... });
    machine.config.states;
  `;
  const confidence = detect('machine.ts', content);
  assert.ok(confidence >= 70, 'Expected >= 70, got ' + confidence);
});

test('detect returns 0 for Python content', () => {
  const content = `
    from transitions import Machine
    states = ['idle', 'running']
  `;
  const confidence = detect('app.py', content);
  assert.strictEqual(confidence, 0);
});

test('detect returns 50 for .machine.ts files', () => {
  const confidence = detect('my-workflow.machine.ts', 'some content');
  assert.strictEqual(confidence, 50);
});

test('extract on real nf-workflow.machine.ts produces valid IR', () => {
  const machineFile = path.join(__dirname, '..', '..', 'src', 'machines', 'nf-workflow.machine.ts');
  const ir = extract(machineFile, {
    userVars: {
      currentPhase: 'skip',
      maxDeliberation: 'const',
      successCount: 'event',
      slotsAvailable: 'event',
      deliberationRounds: 'deliberationRounds + 1',
    },
  });

  assert.strictEqual(ir.framework, 'xstate-v5');
  assert.strictEqual(ir.machineId, 'nf-workflow');
  assert.ok(ir.stateNames.length > 0, 'Should have states');
  assert.ok(ir.transitions.length > 0, 'Should have transitions');
  assert.ok(ir.stateNames.includes(ir.initial), 'initial should be in stateNames');
  // ctxVars should exclude 'skip' vars
  assert.ok(!ir.ctxVars.includes('currentPhase'), 'currentPhase should be skipped');
});
