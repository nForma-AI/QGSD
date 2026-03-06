#!/usr/bin/env node
'use strict';

const { describe, it, before, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const {
  promoteModel,
  validateCriteria,
  checkAllModels,
  getModelKeys,
  inferSourceLayer,
} = require('./promote-gate-maturity.cjs');

// ── Test fixtures ───────────────────────────────────────────────────────────

function makeRegistry() {
  return {
    version: 1,
    models: undefined,
    '.planning/formal/tla/QGSDQuorum.tla': {
      version: 1,
      last_updated: '2026-03-06T00:00:00.000Z',
      description: 'Test model',
      requirements: ['R3-01'],
    },
    '.planning/formal/alloy/quorum-votes.als': {
      version: 1,
      last_updated: '2026-03-06T00:00:00.000Z',
      description: 'Test alloy model',
      requirements: ['R3-02'],
      source_layer: 'L2',
      gate_maturity: 'SOFT_GATE',
    },
  };
}

const checkResults = [
  { tool: 'run-tlc', result: 'pass', check_id: 'tla:quorum' },
  { tool: 'run-alloy', result: 'fail', check_id: 'alloy:quorum-votes' },
];

// ── Unit tests: validateCriteria ────────────────────────────────────────────

describe('validateCriteria', () => {
  it('ADVISORY always passes validation', () => {
    const result = validateCriteria('.planning/formal/tla/test.tla', {}, 'ADVISORY', []);
    assert.strictEqual(result.valid, true);
  });

  it('SOFT_GATE requires source_layer', () => {
    const result = validateCriteria('/some/unknown/path', {}, 'SOFT_GATE', []);
    assert.strictEqual(result.valid, false);
    assert.ok(result.reason.includes('source_layer'));
  });

  it('SOFT_GATE passes with inferred source_layer', () => {
    const result = validateCriteria('.planning/formal/tla/QGSDQuorum.tla', {}, 'SOFT_GATE', []);
    assert.strictEqual(result.valid, true);
  });

  it('HARD_GATE requires source_layer + passing check-result', () => {
    const result = validateCriteria('.planning/formal/tla/QGSDQuorum.tla', {}, 'HARD_GATE', []);
    assert.strictEqual(result.valid, false);
    assert.ok(result.reason.includes('passing check-result'));
  });

  it('HARD_GATE passes with source_layer and passing check-result', () => {
    const checks = [{ tool: 'run-tlc', result: 'pass', check_id: 'tla:quorum' }];
    const result = validateCriteria('.planning/formal/tla/QGSDQuorum.tla', { source_layer: 'L2' }, 'HARD_GATE', checks);
    assert.strictEqual(result.valid, true);
  });
});

// ── Unit tests: promoteModel ────────────────────────────────────────────────

describe('promoteModel', () => {
  it('rejects promotion if target <= current level', () => {
    const reg = makeRegistry();
    const result = promoteModel(reg, '.planning/formal/alloy/quorum-votes.als', 'ADVISORY', []);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('not a promotion'));
  });

  it('rejects promotion if target == current level', () => {
    const reg = makeRegistry();
    const result = promoteModel(reg, '.planning/formal/alloy/quorum-votes.als', 'SOFT_GATE', []);
    assert.strictEqual(result.success, false);
  });

  it('rejects promotion for unknown model', () => {
    const reg = makeRegistry();
    const result = promoteModel(reg, '.nonexistent', 'SOFT_GATE', []);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('not found'));
  });

  it('promotes ADVISORY -> SOFT_GATE when criteria met', () => {
    const reg = makeRegistry();
    const result = promoteModel(reg, '.planning/formal/tla/QGSDQuorum.tla', 'SOFT_GATE', []);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.from, 'ADVISORY');
    assert.strictEqual(result.to, 'SOFT_GATE');
    assert.strictEqual(reg['.planning/formal/tla/QGSDQuorum.tla'].gate_maturity, 'SOFT_GATE');
  });
});

