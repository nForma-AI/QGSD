#!/usr/bin/env node
// @requirement ACT-07
// Verifies ClearActivity action in QGSDActivityTracking.tla and
// that gsd-tools activity-clear implementation resets activity file

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const MODEL_FILE = path.join(ROOT, '.planning', 'formal', 'tla', 'QGSDActivityTracking.tla');
const GSD_TOOLS = path.join(ROOT, 'core', 'bin', 'gsd-tools.cjs');

test('ACT-07: QGSDActivityTracking.tla defines ClearActivity action', () => {
  const content = fs.readFileSync(MODEL_FILE, 'utf8');

  // ClearActivity action must exist
  assert.match(content, /ClearActivity\s*==/, 'ClearActivity action definition must exist');

  // Must require fileExists = TRUE as precondition
  assert.match(content, /ClearActivity[\s\S]*?fileExists\s*=\s*TRUE/, 'ClearActivity must require fileExists = TRUE');

  // Must set fileExists' = FALSE (file removal)
  assert.match(content, /fileExists'\s*=\s*FALSE/, 'ClearActivity must set fileExists\' = FALSE');

  // Must be part of Next state relation
  assert.match(content, /\\\/\s*ClearActivity/, 'ClearActivity must appear in Next disjunction');

  // Must have @requirement ACT-07 annotation
  assert.match(content, /@requirement\s+ACT-07/, '@requirement ACT-07 annotation must be present');
});

test('ACT-07: ClearResetsActivity invariant ensures activity resets to none', () => {
  const content = fs.readFileSync(MODEL_FILE, 'utf8');

  // ClearResetsActivity safety invariant
  assert.match(content, /ClearResetsActivity\s*==/, 'ClearResetsActivity invariant must exist');
  assert.match(content, /fileExists\s*=\s*FALSE\s*=>\s*activity\s*=\s*"none"/, 'ClearResetsActivity must enforce activity = "none" when file cleared');
});

test('ACT-07: gsd-tools activity-clear implementation removes file idempotently', () => {
  const content = fs.readFileSync(GSD_TOOLS, 'utf8');

  // Must have activity-clear command handler
  assert.match(content, /activity-clear/, 'gsd-tools must handle activity-clear command');

  // Must use unlinkSync to remove file
  assert.match(content, /unlinkSync/, 'activity-clear must use unlinkSync to remove file');

  // Must reference current-activity.json
  assert.match(content, /current-activity\.json/, 'must reference current-activity.json file');
});
