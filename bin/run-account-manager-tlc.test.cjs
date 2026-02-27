#!/usr/bin/env node
'use strict';
// bin/run-account-manager-tlc.test.cjs
// Error-path tests for bin/run-account-manager-tlc.cjs.
// All tests check error conditions only — no Java or TLC invocation.
// Requirements: INTG-01, INTG-02

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

const RUN_ACCOUNT_MANAGER_TLC = path.join(__dirname, 'run-account-manager-tlc.cjs');

test('exits non-zero and prints JAVA_HOME error when JAVA_HOME points to nonexistent path', () => {
  const result = spawnSync(process.execPath, [RUN_ACCOUNT_MANAGER_TLC], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: '/nonexistent/java/path' },
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /JAVA_HOME|java/i);
});

test('exits non-zero with descriptive message for unknown --config value', () => {
  const result = spawnSync(process.execPath, [RUN_ACCOUNT_MANAGER_TLC, '--config=invalid'], {
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /Unknown config|invalid/i);
});

// LIVE-02: liveness wiring tests (Wave 0 RED stubs — fail until implementation in Wave 1)

test('run-account-manager-tlc.cjs requires run-tlc.cjs and destructures detectLivenessProperties', () => {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, 'run-account-manager-tlc.cjs'), 'utf8');
  assert.match(src, /require\(['"]\.\/run-tlc\.cjs['"]\)/,
    'run-account-manager-tlc.cjs must require ./run-tlc.cjs');
  assert.match(src, /\{\s*detectLivenessProperties\s*\}\s*=\s*require\(['"]\.\/run-tlc\.cjs['"]\)/,
    'run-account-manager-tlc.cjs must destructure detectLivenessProperties from ./run-tlc.cjs');
});

test('run-account-manager-tlc.cjs calls detectLivenessProperties with configName and cfgPath', () => {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, 'run-account-manager-tlc.cjs'), 'utf8');
  assert.match(src, /detectLivenessProperties\s*\(\s*configName\s*,\s*cfgPath\s*\)/,
    'run-account-manager-tlc.cjs must call detectLivenessProperties(configName, cfgPath)');
});

test('run-account-manager-tlc.cjs has inconclusive writeCheckResult call in source', () => {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, 'run-account-manager-tlc.cjs'), 'utf8');
  assert.match(src, /result\s*:\s*['"]inconclusive['"]/,
    'run-account-manager-tlc.cjs must have result=inconclusive in writeCheckResult call');
});