// ── Unit tests: checkAllModels (with --fix demotion) ────────────────────────

describe('checkAllModels', () => {
  it('no violations for all-ADVISORY models', () => {
    const reg = {
      '.planning/formal/tla/test.tla': { version: 1, requirements: [] },
    };
    const result = checkAllModels(reg, [], false);
    assert.strictEqual(result.violations.length, 0);
  });

  it('detects violation for SOFT_GATE without source_layer', () => {
    const reg = {
      '/some/unknown/path.txt': { version: 1, gate_maturity: 'SOFT_GATE' },
    };
    const result = checkAllModels(reg, [], false);
    // This model won't show up because path doesn't start with '.'
    // Need correct path
    const reg2 = {
      '.some/unknown/path.txt': { version: 1, gate_maturity: 'SOFT_GATE' },
    };
    const result2 = checkAllModels(reg2, [], false);
    assert.strictEqual(result2.violations.length, 1);
  });

  it('--fix demotes violating models', () => {
    const reg = {
      '.some/unknown/path.txt': { version: 1, gate_maturity: 'SOFT_GATE' },
    };
    const result = checkAllModels(reg, [], true);
    assert.strictEqual(result.demotions.length, 1);
    assert.strictEqual(result.demotions[0].from, 'SOFT_GATE');
    assert.strictEqual(result.demotions[0].to, 'ADVISORY');
    assert.strictEqual(reg['.some/unknown/path.txt'].gate_maturity, 'ADVISORY');
  });
});

// ── Unit tests: inferSourceLayer ────────────────────────────────────────────

describe('inferSourceLayer', () => {
  it('infers L2 for .tla files', () => {
    assert.strictEqual(inferSourceLayer('.planning/formal/tla/QGSDQuorum.tla'), 'L2');
  });

  it('infers L2 for .als files', () => {
    assert.strictEqual(inferSourceLayer('.planning/formal/alloy/quorum-votes.als'), 'L2');
  });

  it('infers L1 for evidence paths', () => {
    assert.strictEqual(inferSourceLayer('.planning/formal/evidence/trace-stats.json'), 'L1');
  });

  it('infers L3 for reasoning paths', () => {
    assert.strictEqual(inferSourceLayer('.planning/formal/reasoning/hazard-model.json'), 'L3');
  });

  it('returns null for unrecognized paths', () => {
    assert.strictEqual(inferSourceLayer('/some/random/path.txt'), null);
  });
});

// ── Integration tests with real data ────────────────────────────────────────

describe('integration: real model-registry.json', () => {
  const ROOT = process.env.PROJECT_ROOT || path.join(__dirname, '..');
  const FORMAL = path.join(ROOT, '.planning', 'formal');
  const REGISTRY_PATH = path.join(FORMAL, 'model-registry.json');

  let registry;
  let originalContent;

  before(() => {
    originalContent = fs.readFileSync(REGISTRY_PATH, 'utf8');
    registry = JSON.parse(originalContent);
  });

  afterEach(() => {
    // Restore original registry after each test
    fs.writeFileSync(REGISTRY_PATH, originalContent);
  });

  it('--check reports current state with no violations (all ADVISORY)', () => {
    const result = checkAllModels(registry, [], false);
    assert.strictEqual(result.violations.length, 0);
    assert.ok(result.total > 0, 'Should have models');
    assert.ok(result.by_level.ADVISORY > 0, 'Should have ADVISORY models');
  });

  it('promotes a model to SOFT_GATE and verifies registry updated', () => {
    const modelKeys = getModelKeys(registry);
    const tlaModel = modelKeys.find(k => k.endsWith('.tla'));
    assert.ok(tlaModel, 'Should have at least one TLA model');

    const result = promoteModel(registry, tlaModel, 'SOFT_GATE', []);
    assert.strictEqual(result.success, true);
    assert.strictEqual(registry[tlaModel].gate_maturity, 'SOFT_GATE');
    assert.ok(registry[tlaModel].source_layer, 'source_layer should be set');
  });
});
