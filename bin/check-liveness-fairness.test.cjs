#!/usr/bin/env node
'use strict';
// bin/check-liveness-fairness.test.cjs
// Wave 0 RED scaffold for bin/check-liveness-fairness.cjs contract.
// Tests must FAIL in RED state (implementation script does not exist yet).
// Requirements: LIVE-01, LIVE-02

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SCRIPT = path.join(__dirname, 'check-liveness-fairness.cjs');

// ─── Test 1: syntax smoke ─────────────────────────────────────────────────────
test('syntax smoke: script loads without SyntaxError', () => {
  const result = spawnSync(process.execPath, ['--check', SCRIPT], {
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.doesNotMatch(result.stderr || '', /SyntaxError/);
  assert.strictEqual(result.status, 0);
});

// ─── Test 2: exits with code 0 always (inconclusive is not a failure) ─────────
test('exits with code 0 always (inconclusive is not a failure)', () => {
  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.strictEqual(result.status, 0);
});

// ─── Test 3: writes a check result entry to NDJSON ─────────────────────────
test('writes a check result entry to NDJSON', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clf-test-'));
  const tmpFile = path.join(tmpDir, 'check-results.ndjson');
  try {
    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      env: { ...process.env, CHECK_RESULTS_PATH: tmpFile, FORMAL_TLA_DIR: tmpDir },
      timeout: 5000,
    });

    // Script must exit 0
    assert.strictEqual(result.status, 0);

    // File must exist and contain valid JSON
    assert.ok(fs.existsSync(tmpFile), 'CHECK_RESULTS_PATH file must exist');

    const content = fs.readFileSync(tmpFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    assert.ok(lines.length > 0, 'NDJSON must have at least one line');

    // First line must parse as JSON
    const record = JSON.parse(lines[0]);
    assert.ok('tool' in record, 'Record must have tool field');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Test 4: result is 'pass' when all configs have fairness declarations ────
test("result is 'pass' when all configs have fairness declarations", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clf-test-'));
  const tmpFile = path.join(tmpDir, 'check-results.ndjson');
  const formalTlaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clf-fv-tla-'));
  const formalSpecDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clf-fv-spec-'));

  try {
    // Create fake MCtest.cfg with PROPERTY declaration
    fs.writeFileSync(
      path.join(formalTlaDir, 'MCtest.cfg'),
      'PROPERTY EventualConsensus\n'
    );

    // Create .planning/formal/spec/test/invariants.md with matching ## EventualConsensus
    const specSubdir = path.join(formalSpecDir, 'test');
    fs.mkdirSync(specSubdir, { recursive: true });
    fs.writeFileSync(
      path.join(specSubdir, 'invariants.md'),
      '## EventualConsensus\nSome description\n'
    );

    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CHECK_RESULTS_PATH: tmpFile,
        FORMAL_TLA_DIR: formalTlaDir,
        FORMAL_SPEC_DIR: formalSpecDir,
      },
      timeout: 5000,
    });

    assert.strictEqual(result.status, 0);
    assert.ok(fs.existsSync(tmpFile), 'NDJSON file must exist');

    const content = fs.readFileSync(tmpFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    assert.ok(lines.length > 0, 'NDJSON must have at least one line');

    const record = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(record.result, 'pass', 'result must be "pass" when fairness declared');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(formalTlaDir, { recursive: true, force: true });
    fs.rmSync(formalSpecDir, { recursive: true, force: true });
  }
});

// ─── Test 5: result is 'inconclusive' when any config lacks fairness declaration
test("result is 'inconclusive' when any config lacks fairness declaration", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clf-test-'));
  const tmpFile = path.join(tmpDir, 'check-results.ndjson');
  const formalTlaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clf-fv-tla-'));
  const formalSpecDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clf-fv-spec-'));

  try {
    // Create fake MCtest.cfg with PROPERTY declaration
    fs.writeFileSync(
      path.join(formalTlaDir, 'MCtest.cfg'),
      'PROPERTY EventualConsensus\n'
    );

    // Create .planning/formal/spec/test/invariants.md WITHOUT EventualConsensus
    const specSubdir = path.join(formalSpecDir, 'test');
    fs.mkdirSync(specSubdir, { recursive: true });
    fs.writeFileSync(
      path.join(specSubdir, 'invariants.md'),
      '## SomeOtherProperty\nSome description\n'
    );

    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CHECK_RESULTS_PATH: tmpFile,
        FORMAL_TLA_DIR: formalTlaDir,
        FORMAL_SPEC_DIR: formalSpecDir,
      },
      timeout: 5000,
    });

    assert.strictEqual(result.status, 0);
    assert.ok(fs.existsSync(tmpFile), 'NDJSON file must exist');

    const content = fs.readFileSync(tmpFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    assert.ok(lines.length > 0, 'NDJSON must have at least one line');

    const record = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(record.result, 'inconclusive', 'result must be "inconclusive" when fairness missing');

    // Check triage_tags includes 'needs-fairness'
    if (record.triage_tags) {
      assert.ok(
        record.triage_tags.includes('needs-fairness'),
        'triage_tags must include "needs-fairness"'
      );
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(formalTlaDir, { recursive: true, force: true });
    fs.rmSync(formalSpecDir, { recursive: true, force: true });
  }
});

// ─── Test 6: dynamically discovers MC*.cfg files (rejects hardcoded list) ────
test('dynamically discovers MC*.cfg files (rejects hardcoded list)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clf-test-'));
  const tmpFile = path.join(tmpDir, 'check-results.ndjson');
  const formalTlaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clf-fv-tla-'));
  const formalSpecDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clf-fv-spec-'));

  try {
    // Create TWO fake configs: MCtest1.cfg (PROPERTY LivA) and MCtest2.cfg (no PROPERTY)
    fs.writeFileSync(
      path.join(formalTlaDir, 'MCtest1.cfg'),
      'PROPERTY LivenessA\n'
    );
    fs.writeFileSync(
      path.join(formalTlaDir, 'MCtest2.cfg'),
      'INIT Init\n'  // No PROPERTY line
    );

    // Create .planning/formal/spec dir without invariants.md files
    fs.mkdirSync(formalSpecDir, { recursive: true });

    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CHECK_RESULTS_PATH: tmpFile,
        FORMAL_TLA_DIR: formalTlaDir,
        FORMAL_SPEC_DIR: formalSpecDir,
      },
      timeout: 5000,
    });

    assert.strictEqual(result.status, 0);
    assert.ok(fs.existsSync(tmpFile), 'NDJSON file must exist');

    const content = fs.readFileSync(tmpFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    assert.ok(lines.length > 0, 'NDJSON must have at least one line');

    const record = JSON.parse(lines[lines.length - 1]);

    // Check metadata.configs_checked equals 2 (both configs discovered)
    assert.ok(
      record.metadata && record.metadata.configs_checked === 2,
      'metadata.configs_checked must equal 2 (both configs discovered dynamically)'
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(formalTlaDir, { recursive: true, force: true });
    fs.rmSync(formalSpecDir, { recursive: true, force: true });
  }
});
