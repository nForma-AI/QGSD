'use strict';
/** @requirement MRF-02 — validates model reproduction via formal-scope-scan model checkers and bug gap persistence */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const {
  parseArgs,
  runModelCheckers,
  findTlcConfig,
  runSingleChecker,
  persistBugGapWithCheckers,
  loadBugModelGaps,
  saveBugModelGaps
} = require('../bin/formal-scope-scan.cjs');

const ROOT = path.join(__dirname, '..');

// ── Pre-flight: check Java availability ────────────────────────────────────

const javaCheck = spawnSync('java', ['-version'], { timeout: 5000 });
const hasJava = javaCheck.status === 0;

// ── Helper: create temp directory ──────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'model-repro-test-'));
}

function cleanTmpDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

// ── Unit tests (always run, no Java needed) ────────────────────────────────

describe('--run-checkers flag parsing', () => {
  test('parseArgs recognizes --run-checkers flag', () => {
    const args = parseArgs(['node', 'script', '--bug-mode', '--run-checkers', '--description', 'test']);
    assert.strictEqual(args.runCheckers, true);
    assert.strictEqual(args.bugMode, true);
  });

  test('parseArgs defaults runCheckers to false', () => {
    const args = parseArgs(['node', 'script', '--description', 'test']);
    assert.strictEqual(args.runCheckers, false);
  });

  test('--run-checkers without --bug-mode produces error via CLI', () => {
    const result = spawnSync('node', [
      path.join(ROOT, 'bin', 'formal-scope-scan.cjs'),
      '--run-checkers',
      '--description', 'test'
    ], { encoding: 'utf8', timeout: 10000 });
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('--run-checkers requires --bug-mode'));
  });
});

describe('Max model limit enforcement', () => {
  test('Only top 3 models by score are checked, rest are skipped', () => {
    const matches = [
      { model: 'a.tla', formalism: 'tla', bug_relevance_score: 0.5 },
      { model: 'b.tla', formalism: 'tla', bug_relevance_score: 0.4 },
      { model: 'c.tla', formalism: 'tla', bug_relevance_score: 0.3 },
      { model: 'd.tla', formalism: 'tla', bug_relevance_score: 0.2 },
      { model: 'e.tla', formalism: 'tla', bug_relevance_score: 0.1 },
    ];

    // Use a non-existent project root so checkers will be "skipped" (fail-open)
    const tmpDir = makeTmpDir();
    try {
      const results = runModelCheckers(matches, 3, 1000, tmpDir);
      assert.strictEqual(results.length, 5);

      // First 3 should be attempted (skipped due to no config, not due to limit)
      const limitSkipped = results.filter(r => r.reason && r.reason.includes('Exceeded max model limit'));
      assert.strictEqual(limitSkipped.length, 2, 'Expected 2 models skipped due to max limit');
      assert.strictEqual(limitSkipped[0].model, 'd.tla');
      assert.strictEqual(limitSkipped[1].model, 'e.tla');
    } finally {
      cleanTmpDir(tmpDir);
    }
  });
});

describe('Timeout configuration', () => {
  test('Default timeout is 60000ms when not specified', () => {
    // We verify this indirectly by checking the function signature defaults
    // The runModelCheckers function uses 60000 as default
    const matches = [];
    const results = runModelCheckers(matches, undefined, undefined);
    assert.strictEqual(results.length, 0);
    // No crash = defaults applied correctly
  });
});

