'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'bin', 'run-formal-verify.cjs');
const QGSD_ROOT = path.join(__dirname, '..');

// nForma-internal step IDs that should be skipped in non-nForma repos
const NFORMA_ONLY_STEPS = [
  'generate:tla-from-xstate',
  'generate:alloy-prism-specs',
  'petri:quorum',
  'ci:trace-redaction',
  'ci:trace-schema-drift',
  'ci:conformance-traces',
];

describe('run-formal-verify nForma-repo guard', () => {
  test('skips nformaOnly steps when XState machine is absent', () => {
    // Create a tmpdir that looks like a project but is NOT nForma
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-guard-test-'));
    try {
      // Create minimal .planning/formal/ structure
      fs.mkdirSync(path.join(tmpDir, '.planning', 'formal'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'formal', 'check-results.ndjson'), '');

      const result = spawnSync(process.execPath, [
        SCRIPT, '--project-root=' + tmpDir,
      ], { encoding: 'utf8', timeout: 30000 });

      const output = result.stdout + result.stderr;

      // Should detect non-nForma repo and log skip message
      assert.ok(
        output.includes('Non-nForma repo detected'),
        'Expected "Non-nForma repo detected" in output, got:\n' + output.slice(0, 500)
      );

      // Should log each skipped step
      for (const stepId of NFORMA_ONLY_STEPS) {
        assert.ok(
          output.includes('skip: ' + stepId),
          'Expected skip log for ' + stepId + ' in output'
        );
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('runs all steps when XState machine is present (nForma repo)', () => {
    // Use the real QGSD repo — only run generate filter to keep it fast
    const result = spawnSync(process.execPath, [
      SCRIPT, '--only=generate', '--project-root=' + QGSD_ROOT,
    ], { encoding: 'utf8', timeout: 30000 });

    const output = result.stdout + result.stderr;

    // Should NOT skip anything — this IS the nForma repo
    assert.ok(
      !output.includes('Non-nForma repo detected'),
      'Should not detect non-nForma repo when running in QGSD root'
    );

    // generate:tla-from-xstate should appear in output (not skipped)
    assert.ok(
      output.includes('generate:tla-from-xstate'),
      'Expected generate:tla-from-xstate to run in nForma repo'
    );
  });
});
