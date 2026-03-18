'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const {
  parseArgs,
  scoreConceptMatch,
  deriveFormalism,
  runBugModeMatching,
  loadModelRegistry,
  hashBugId,
  loadBugModelGaps,
  saveBugModelGaps,
  persistBugGap
} = require('../bin/formal-scope-scan.cjs');

const ROOT = path.join(__dirname, '..');

// ── Helper: create temp directory with mock registry ────────────────────────

function createMockRegistry(dir) {
  const formalDir = path.join(dir, '.planning', 'formal');
  fs.mkdirSync(formalDir, { recursive: true });

  const registry = {
    version: '1.0',
    models: {
      '.planning/formal/tla/NFCircuitBreaker.tla': {
        description: 'Circuit breaker state machine with timeout detection',
        requirements: ['DETECT-01', 'DETECT-02', 'DETECT-03'],
        consecutive_pass_count: 275
      },
      '.planning/formal/alloy/account-pool-structure.als': {
        description: 'Account pool allocation and credential management',
        requirements: ['CRED-07', 'CRED-08'],
        consecutive_pass_count: 275
      },
      '.planning/formal/tla/QGSDBreakerState.tla': {
        description: 'Breaker state transitions',
        requirements: ['STATE-01', 'STATE-02'],
        consecutive_pass_count: 275
      },
      '.planning/formal/alloy/annotation-extraction.als': {
        description: 'Annotation extraction from source files',
        requirements: ['ANNOT-01', 'ANNOT-02'],
        consecutive_pass_count: 275
      }
    }
  };

  const registryPath = path.join(formalDir, 'model-registry.json');
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  return registryPath;
}

// ── Task 1: --bug-mode flag and matching ────────────────────────────────────

describe('parseArgs', () => {
  test('parses --bug-mode flag', () => {
    const args = parseArgs(['node', 'script', '--bug-mode', '--description', 'some bug']);
    assert.strictEqual(args.bugMode, true);
    assert.strictEqual(args.description, 'some bug');
  });

  test('--bug-mode defaults to false', () => {
    const args = parseArgs(['node', 'script', '--description', 'test']);
    assert.strictEqual(args.bugMode, false);
  });

  test('parses --persist-gap flag', () => {
    const args = parseArgs(['node', 'script', '--bug-mode', '--persist-gap', '--description', 'test']);
    assert.strictEqual(args.persistGap, true);
    assert.strictEqual(args.bugMode, true);
  });
});

describe('deriveFormalism', () => {
  test('derives tla from .tla extension', () => {
    assert.strictEqual(deriveFormalism('.planning/formal/tla/NFCircuitBreaker.tla'), 'tla');
  });

  test('derives alloy from .als extension', () => {
    assert.strictEqual(deriveFormalism('.planning/formal/alloy/account-pool-structure.als'), 'alloy');
  });

  test('returns unknown for unrecognized extension', () => {
    assert.strictEqual(deriveFormalism('some-file.txt'), 'unknown');
  });
});

describe('scoreConceptMatch', () => {
  test('returns > 0 for matching description tokens', () => {
    const score = scoreConceptMatch(
      'circuit breaker timeout',
      '.planning/formal/tla/NFCircuitBreaker.tla',
      { description: 'Circuit breaker state machine with timeout detection', requirements: ['DETECT-01'] }
    );
    assert.ok(score > 0, `Expected score > 0, got ${score}`);
  });

  test('returns 0 for non-matching description', () => {
    const score = scoreConceptMatch(
      'nonexistent xyz garbage',
      '.planning/formal/tla/NFCircuitBreaker.tla',
      { description: 'Circuit breaker state machine', requirements: ['DETECT-01'] }
    );
    assert.strictEqual(score, 0);
  });

  test('scores requirement category prefix matches', () => {
    const score = scoreConceptMatch(
      'detect anomalies in system',
      '.planning/formal/tla/SomeModel.tla',
      { description: '', requirements: ['DETECT-01', 'DETECT-02'] }
    );
    assert.ok(score >= 0.2, `Expected score >= 0.2 from category match, got ${score}`);
  });

  test('caps score at 1.0', () => {
    // Many matching tokens should still cap at 1.0
    const score = scoreConceptMatch(
      'circuit breaker state machine timeout detection transition',
      '.planning/formal/tla/NFCircuitBreaker.tla',
      {
        description: 'Circuit breaker state machine with timeout detection and transition logic',
        requirements: ['DETECT-01', 'DETECT-02', 'STATE-01', 'STATE-02']
      }
    );
    assert.ok(score <= 1.0, `Expected score <= 1.0, got ${score}`);
  });

  test('filters tokens shorter than 3 chars', () => {
    const score = scoreConceptMatch(
      'a b c',
      '.planning/formal/tla/SomeModel.tla',
      { description: 'a b c model', requirements: [] }
    );
    assert.strictEqual(score, 0);
  });
});