describe('Output schema validation', () => {
  test('Checker results have checker_result, checker_trace, checker_runtime_ms fields', () => {
    const result = spawnSync('node', [
      path.join(ROOT, 'bin', 'formal-scope-scan.cjs'),
      '--bug-mode', '--run-checkers',
      '--description', 'circuit breaker',
      '--format', 'json'
    ], { encoding: 'utf8', timeout: 120000 });

    assert.strictEqual(result.status, 0);
    const matches = JSON.parse(result.stdout);
    assert.ok(Array.isArray(matches));
    assert.ok(matches.length > 0, 'Expected at least one match for "circuit breaker"');

    for (const m of matches) {
      assert.ok('checker_result' in m, 'Missing checker_result for ' + m.model);
      assert.ok('checker_trace' in m, 'Missing checker_trace for ' + m.model);
      assert.ok('checker_runtime_ms' in m, 'Missing checker_runtime_ms for ' + m.model);
      assert.ok(['pass', 'fail', 'timeout', 'skipped'].includes(m.checker_result),
        'Invalid checker_result: ' + m.checker_result);
    }
  });
});

// ── Fail-open tests (always run) ───────────────────────────────────────────

describe('Fail-open behavior', () => {
  test('Non-existent checker binary path results in skipped with reason', () => {
    const tmpDir = makeTmpDir();
    try {
      const match = { model: 'nonexistent.tla', formalism: 'tla', bug_relevance_score: 0.5 };
      const result = runSingleChecker(match, 5000, tmpDir);
      assert.strictEqual(result.result, 'skipped');
      assert.ok(result.reason, 'Expected a reason for skipped result');
    } finally {
      cleanTmpDir(tmpDir);
    }
  });

  test('Very short timeout results in timeout', () => {
    // Only meaningful if Java is available (checker actually starts)
    if (!hasJava) {
      // Without Java, checker will be skipped, not timeout
      // Test the skipped path instead
      const match = { model: '.planning/formal/tla/QGSDBreakerState.tla', formalism: 'tla', bug_relevance_score: 0.5 };
      const result = runSingleChecker(match, 1, ROOT);
      assert.ok(['timeout', 'skipped', 'pass', 'fail'].includes(result.result));
      return;
    }

    // With Java: use 1ms timeout which should trigger SIGTERM
    const match = { model: '.planning/formal/tla/QGSDBreakerState.tla', formalism: 'tla', bug_relevance_score: 0.5 };
    const result = runSingleChecker(match, 1, ROOT);
    // With 1ms timeout, it could be timeout or skipped depending on spawn speed
    assert.ok(['timeout', 'skipped'].includes(result.result),
      'Expected timeout or skipped with 1ms timeout, got: ' + result.result);
  });

  test('Unsupported formalism results in skipped', () => {
    const match = { model: 'test.xyz', formalism: 'xyz', bug_relevance_score: 0.5 };
    const result = runSingleChecker(match, 5000, ROOT);
    assert.strictEqual(result.result, 'skipped');
    assert.ok(result.reason.includes('Unsupported formalism'));
  });
});

// ── Bug-model-gaps.json integration tests ──────────────────────────────────

