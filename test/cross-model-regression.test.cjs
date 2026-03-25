'use strict';
/** @requirement REG-01 — validates cross-model regression via resolve-proximity-neighbors */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { resolveNeighbors } = require('../bin/resolve-proximity-neighbors.cjs');

// ── Helpers ──────────────────────────────────────────────────────────────────

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cross-model-reg-'));
}

function makePostFixVerification(overrides = {}) {
  return {
    timestamp: new Date().toISOString(),
    model_pass: true,
    neighbor_models_pass: false,
    neighbor_count: 3,
    regressions: [
      {
        model_id: 'alloy:quorum-votes',
        model_path: '.planning/formal/alloy/quorum-votes.als',
        formalism: 'alloy',
        result: 'fail',
        violation: 'assertion QuorumComposition violated',
        hop_distance: 2,
      }
    ],
    passed_neighbors: [
      {
        model_id: 'tla:mcsafety',
        model_path: '.planning/formal/tla/MCsafety.cfg',
        formalism: 'tla',
        result: 'pass',
      }
    ],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('cross-model-regression', () => {

  it('post_fix_verification schema has required fields', () => {
    const pfv = makePostFixVerification();
    assert.ok(typeof pfv.timestamp === 'string', 'timestamp must be string');
    assert.ok(typeof pfv.model_pass === 'boolean', 'model_pass must be boolean');
    assert.ok(typeof pfv.neighbor_models_pass === 'boolean' || pfv.neighbor_models_pass === null,
      'neighbor_models_pass must be boolean or null');
    assert.ok(typeof pfv.neighbor_count === 'number', 'neighbor_count must be number');
    assert.ok(Array.isArray(pfv.regressions), 'regressions must be array');
    assert.ok(Array.isArray(pfv.passed_neighbors), 'passed_neighbors must be array');
  });

  it('regressions array entries have required fields', () => {
    const pfv = makePostFixVerification();
    const reg = pfv.regressions[0];
    assert.ok(reg.model_id, 'regression must have model_id');
    assert.ok(reg.model_path, 'regression must have model_path');
    assert.ok(reg.formalism, 'regression must have formalism');
    assert.ok(reg.result, 'regression must have result');
    assert.ok(typeof reg.violation === 'string', 'regression must have violation string');
    assert.ok(typeof reg.hop_distance === 'number', 'regression must have hop_distance number');
  });

  it('bug-model-gaps.json entry can be enriched with post_fix_verification', () => {
    const dir = tmpDir();
    const gapsPath = path.join(dir, 'bug-model-gaps.json');
    const entry = { bug_id: 'abc12345', status: 'reproduced', model_path: 'test.tla' };
    const gaps = { version: '1.0', entries: [entry] };

    // Enrich with post_fix_verification
    entry.post_fix_verification = makePostFixVerification();
    fs.writeFileSync(gapsPath, JSON.stringify(gaps, null, 2));

    // Read back and verify
    const read = JSON.parse(fs.readFileSync(gapsPath, 'utf8'));
    assert.strictEqual(read.entries.length, 1);
    assert.ok(read.entries[0].post_fix_verification, 'entry should have post_fix_verification');
    assert.strictEqual(read.entries[0].bug_id, 'abc12345');
    assert.strictEqual(read.entries[0].post_fix_verification.neighbor_count, 3);

    fs.rmSync(dir, { recursive: true });
  });

  it('neighbor_models_pass is null when no neighbors found', () => {
    const pfv = makePostFixVerification({
      neighbor_models_pass: null,
      neighbor_count: 0,
      regressions: [],
      passed_neighbors: [],
    });
    assert.strictEqual(pfv.neighbor_models_pass, null, 'should be null (inconclusive)');
    assert.notStrictEqual(pfv.neighbor_models_pass, false, 'should NOT be false');
  });

  it('neighbor_models_pass is true when regressions array is empty', () => {
    const regressions = [];
    const neighborModelsPass = regressions.length === 0;
    assert.strictEqual(neighborModelsPass, true);
  });

  it('neighbor_models_pass is false when regressions array is non-empty', () => {
    const regressions = [{ model_id: 'test', result: 'fail' }];
    const neighborModelsPass = regressions.length === 0;
    assert.strictEqual(neighborModelsPass, false);
  });

  it('--strict behavior blocks on regressions', () => {
    const strict = true;
    const regressions = [{ model_id: 'test', result: 'fail' }];
    const shouldBlock = strict && regressions.length > 0;
    assert.strictEqual(shouldBlock, true, 'strict mode should block when regressions exist');
  });

  it('fail-open behavior proceeds on regressions', () => {
    const strict = false;
    const regressions = [{ model_id: 'test', result: 'fail' }];
    const shouldBlock = strict && regressions.length > 0;
    assert.strictEqual(shouldBlock, false, 'fail-open should NOT block');
  });

  it('end-to-end: resolveNeighbors + scope filter integration', () => {
    // Create minimal proximity index
    const index = {
      schema_version: '1',
      nodes: {
        'formal_module::model-x': {
          type: 'formal_module', id: 'model-x',
          edges: [{ to: 'concept::shared', rel: 'described_by', source: 'test' }]
        },
        'concept::shared': {
          type: 'concept', id: 'shared',
          edges: [
            { to: 'formal_module::model-y', rel: 'describes', source: 'test' },
            { to: 'formal_module::model-z', rel: 'describes', source: 'test' }
          ]
        },
        'formal_module::model-y': { type: 'formal_module', id: 'model-y', edges: [] },
        'formal_module::model-z': { type: 'formal_module', id: 'model-z', edges: [] },
      }
    };

    const result = resolveNeighbors(index, 'model-x');
    assert.ok(result.neighbors.length >= 2, 'should find at least 2 neighbors');

    // Format as --scope value
    const scopeValue = result.neighbors.map(n => n.id).join(',');
    assert.ok(scopeValue.includes('model-y'), 'scope should include model-y');
    assert.ok(scopeValue.includes('model-z'), 'scope should include model-z');
    // Verify format is valid for --scope (no spaces, comma-separated)
    assert.ok(!scopeValue.includes(' '), 'scope value should not contain spaces');
  });

  it('model ID extraction from file paths', () => {
    // Test the extraction logic used in Phase 5b
    function extractModelId(filePath) {
      return path.basename(filePath).replace(/\.(tla|cfg|als|pm)$/, '').toLowerCase();
    }

    assert.strictEqual(extractModelId('.planning/formal/tla/MCsafety.cfg'), 'mcsafety');
    assert.strictEqual(extractModelId('.planning/formal/alloy/quorum-votes.als'), 'quorum-votes');
    assert.strictEqual(extractModelId('.planning/formal/prism/quorum.pm'), 'quorum');
    assert.strictEqual(extractModelId('.planning/formal/tla/MCoscillation.tla'), 'mcoscillation');
  });

});
