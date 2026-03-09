#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { validateHookPaths } = require('../bin/install.js');

// Suppress console.log during tests
const origLog = console.log;
let logOutput = [];
function captureLog() { logOutput = []; console.log = (...args) => logOutput.push(args.join(' ')); }
function restoreLog() { console.log = origLog; }

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nf-hook-test-'));
}

function rimraf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Test 1: No warnings for valid paths
(function testValidPaths() {
  const tmp = makeTmpDir();
  try {
    // Create a hook file that references a sibling file that exists
    fs.writeFileSync(path.join(tmp, 'hook.js'),
      `const x = require(path.join(__dirname, 'sibling.js'));\n`);
    fs.writeFileSync(path.join(tmp, 'sibling.js'), '// sibling\n');

    captureLog();
    const warnings = validateHookPaths(tmp, path.dirname(tmp));
    restoreLog();

    assert.strictEqual(warnings.length, 0, 'Expected no warnings for valid paths');
    origLog('  PASS: test 1 - no warnings for valid paths');
  } finally {
    restoreLog();
    rimraf(tmp);
  }
})();

// Test 2: Warning for missing target
(function testMissingTarget() {
  const tmp = makeTmpDir();
  try {
    fs.writeFileSync(path.join(tmp, 'hook.js'),
      `const x = require(path.join(__dirname, '..', 'bin', 'missing.cjs'));\n`);

    captureLog();
    const warnings = validateHookPaths(tmp, path.dirname(tmp));
    restoreLog();

    assert.strictEqual(warnings.length, 1, 'Expected one warning for missing target');
    assert.ok(warnings[0].resolved.includes('missing.cjs'), 'Resolved path should contain missing.cjs');
    assert.strictEqual(warnings[0].file, 'hook.js');
    origLog('  PASS: test 2 - warning for missing target');
  } finally {
    restoreLog();
    rimraf(tmp);
  }
})();

// Test 3: Hint for bin vs nf-bin
(function testBinHint() {
  const tmp = makeTmpDir();
  try {
    fs.writeFileSync(path.join(tmp, 'hook.js'),
      `const x = require(path.join(__dirname, '..', 'bin', 'something.cjs'));\n`);

    captureLog();
    const warnings = validateHookPaths(tmp, path.dirname(tmp));
    restoreLog();

    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0].suggestion !== null, 'Should have a suggestion');
    assert.ok(warnings[0].suggestion.includes('nf-bin'), 'Suggestion should mention nf-bin');
    origLog('  PASS: test 3 - hint for bin vs nf-bin');
  } finally {
    restoreLog();
    rimraf(tmp);
  }
})();

// Test 4: Skips .test.js files
(function testSkipsTestFiles() {
  const tmp = makeTmpDir();
  try {
    fs.writeFileSync(path.join(tmp, 'hook.test.js'),
      `const x = require(path.join(__dirname, '..', 'bin', 'missing.cjs'));\n`);

    captureLog();
    const warnings = validateHookPaths(tmp, path.dirname(tmp));
    restoreLog();

    assert.strictEqual(warnings.length, 0, 'Should skip .test.js files');
    origLog('  PASS: test 4 - skips .test.js files');
  } finally {
    restoreLog();
    rimraf(tmp);
  }
})();

// Test 5: Multiple patterns in one file, some broken
(function testMultiplePatterns() {
  const tmp = makeTmpDir();
  try {
    // Create one valid sibling
    fs.writeFileSync(path.join(tmp, 'exists.js'), '// exists\n');

    // Hook with 3 path.join calls: 1 valid, 2 broken
    fs.writeFileSync(path.join(tmp, 'hook.js'), [
      `const a = require(path.join(__dirname, 'exists.js'));`,
      `const b = require(path.join(__dirname, '..', 'bin', 'missing1.cjs'));`,
      `const c = require(path.join(__dirname, '..', 'bin', 'missing2.cjs'));`,
    ].join('\n') + '\n');

    captureLog();
    const warnings = validateHookPaths(tmp, path.dirname(tmp));
    restoreLog();

    assert.strictEqual(warnings.length, 2, 'Expected 2 warnings (2 broken out of 3)');
    origLog('  PASS: test 5 - multiple patterns, 2 broken');
  } finally {
    restoreLog();
    rimraf(tmp);
  }
})();

// Test 6: No suggestion when path uses nf-bin (not bin)
(function testNfBinNoSuggestion() {
  const tmp = makeTmpDir();
  try {
    fs.writeFileSync(path.join(tmp, 'hook.js'),
      `const x = require(path.join(__dirname, '..', 'nf-bin', 'missing.cjs'));\n`);

    captureLog();
    const warnings = validateHookPaths(tmp, path.dirname(tmp));
    restoreLog();

    assert.strictEqual(warnings.length, 1);
    assert.strictEqual(warnings[0].suggestion, null, 'Should NOT suggest nf-bin when already using nf-bin');
    origLog('  PASS: test 6 - no suggestion for nf-bin paths');
  } finally {
    restoreLog();
    rimraf(tmp);
  }
})();

origLog('\nAll tests passed.');