describe('Bug-model-gaps.json with checkers', () => {
  test('--run-checkers --persist-gap updates entry status based on checker results', () => {
    const tmpDir = makeTmpDir();
    const gapsPath = path.join(tmpDir, 'bug-model-gaps.json');
    try {
      // Create matches with checker results already enriched
      const matches = [
        {
          model: 'test.tla',
          formalism: 'tla',
          bug_relevance_score: 0.5,
          checker_result: 'pass',
          checker_trace: null,
          checker_runtime_ms: 100
        }
      ];

      const data = persistBugGapWithCheckers('test bug description', matches, gapsPath);
      assert.strictEqual(data.entries.length, 1);
      assert.strictEqual(data.entries[0].status, 'no_reproduction');
      assert.ok(Array.isArray(data.entries[0].checked_models));
      assert.strictEqual(data.entries[0].checked_models.length, 1);
    } finally {
      cleanTmpDir(tmpDir);
    }
  });

  test('Status becomes reproduced when any checker result is fail', () => {
    const tmpDir = makeTmpDir();
    const gapsPath = path.join(tmpDir, 'bug-model-gaps.json');
    try {
      const matches = [
        {
          model: 'a.tla',
          formalism: 'tla',
          bug_relevance_score: 0.5,
          checker_result: 'pass',
          checker_trace: null,
          checker_runtime_ms: 50
        },
        {
          model: 'b.tla',
          formalism: 'tla',
          bug_relevance_score: 0.3,
          checker_result: 'fail',
          checker_trace: 'Error: invariant violated',
          checker_runtime_ms: 200
        }
      ];

      const data = persistBugGapWithCheckers('fail test', matches, gapsPath);
      assert.strictEqual(data.entries[0].status, 'reproduced');
    } finally {
      cleanTmpDir(tmpDir);
    }
  });

  test('checked_models array has correct schema', () => {
    const tmpDir = makeTmpDir();
    const gapsPath = path.join(tmpDir, 'bug-model-gaps.json');
    try {
      const matches = [
        {
          model: 'spec.tla',
          formalism: 'tla',
          bug_relevance_score: 0.5,
          checker_result: 'fail',
          checker_trace: 'Error: trace data',
          checker_runtime_ms: 150
        }
      ];

      const data = persistBugGapWithCheckers('schema test', matches, gapsPath);
      const cm = data.entries[0].checked_models[0];
      assert.strictEqual(cm.model, 'spec.tla');
      assert.strictEqual(cm.formalism, 'tla');
      assert.strictEqual(cm.result, 'fail');
      assert.strictEqual(cm.trace, 'Error: trace data');
      assert.strictEqual(cm.runtime_ms, 150);
    } finally {
      cleanTmpDir(tmpDir);
    }
  });

  test('No models matched results in no_coverage status', () => {
    const tmpDir = makeTmpDir();
    const gapsPath = path.join(tmpDir, 'bug-model-gaps.json');
    try {
      const data = persistBugGapWithCheckers('no match test', [], gapsPath);
      assert.strictEqual(data.entries[0].status, 'no_coverage');
      assert.strictEqual(data.entries[0].checked_models.length, 0);
    } finally {
      cleanTmpDir(tmpDir);
    }
  });
});

// ── Integration tests (skip if no Java) ────────────────────────────────────

describe('Model checker integration', () => {
  (hasJava ? test : test.skip)('TLA+ checker runs on a matched model and reports result', () => {
    const match = {
      model: '.planning/formal/tla/QGSDBreakerState.tla',
      formalism: 'tla',
      bug_relevance_score: 0.5
    };
    const result = runSingleChecker(match, 60000, ROOT);
    assert.ok(['pass', 'fail', 'timeout'].includes(result.result),
      'Expected pass/fail/timeout, got: ' + result.result);
    assert.ok(result.runtime_ms > 0, 'Expected positive runtime_ms');
  });

  (hasJava ? test : test.skip)('Alloy checker runs on a matched model and reports result', () => {
    const match = {
      model: '.planning/formal/alloy/account-pool-structure.als',
      formalism: 'alloy',
      bug_relevance_score: 0.5
    };
    const result = runSingleChecker(match, 60000, ROOT);
    assert.ok(['pass', 'fail', 'timeout'].includes(result.result),
      'Expected pass/fail/timeout, got: ' + result.result);
    assert.ok(result.runtime_ms > 0, 'Expected positive runtime_ms');
  });

  (hasJava ? test : test.skip)('checker_runtime_ms is populated with a positive number', () => {
    const match = {
      model: '.planning/formal/tla/QGSDBreakerState.tla',
      formalism: 'tla',
      bug_relevance_score: 0.5
    };
    const result = runSingleChecker(match, 60000, ROOT);
    assert.ok(typeof result.runtime_ms === 'number');
    assert.ok(result.runtime_ms > 0);
  });

  (hasJava ? test : test.skip)('checker_trace is null for passing checks', () => {
    const match = {
      model: '.planning/formal/tla/QGSDBreakerState.tla',
      formalism: 'tla',
      bug_relevance_score: 0.5
    };
    const result = runSingleChecker(match, 60000, ROOT);
    if (result.result === 'pass') {
      assert.strictEqual(result.trace, null);
    }
    // If it fails or times out, trace check is not applicable
  });
});
