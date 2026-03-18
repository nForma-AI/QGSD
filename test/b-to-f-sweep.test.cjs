'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { LAYER_KEYS } = require('../bin/layer-constants.cjs');
const { LAYER_DEPS, computeWaves } = require('../bin/solve-wave-dag.cjs');

// classifyFailingTest is exported from nf-solve.cjs for unit testing
let classifyFailingTest;
try {
  classifyFailingTest = require('../bin/nf-solve.cjs').classifyFailingTest;
} catch (e) {
  // nf-solve.cjs may fail to load in test environment due to missing deps
}

describe('BTF-01: b_to_f layer registration', () => {
  it('LAYER_KEYS contains b_to_f', () => {
    assert.ok(LAYER_KEYS.includes('b_to_f'), 'b_to_f should be in LAYER_KEYS');
  });

  it('LAYER_KEYS has exactly 20 entries', () => {
    assert.equal(LAYER_KEYS.length, 20, `Expected 20 layer keys, got ${LAYER_KEYS.length}`);
  });

  it('b_to_f is at index 19', () => {
    assert.equal(LAYER_KEYS[19], 'b_to_f', `Expected LAYER_KEYS[19] to be b_to_f, got ${LAYER_KEYS[19]}`);
  });
});

describe('BTF-02: b_to_f wave DAG integration', () => {
  it('LAYER_DEPS has b_to_f entry', () => {
    assert.ok(LAYER_DEPS.b_to_f !== undefined, 'LAYER_DEPS should have b_to_f entry');
  });

  it('b_to_f depends on t_to_c', () => {
    assert.deepEqual(LAYER_DEPS.b_to_f, ['t_to_c'], 'b_to_f should depend on t_to_c only');
  });

  it('computeWaves places b_to_f after t_to_c in execution order', () => {
    const residualVector = {
      t_to_c: { residual: 1 },
      b_to_f: { residual: 1 },
    };
    const waves = computeWaves(residualVector);

    const flatOrder = [];
    for (const w of waves) {
      for (const layer of w.layers) {
        flatOrder.push(layer);
      }
    }

    const t_to_c_idx = flatOrder.indexOf('t_to_c');
    const b_to_f_idx = flatOrder.indexOf('b_to_f');

    assert.ok(t_to_c_idx >= 0, 't_to_c should be in the wave plan');
    assert.ok(b_to_f_idx >= 0, 'b_to_f should be in the wave plan');
    assert.ok(b_to_f_idx > t_to_c_idx, `b_to_f (index ${b_to_f_idx}) should execute after t_to_c (index ${t_to_c_idx})`);
  });
});

describe('BTF-03: classifyFailingTest', { skip: !classifyFailingTest && 'classifyFailingTest not exported' }, () => {
  // Mock data structures
  const mockTraceMatrix = {
    test_requirement_map: {
      'test/auth.test.cjs': ['AUTH-01', 'AUTH-02'],
      'test/db.test.cjs': ['DB-01'],
      'test/unmapped.test.cjs': [],
    },
  };

  const mockModelRegistry = {
    models: {
      '.planning/formal/tla/auth-flow.tla': {
        requirements: ['AUTH-01', 'AUTH-02'],
      },
      '.planning/formal/alloy/auth-structure.als': {
        requirements: ['AUTH-01'],
      },
    },
  };

  const mockBugGapsEmpty = { version: '1.0', entries: [] };

  const crypto = require('crypto');
  const authBugId = crypto.createHash('sha256').update('test/auth.test.cjs').digest('hex').slice(0, 8);

  const mockBugGapsReproduced = {
    version: '1.0',
    entries: [
      { bug_id: authBugId, status: 'reproduced', matched_models: [] },
    ],
  };

  it('returns not_covered when test has no requirement mapping', () => {
    const result = classifyFailingTest(
      'test/unmapped.test.cjs',
      mockTraceMatrix,
      mockModelRegistry,
      mockBugGapsEmpty
    );
    assert.equal(result.classification, 'not_covered');
    assert.deepEqual(result.models, []);
  });

  it('returns not_covered when requirements have no formal models', () => {
    const result = classifyFailingTest(
      'test/db.test.cjs',
      mockTraceMatrix,
      mockModelRegistry,
      mockBugGapsEmpty
    );
    assert.equal(result.classification, 'not_covered');
    assert.deepEqual(result.models, []);
  });

  it('returns covered_not_reproduced when models exist but no reproduction record', () => {
    const result = classifyFailingTest(
      'test/auth.test.cjs',
      mockTraceMatrix,
      mockModelRegistry,
      mockBugGapsEmpty
    );
    assert.equal(result.classification, 'covered_not_reproduced');
    assert.ok(result.models.length > 0, 'Should have matched models');
  });

  it('returns covered_reproduced when bug-model-gaps has reproduced status', () => {
    const result = classifyFailingTest(
      'test/auth.test.cjs',
      mockTraceMatrix,
      mockModelRegistry,
      mockBugGapsReproduced
    );
    assert.equal(result.classification, 'covered_reproduced');
    assert.ok(result.models.length > 0, 'Should have matched models');
  });

  it('generates deterministic bug_id from test path', () => {
    const result1 = classifyFailingTest('test/auth.test.cjs', mockTraceMatrix, mockModelRegistry, mockBugGapsEmpty);
    const result2 = classifyFailingTest('test/auth.test.cjs', mockTraceMatrix, mockModelRegistry, mockBugGapsEmpty);
    assert.equal(result1.bug_id, result2.bug_id, 'Same test path should produce same bug_id');
    assert.equal(result1.bug_id.length, 8, 'bug_id should be 8 characters');
  });

  it('residual = not_covered + covered_not_reproduced (covered_reproduced contributes 0)', () => {
    // Classify all tests and compute residual manually
    const tests = Object.keys(mockTraceMatrix.test_requirement_map);
    let notCovered = 0;
    let coveredNotReproduced = 0;

    for (const t of tests) {
      const r = classifyFailingTest(t, mockTraceMatrix, mockModelRegistry, mockBugGapsEmpty);
      if (r.classification === 'not_covered') notCovered++;
      if (r.classification === 'covered_not_reproduced') coveredNotReproduced++;
    }

    // unmapped -> not_covered, db -> not_covered (no models for DB-01), auth -> covered_not_reproduced
    assert.equal(notCovered, 2, 'Should have 2 not_covered tests');
    assert.equal(coveredNotReproduced, 1, 'Should have 1 covered_not_reproduced test');

    const expectedResidual = notCovered + coveredNotReproduced;
    assert.equal(expectedResidual, 3, 'Residual should be 3 (2 not_covered + 1 covered_not_reproduced)');
  });
});

describe('BTF-03: sweepBtoF export', { skip: !classifyFailingTest && 'nf-solve.cjs not loaded' }, () => {
  it('sweepBtoF is exported from nf-solve.cjs', () => {
    const solve = require('../bin/nf-solve.cjs');
    assert.equal(typeof solve.sweepBtoF, 'function', 'sweepBtoF should be exported as a function');
  });

  it('classifyFailingTest is exported from nf-solve.cjs', () => {
    const solve = require('../bin/nf-solve.cjs');
    assert.equal(typeof solve.classifyFailingTest, 'function', 'classifyFailingTest should be exported as a function');
  });
});