describe('runBugModeMatching', () => {
  test('returns null when registry is missing', () => {
    const result = runBugModeMatching('some bug', [], '/nonexistent/registry.json');
    assert.strictEqual(result, null);
  });

  test('returns matches with formalism and requirement_coverage', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-lookup-'));
    try {
      const registryPath = createMockRegistry(tmpDir);
      const results = runBugModeMatching('circuit breaker timeout', [], registryPath);
      assert.ok(results !== null);
      assert.ok(results.length > 0, 'Expected at least one match');

      // Check first result has required fields
      const first = results[0];
      assert.ok(first.formalism, 'Missing formalism field');
      assert.ok(['tla', 'alloy'].includes(first.formalism), `Unexpected formalism: ${first.formalism}`);
      assert.ok(Array.isArray(first.requirement_coverage), 'requirement_coverage should be an array');
      assert.ok(typeof first.bug_relevance_score === 'number', 'bug_relevance_score should be a number');
      assert.strictEqual(first.matched_by, 'bug_pattern');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('results are ranked by bug_relevance_score descending', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-lookup-'));
    try {
      const registryPath = createMockRegistry(tmpDir);
      const results = runBugModeMatching('circuit breaker state', [], registryPath);
      assert.ok(results !== null);
      if (results.length >= 2) {
        for (let i = 1; i < results.length; i++) {
          assert.ok(
            results[i - 1].bug_relevance_score >= results[i].bug_relevance_score,
            `Results not sorted: ${results[i - 1].bug_relevance_score} < ${results[i].bug_relevance_score}`
          );
        }
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns empty array for non-matching description', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-lookup-'));
    try {
      const registryPath = createMockRegistry(tmpDir);
      const results = runBugModeMatching('nonexistent xyz garbage qqq', [], registryPath);
      assert.ok(results !== null);
      assert.strictEqual(results.length, 0, `Expected 0 matches, got ${results.length}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('CLI integration (bug-mode)', () => {
  test('--bug-mode returns JSON with formalism fields', () => {
    const result = spawnSync('node', [
      path.join(ROOT, 'bin/formal-scope-scan.cjs'),
      '--bug-mode', '--description', 'circuit breaker timeout', '--format', 'json'
    ], { cwd: ROOT, encoding: 'utf8', timeout: 10000 });

    assert.strictEqual(result.status, 0, `Exit code ${result.status}: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.ok(Array.isArray(parsed));
    // Should find matches since real model-registry.json has CircuitBreaker models
    if (parsed.length > 0) {
      assert.ok(parsed[0].formalism, 'Missing formalism in output');
      assert.ok(parsed[0].requirement_coverage, 'Missing requirement_coverage in output');
    }
  });

  test('--bug-mode with garbage description returns empty array', () => {
    const result = spawnSync('node', [
      path.join(ROOT, 'bin/formal-scope-scan.cjs'),
      '--bug-mode', '--description', 'nonexistent xyz garbage qqq', '--format', 'json'
    ], { cwd: ROOT, encoding: 'utf8', timeout: 10000 });

    assert.strictEqual(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.ok(Array.isArray(parsed));
    assert.strictEqual(parsed.length, 0, `Expected empty array, got ${parsed.length} matches`);
  });
});

// ── Task 2: Bug-model gaps persistence ──────────────────────────────────────

describe('hashBugId', () => {
  test('generates 8-char hex string', () => {
    const id = hashBugId('test bug description');
    assert.strictEqual(id.length, 8);
    assert.ok(/^[0-9a-f]{8}$/.test(id), `Expected hex string, got: ${id}`);
  });

  test('is deterministic for same input', () => {
    const id1 = hashBugId('same description');
    const id2 = hashBugId('same description');
    assert.strictEqual(id1, id2);
  });

  test('differs for different input', () => {
    const id1 = hashBugId('description one');
    const id2 = hashBugId('description two');
    assert.notStrictEqual(id1, id2);
  });
});

describe('loadBugModelGaps', () => {
  test('returns default structure when file is missing', () => {
    const data = loadBugModelGaps('/nonexistent/path/bug-model-gaps.json');
    assert.strictEqual(data.version, '1.0');
    assert.ok(Array.isArray(data.entries));
    assert.strictEqual(data.entries.length, 0);
  });

  test('loads existing file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-gaps-'));
    try {
      const gapsPath = path.join(tmpDir, 'bug-model-gaps.json');
      const testData = { version: '1.0', entries: [{ bug_id: 'abc12345', description: 'test' }] };
      fs.writeFileSync(gapsPath, JSON.stringify(testData));

      const data = loadBugModelGaps(gapsPath);
      assert.strictEqual(data.version, '1.0');
      assert.strictEqual(data.entries.length, 1);
      assert.strictEqual(data.entries[0].bug_id, 'abc12345');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('persistBugGap', () => {
  test('creates entry with correct schema when models match', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-gaps-'));
    try {
      const gapsPath = path.join(tmpDir, 'bug-model-gaps.json');
      const matches = [
        { model: '.planning/formal/tla/NFCircuitBreaker.tla', formalism: 'tla' }
      ];

      const data = persistBugGap('circuit breaker timeout', matches, gapsPath);
      assert.strictEqual(data.entries.length, 1);
      const entry = data.entries[0];
      assert.strictEqual(entry.status, 'no_reproduction');
      assert.ok(entry.bug_id);
      assert.ok(entry.timestamp);
      assert.ok(Array.isArray(entry.matched_models));
      assert.ok(entry.matched_models.length > 0);
      assert.ok(Array.isArray(entry.checked_models));
      assert.strictEqual(entry.checked_models.length, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('sets no_coverage status when no models match', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-gaps-'));
    try {
      const gapsPath = path.join(tmpDir, 'bug-model-gaps.json');
      const data = persistBugGap('nonexistent bug', [], gapsPath);
      assert.strictEqual(data.entries[0].status, 'no_coverage');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('deduplicates by description', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-gaps-'));
    try {
      const gapsPath = path.join(tmpDir, 'bug-model-gaps.json');
      const matches = [{ model: 'model-a.tla' }];

      // First persist
      persistBugGap('duplicate bug', matches, gapsPath);
      // Second persist with same description
      const data = persistBugGap('duplicate bug', [{ model: 'model-b.tla' }], gapsPath);

      assert.strictEqual(data.entries.length, 1, 'Should not create duplicate entry');
      assert.deepStrictEqual(data.entries[0].matched_models, ['model-b.tla'], 'Should update matched_models');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('persistence survives simulated session boundary', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-gaps-'));
    try {
      const gapsPath = path.join(tmpDir, 'bug-model-gaps.json');

      // Session 1: write
      persistBugGap('session test bug', [{ model: 'model.tla' }], gapsPath);

      // Session 2: re-read from disk (simulating new process)
      const data = loadBugModelGaps(gapsPath);
      assert.strictEqual(data.entries.length, 1);
      assert.strictEqual(data.entries[0].description, 'session test bug');
      assert.strictEqual(data.entries[0].status, 'no_reproduction');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('file is valid JSON after persist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-gaps-'));
    try {
      const gapsPath = path.join(tmpDir, 'bug-model-gaps.json');
      persistBugGap('json test', [{ model: 'a.tla' }], gapsPath);

      // Read raw file and verify it parses
      const raw = fs.readFileSync(gapsPath, 'utf8');
      const parsed = JSON.parse(raw);
      assert.strictEqual(parsed.version, '1.0');
      assert.ok(Array.isArray(parsed.entries));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
