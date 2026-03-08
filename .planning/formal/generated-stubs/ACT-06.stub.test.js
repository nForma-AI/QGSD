#!/usr/bin/env node
// @requirement ACT-06
// Verifies StageTransition action in QGSDActivityTracking.tla and
// that plan-phase, debug, quorum, circuit-breaker workflows call activity-set at stage boundaries

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const MODEL_FILE = path.join(ROOT, '.planning', 'formal', 'tla', 'QGSDActivityTracking.tla');
const WORKFLOWS_DIR = path.join(ROOT, 'core', 'workflows');

test('ACT-06: QGSDActivityTracking.tla defines StageTransition action', () => {
  const content = fs.readFileSync(MODEL_FILE, 'utf8');

  // StageTransition action must exist
  assert.match(content, /StageTransition\s*==/, 'StageTransition action definition must exist');

  // Must reference fileExists and subActivity preconditions
  assert.match(content, /fileExists\s*=\s*TRUE/, 'StageTransition must require fileExists = TRUE');
  assert.match(content, /subActivity\s*=\s*"running"/, 'StageTransition must require subActivity = "running"');

  // Must be part of Next state relation
  assert.match(content, /\\\/\s*StageTransition/, 'StageTransition must appear in Next disjunction');

  // Must have @requirement ACT-06 annotation
  assert.match(content, /@requirement\s+ACT-06/, '@requirement ACT-06 annotation must be present');
});

test('ACT-06: plan-phase workflow calls activity-set at stage boundaries', () => {
  const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'plan-phase.md'), 'utf8');
  const matches = content.match(/activity-set/g) || [];
  assert.ok(matches.length >= 2, `plan-phase.md must call activity-set at multiple stage boundaries (found ${matches.length})`);
});

test('ACT-06: circuit-breaker resolution workflow calls activity-set', () => {
  const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'oscillation-resolution-mode.md'), 'utf8');
  const matches = content.match(/activity-set/g) || [];
  assert.ok(matches.length >= 1, `oscillation-resolution-mode.md must call activity-set (found ${matches.length})`);
});

test('ACT-06: execute-phase workflow calls activity-set at stage boundaries', () => {
  const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'execute-phase.md'), 'utf8');
  const matches = content.match(/activity-set/g) || [];
  assert.ok(matches.length >= 2, `execute-phase.md must call activity-set at multiple stage boundaries (found ${matches.length})`);
});
