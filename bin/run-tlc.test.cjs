#!/usr/bin/env node
'use strict';
// bin/run-tlc.test.cjs
// Wave 0 RED stubs for bin/run-tlc.cjs error paths.
// All tests check error conditions only — no Java or TLC invocation.
// Requirements: TLA-04

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const RUN_TLC = path.join(__dirname, 'run-tlc.cjs');

test('exits non-zero and prints clear error when JAVA_HOME points to nonexistent path', () => {
  const result = spawnSync(process.execPath, [RUN_TLC], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: '/nonexistent/java/path' },
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /JAVA_HOME|java/i);
});

test('exits non-zero and prints download URL when tla2tools.jar is not found', () => {
  // Need valid Java so run-tlc.cjs passes Java check and reaches JAR check.
  // Detect system Java home: on macOS /usr/libexec/java_home, fallback to JAVA_HOME env.
  const javaHome = process.env.JAVA_HOME ||
    (() => { const r = spawnSync('/usr/libexec/java_home', [], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; })() ||
    null;
  // If no Java available, skip this test — it cannot reach JAR check without Java.
  if (!javaHome) { return; }  // test is skipped, not failed
  const jarPath = path.join(__dirname, '..', 'formal', 'tla', 'tla2tools.jar');
  if (fs.existsSync(jarPath)) { return; }  // skip — can't test absent-JAR path when JAR is present
  const result = spawnSync(process.execPath, [RUN_TLC], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: javaHome },
    // No JAR exists in the repo (gitignored) — JAR check fires
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /tla2tools\.jar|github\.com\/tlaplus/i);
});

test('exits non-zero with descriptive message for unknown --config value', () => {
  const result = spawnSync(process.execPath, [RUN_TLC, '--config=bogus'], {
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /Unknown config|bogus/i);
});

test('exits non-zero and lists valid configs in error output for invalid config', () => {
  const result = spawnSync(process.execPath, [RUN_TLC, '--config=invalid'], {
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /MCsafety|MCliveness/i);
});

test('detectLivenessProperties returns [] for config with no PROPERTY lines (safety config)', () => {
  const { detectLivenessProperties } = require('./run-tlc.cjs');
  // MCsafety.cfg has PROPERTY lines but is not in SURFACE_MAP — returns [] for unknown surface
  const cfgPath = path.join(__dirname, '..', 'formal', 'tla', 'MCsafety.cfg');
  const result = detectLivenessProperties('MCsafety', cfgPath);
  assert.deepStrictEqual(result, []);
});

test('detectLivenessProperties returns missing property names when invariants.md does not exist', () => {
  const { detectLivenessProperties } = require('./run-tlc.cjs');
  const cfgPath = path.join(__dirname, '..', 'formal', 'tla', 'MCliveness.cfg');
  // Use a non-existent specDir to simulate missing invariants.md
  const missingSpecDir = path.join(os.tmpdir(), 'no-such-dir-' + Date.now());
  const result = detectLivenessProperties('MCliveness', cfgPath, missingSpecDir);
  assert.ok(result.includes('EventualConsensus'), 'Expected EventualConsensus in missing list');
});

test('detectLivenessProperties returns [] when invariants.md has matching ## header', () => {
  const { detectLivenessProperties } = require('./run-tlc.cjs');
  const cfgPath = path.join(__dirname, '..', 'formal', 'tla', 'MCliveness.cfg');
  // Use the actual formal/spec/quorum/invariants.md created in Plan 01
  const specDir = path.join(__dirname, '..', 'formal', 'spec');
  const result = detectLivenessProperties('MCliveness', cfgPath, specDir);
  assert.deepStrictEqual(result, [], 'Expected no missing declarations when invariants.md is present with correct header');
});

test('detectLivenessProperties returns property name when invariants.md exists but header is missing', () => {
  const { detectLivenessProperties } = require('./run-tlc.cjs');
  const cfgPath = path.join(__dirname, '..', 'formal', 'tla', 'MCliveness.cfg');
  // Create a tmp invariants.md with wrong/no header
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlc-test-'));
  const quorumDir = path.join(tmpDir, 'quorum');
  fs.mkdirSync(quorumDir, { recursive: true });
  fs.writeFileSync(path.join(quorumDir, 'invariants.md'), '# Liveness Fairness Declarations\n\n(empty — no entries yet)\n');
  const result = detectLivenessProperties('MCliveness', cfgPath, tmpDir);
  assert.ok(result.includes('EventualConsensus'), 'Expected EventualConsensus in missing list when header absent from invariants.md');
  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
