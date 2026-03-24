#!/usr/bin/env node
'use strict';
// bin/solve-incremental-filter.test.cjs

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeAffectedLayers } = require('./solve-incremental-filter.cjs');

test('empty file list returns all layers (safe fallback)', () => {
  const result = computeAffectedLayers([]);
  assert.equal(result.files_analyzed, 0);
  assert.ok(result.affected_layers.length > 0);
  assert.equal(result.skip_layers.length, 0);
});

test('null input returns all layers', () => {
  const result = computeAffectedLayers(null);
  assert.equal(result.skip_layers.length, 0);
});

test('formal model files affect R→F, F→T, F→C', () => {
  const result = computeAffectedLayers(['.planning/formal/alloy/test.als']);
  assert.ok(result.affected_layers.includes('r_to_f'));
  assert.ok(result.affected_layers.includes('f_to_t'));
  assert.ok(result.affected_layers.includes('f_to_c'));
});

test('test files affect T→C, F→T, T→R', () => {
  const result = computeAffectedLayers(['bin/nf-solve.test.cjs']);
  assert.ok(result.affected_layers.includes('t_to_c'));
  assert.ok(result.affected_layers.includes('f_to_t'));
  assert.ok(result.affected_layers.includes('t_to_r'));
});

test('doc files affect R→D, D→C, D→R', () => {
  const result = computeAffectedLayers(['docs/dev/guide.md']);
  assert.ok(result.affected_layers.includes('r_to_d'));
  assert.ok(result.affected_layers.includes('d_to_c'));
  assert.ok(result.affected_layers.includes('d_to_r'));
});

test('source code files affect C→F, C→R', () => {
  const result = computeAffectedLayers(['bin/hazard-model.cjs']);
  assert.ok(result.affected_layers.includes('c_to_f'));
  assert.ok(result.affected_layers.includes('c_to_r'));
});

test('only formal models touched → many layers skipped', () => {
  const result = computeAffectedLayers([
    '.planning/formal/tla/NFDispatch.tla',
    '.planning/formal/alloy/test.als',
  ]);
  // Should NOT include d_to_c, d_to_r, t_to_r, c_to_r, hazard_model
  assert.ok(result.skip_layers.includes('d_to_c'));
  assert.ok(result.skip_layers.includes('hazard_model'));
  assert.ok(result.skip_layers.length > 0, 'should skip some layers');
});

test('unknown file type conservatively adds forward layers', () => {
  const result = computeAffectedLayers(['some/random/file.xyz']);
  assert.ok(result.affected_layers.includes('c_to_f'));
  assert.ok(result.affected_layers.includes('t_to_c'));
});

test('requirements.json affects R→F, R→D, reverse layers', () => {
  const result = computeAffectedLayers(['.planning/formal/requirements.json']);
  assert.ok(result.affected_layers.includes('r_to_f'));
  assert.ok(result.affected_layers.includes('r_to_d'));
  assert.ok(result.affected_layers.includes('c_to_r'));
  assert.ok(result.affected_layers.includes('t_to_r'));
});

test('ALWAYS_SWEEP layers are never skipped', () => {
  const result = computeAffectedLayers(['.planning/formal/alloy/test.als']);
  assert.ok(result.affected_layers.includes('r_to_f'));
  assert.ok(result.affected_layers.includes('r_to_d'));
});
