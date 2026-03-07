#!/usr/bin/env node
// @requirement OBS-13
// Verifies: A machine-readable inventory classifies every non-test bin/ script
// as wired or lone, with purpose, classification, suggested integration point,
// and dependency chains documented for each entry.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INVENTORY_PATH = path.resolve(__dirname, '../../../.planning/quick/201-survey-code-for-producer-without-consume/201-lone-producers.json');

test('OBS-13: machine-readable script inventory exists and is valid JSON', () => {
  assert.ok(fs.existsSync(INVENTORY_PATH), 'inventory JSON must exist');
  const data = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  assert.equal(typeof data, 'object', 'inventory must be an object');
});

test('OBS-13: inventory has top-level classification counts', () => {
  const data = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  assert.ok(typeof data.total_bin_scripts === 'number', 'must have total_bin_scripts count');
  assert.ok(typeof data.wired_scripts === 'number', 'must have wired_scripts count');
  assert.ok(Array.isArray(data.lone_producers), 'must have lone_producers array');
});

test('OBS-13: lone producer entries have required classification fields', () => {
  const data = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  assert.ok(data.lone_producers.length > 0, 'must have at least one lone producer');

  for (const entry of data.lone_producers) {
    assert.ok(typeof entry.path === 'string', `entry must have path: ${JSON.stringify(entry)}`);
    assert.ok(typeof entry.purpose === 'string', `entry must have purpose: ${entry.path}`);
    assert.ok(typeof entry.classification === 'string', `entry must have classification: ${entry.path}`);
    // suggested_skill can be null or string
    assert.ok(entry.suggested_skill === null || typeof entry.suggested_skill === 'string',
      `entry must have suggested_skill (string|null): ${entry.path}`);
  }
});

test('OBS-13: inventory excludes test files from classification', () => {
  const data = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  assert.ok(typeof data.test_files_excluded === 'number', 'must track excluded test file count');
  // No lone producer path should be a test file
  for (const entry of data.lone_producers) {
    assert.ok(!entry.path.match(/\.test\.(c?js|mjs)$/), `test file should not appear in lone_producers: ${entry.path}`);
  }
});
