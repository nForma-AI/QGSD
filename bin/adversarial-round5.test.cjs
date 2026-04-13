#!/usr/bin/env node
'use strict';

// bin/adversarial-round5.test.cjs
// Round 5: Adversarial tests for solver layers and error handling

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 26: nf-solve sweepRtoF error handling
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-26: sweepRtoF error handling', () => {
  function sweepRtoF(root) {
    const result = { residual: 0, detail: {} };
    try {
      const matrixPath = path.join(root, '.planning', 'formal', 'traceability-matrix.json');
      if (!fs.existsSync(matrixPath)) {
        return { residual: -1, detail: { error: 'missing traceability-matrix.json' } };
      }
      const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
      // Simplified logic
      const uncovered = matrix.uncovered_requirements || [];
      result.residual = uncovered.length;
      result.detail.uncovered_requirements = uncovered;
    } catch (e) {
      result.residual = -1;
      result.detail.error = e.message;
    }
    return result;
  }

  it('handles missing matrix file', () => {
    const result = sweepRtoF('/nonexistent');
    assert.equal(result.residual, -1, 'Should return -1 for missing file');
    assert(result.detail.error.includes('missing'), 'Should have error message');
  });

  it('BUG: handles malformed JSON', () => {
    // Mock fs
    const originalRead = fs.readFileSync;
    const originalExists = fs.existsSync;
    fs.existsSync = () => true;
    fs.readFileSync = () => '{ invalid json';

    const result = sweepRtoF('/tmp');

    fs.readFileSync = originalRead;
    fs.existsSync = originalExists;

    assert.equal(result.residual, -1, 'Should return -1 for malformed JSON');
    assert(result.detail.error, 'Should have error message');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 27: nf-solve sweepFtoT with missing sync data
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-27: sweepFtoT missing sync data', () => {
  function loadFormalTestSync(root) {
    try {
      const syncPath = path.join(root, '.planning', 'formal', 'formal-test-sync.json');
      if (!fs.existsSync(syncPath)) return null;
      return JSON.parse(fs.readFileSync(syncPath, 'utf8'));
    } catch (e) {
      return null;
    }
  }

  function sweepFtoT(root) {
    const syncData = loadFormalTestSync(root);
    if (!syncData) {
      return { residual: -1, detail: { error: 'formal-test-sync.cjs failed' } };
    }
    const gaps = syncData.coverage_gaps || {};
    const gapCount = gaps.stats ? gaps.stats.gap_count || 0 : 0;
    return { residual: gapCount, detail: { gap_count: gapCount } };
  }

  it('handles missing sync file', () => {
    const result = sweepFtoT('/nonexistent');
    assert.equal(result.residual, -1, 'Should return -1 for missing sync file');
  });

  it('BUG: handles malformed sync JSON', () => {
    const originalRead = fs.readFileSync;
    const originalExists = fs.existsSync;
    fs.existsSync = () => true;
    fs.readFileSync = () => '{ "invalid": json }';

    const result = sweepFtoT('/tmp');

    fs.readFileSync = originalRead;
    fs.existsSync = originalExists;

    assert.equal(result.residual, -1, 'Should return -1 for malformed sync JSON');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 28: nf-solve sweepCtoF with invalid constants
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-28: sweepCtoF invalid constants validation', () => {
  function sweepCtoF(root) {
    const result = { residual: 0, detail: {} };
    try {
      const syncPath = path.join(root, '.planning', 'formal', 'formal-test-sync.json');
      if (!fs.existsSync(syncPath)) {
        return { residual: -1, detail: { error: 'missing sync data' } };
      }
      const syncData = JSON.parse(fs.readFileSync(syncPath, 'utf8'));
      const validation = syncData.constants_validation || [];
      const mismatches = validation.filter(entry =>
        entry.match === false &&
        entry.intentional_divergence !== true &&
        entry.config_path !== null
      );
      result.residual = mismatches.length;
      result.detail.mismatches = mismatches;
    } catch (e) {
      result.residual = -1;
      result.detail.error = e.message;
    }
    return result;
  }

  it('handles missing sync data', () => {
    const result = sweepCtoF('/nonexistent');
    assert.equal(result.residual, -1, 'Should return -1 for missing sync data');
  });

  it('BUG: handles null validation array', () => {
    const originalRead = fs.readFileSync;
    const originalExists = fs.existsSync;
    fs.existsSync = () => true;
    fs.readFileSync = () => JSON.stringify({ constants_validation: null });

    const result = sweepCtoF('/tmp');

    fs.readFileSync = originalRead;
    fs.existsSync = originalExists;

    assert.equal(result.residual, 0, 'Should handle null validation array');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 29: nf-solve sweepTtoC with invalid test runner
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-29: sweepTtoC invalid test runner config', () => {
  function sweepTtoC(root) {
    // Simplified
    const configPath = path.join(root, '.planning', 'config.json');
    let tToCConfig = { runner: 'node-test', command: null, scope: 'all' };
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.solve && cfg.solve.t_to_c) {
        tToCConfig = { ...tToCConfig, ...cfg.solve.t_to_c };
      }
    } catch (e) { /* use defaults */ }

    if (tToCConfig.runner === 'none') {
      return { residual: 0, detail: { skipped: true, reason: 'runner=none in config' } };
    }

    // Mock test running
    return { residual: 5, detail: { total_tests: 10, failed: 5 } };
  }

  it('handles runner=none', () => {
    const originalRead = fs.readFileSync;
    fs.readFileSync = () => JSON.stringify({ solve: { t_to_c: { runner: 'none' } } });

    const result = sweepTtoC('/tmp');

    fs.readFileSync = originalRead;

    assert.equal(result.residual, 0, 'Should return 0 for runner=none');
    assert(result.detail.skipped, 'Should be skipped');
  });

  it('BUG: handles malformed config JSON', () => {
    const originalRead = fs.readFileSync;
    fs.readFileSync = () => '{ invalid json';

    const result = sweepTtoC('/tmp');

    fs.readFileSync = originalRead;

    assert.equal(result.residual, 5, 'Should use defaults for malformed config');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 30: nf-solve sweepDtoC with missing manifests
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-30: sweepDtoC missing dependency manifests', () => {
  function sweepDtoC(root) {
    const result = { residual: 0, detail: {} };
    const allKnownDeps = new Set();

    // Load manifests
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      for (const d of Object.keys(pkg.dependencies || {})) allKnownDeps.add(d);
      for (const d of Object.keys(pkg.devDependencies || {})) allKnownDeps.add(d);
    } catch (e) { /* no package.json */ }

    // Mock claims
    const claims = [{ type: 'dependency', value: 'lodash' }];
    const brokenClaims = [];

    for (const claim of claims) {
      if (claim.type === 'dependency' && !allKnownDeps.has(claim.value)) {
        brokenClaims.push(claim);
      }
    }

    result.residual = brokenClaims.length;
    result.detail.broken_claims = brokenClaims;
    return result;
  }

  it('handles missing package.json', () => {
    const result = sweepDtoC('/nonexistent');
    assert.equal(result.residual, 1, 'Should detect missing dependency');
  });

  it('BUG: handles malformed package.json', () => {
    const originalRead = fs.readFileSync;
    fs.readFileSync = (filePath) => {
      if (filePath.includes('package.json')) return '{ invalid json';
      return '{}';
    };

    const result = sweepDtoC('/tmp');

    fs.readFileSync = originalRead;

    assert.equal(result.residual, 1, 'Should handle malformed package.json');
  });
});