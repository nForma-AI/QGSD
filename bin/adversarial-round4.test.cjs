#!/usr/bin/env node
'use strict';

// bin/adversarial-round4.test.cjs
// Round 4: Adversarial tests for remaining system components

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 21: nf-solve gate-score-utils issues
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-21: gate-score-utils resolveGateScore', () => {
  function resolveGateScore(layerKey, residual, gateSummary) {
    // Simplified version from gate-score-utils.cjs
    if (!gateSummary || !gateSummary.gates) return 0;

    const gate = gateSummary.gates[layerKey];
    if (!gate) return 0;

    const score = gate.score || 0;
    const threshold = gate.threshold || 0;

    // Adversarial: what if residual is negative?
    if (residual < 0) return score;

    if (score >= threshold) return score;

    // Adversarial: division by zero?
    if (threshold === 0) return score;

    return Math.min(score, threshold - residual);
  }

  it('handles negative residual', () => {
    const gateSummary = {
      gates: {
        'r_to_f': { score: 50, threshold: 100 }
      }
    };
    const result = resolveGateScore('r_to_f', -5, gateSummary);
    assert.equal(result, 50, 'Should return score for negative residual');
  });

  it('handles zero threshold', () => {
    const gateSummary = {
      gates: {
        'r_to_f': { score: 50, threshold: 0 }
      }
    };
    const result = resolveGateScore('r_to_f', 10, gateSummary);
    assert.equal(result, 50, 'Should return score when threshold is 0');
  });

  it('BUG: incorrect calculation when score > threshold', () => {
    const gateSummary = {
      gates: {
        'r_to_f': { score: 150, threshold: 100 }
      }
    };
    const result = resolveGateScore('r_to_f', 10, gateSummary);
    // Current logic: if (score >= threshold) return score; so returns 150
    // But should it cap at threshold? Or allow above?
    assert.equal(result, 150, 'Should return score when above threshold');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 22: nf-solve oscillation-detector updateVerdicts
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-22: oscillation-detector updateVerdicts', () => {
  function updateVerdicts(layerKey, residual, history) {
    // Simplified from oscillation-detector.cjs
    if (!history || history.length < 3) return 'INSUFFICIENT_EVIDENCE';

    const recent = history.slice(-3);
    const deltas = [];
    for (let i = 1; i < recent.length; i++) {
      deltas.push(recent[i] - recent[i-1]);
    }

    const positive = deltas.filter(d => d > 0).length;
    const negative = deltas.filter(d => d < 0).length;

    if (positive >= 2 && negative >= 2) return 'OSCILLATING';
    if (positive >= 2) return 'INCREASING';
    if (negative >= 2) return 'DECREASING';
    return 'STABLE';
  }

  it('detects oscillation correctly', () => {
    const history = [10, 5, 10, 5, 10];
    const result = updateVerdicts('t_to_c', 10, history);
    assert.equal(result, 'OSCILLATING', 'Should detect oscillation');
  });

  it('BUG: insufficient history returns INSUFFICIENT_EVIDENCE', () => {
    const history = [10, 5];
    const result = updateVerdicts('t_to_c', 5, history);
    assert.equal(result, 'INSUFFICIENT_EVIDENCE', 'Should return INSUFFICIENT_EVIDENCE for short history');
  });

  it('BUG: all increasing', () => {
    const history = [1, 2, 3, 4];
    const result = updateVerdicts('t_to_c', 4, history);
    assert.equal(result, 'INCREASING', 'Should detect increasing trend');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 23: nf-solve convergence-report formatPredictivePowerSummary
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-23: convergence-report formatPredictivePowerSummary', () => {
  function formatPredictivePowerSummary(data) {
    // Simplified from convergence-report.cjs
    if (!data) return 'No predictive power data available';

    const summary = [];
    if (data.accuracy !== undefined) {
      summary.push(`Accuracy: ${data.accuracy}%`);
    }
    if (data.precision !== undefined) {
      summary.push(`Precision: ${data.precision}%`);
    }
    if (data.recall !== undefined) {
      summary.push(`Recall: ${data.recall}%`);
    }

    // Adversarial: what if percentages are invalid?
    summary.push(`F1-Score: ${data.f1_score || 0}%`);

    return summary.join(', ');
  }

  it('formats valid data', () => {
    const data = { accuracy: 85, precision: 90, recall: 80, f1_score: 85 };
    const result = formatPredictivePowerSummary(data);
    assert.equal(result, 'Accuracy: 85%, Precision: 90%, Recall: 80%, F1-Score: 85%', 'Should format correctly');
  });

  it('BUG: handles missing data', () => {
    const data = {};
    const result = formatPredictivePowerSummary(data);
    assert.equal(result, 'F1-Score: 0%', 'Should handle missing data');
  });

  it('BUG: invalid percentages', () => {
    const data = { accuracy: 150, precision: -10 };
    const result = formatPredictivePowerSummary(data);
    // Current: no validation, just prints
    assert.equal(result, 'Accuracy: 150%, Precision: -10%, F1-Score: 0%', 'Should not validate percentages');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 24: nf-solve escalation-classifier detectNewlyBlocked
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-24: escalation-classifier detectNewlyBlocked', () => {
  function detectNewlyBlocked(prevVerdicts, currVerdicts) {
    // Simplified from escalation-classifier.cjs
    const newlyBlocked = [];

    if (!currVerdicts) return newlyBlocked;

    for (const [layer, verdict] of Object.entries(currVerdicts)) {
      const prevVerdict = prevVerdicts ? prevVerdicts[layer] : null;

      if (verdict === 'BLOCKED' && prevVerdict !== 'BLOCKED') {
        newlyBlocked.push(layer);
      }
    }

    return newlyBlocked;
  }

  it('detects newly blocked layers', () => {
    const prev = { 'r_to_f': 'STABLE', 't_to_c': 'INCREASING' };
    const curr = { 'r_to_f': 'BLOCKED', 't_to_c': 'INCREASING' };
    const result = detectNewlyBlocked(prev, curr);
    assert.deepEqual(result, ['r_to_f'], 'Should detect r_to_f as newly blocked');
  });

  it('BUG: null prevVerdicts', () => {
    const curr = { 'r_to_f': 'BLOCKED' };
    const result = detectNewlyBlocked(null, curr);
    assert.deepEqual(result, ['r_to_f'], 'Should treat null prev as not blocked');
  });

  it('BUG: already blocked', () => {
    const prev = { 'r_to_f': 'BLOCKED' };
    const curr = { 'r_to_f': 'BLOCKED' };
    const result = detectNewlyBlocked(prev, curr);
    assert.deepEqual(result, [], 'Should not include already blocked');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 25: nf-solve solve-focus-filter filterRequirementsByFocus
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-25: solve-focus-filter filterRequirementsByFocus', () => {
  function filterRequirementsByFocus(phrase, options) {
    // Simplified from solve-focus-filter.cjs
    const root = options?.root || process.cwd();
    const focusSet = new Set();

    try {
      const reqPath = path.join(root, '.planning', 'formal', 'requirements.json');
      const reqData = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
      const reqs = Array.isArray(reqData) ? reqData : reqData.requirements || [];

      for (const req of reqs) {
        const text = (req.text || req.description || '').toLowerCase();
        if (text.includes(phrase.toLowerCase())) {
          focusSet.add(req.id || req.requirement_id || '');
        }
      }
    } catch (e) {
      // fail-open
    }

    return focusSet;
  }

  it('filters requirements by phrase', () => {
    // Mock fs.readFileSync
    const originalRead = fs.readFileSync;
    fs.readFileSync = (filePath) => {
      if (filePath.includes('requirements.json')) {
        return JSON.stringify([
          { id: 'REQ-1', text: 'User login functionality' },
          { id: 'REQ-2', text: 'Admin dashboard features' }
        ]);
      }
      return originalRead.call(fs, filePath);
    };

    const result = filterRequirementsByFocus('login', { root: '/tmp' });
    assert(result.has('REQ-1'), 'Should include REQ-1');
    assert(!result.has('REQ-2'), 'Should not include REQ-2');

    fs.readFileSync = originalRead;
  });

  it('BUG: case insensitive match', () => {
    const originalRead = fs.readFileSync;
    fs.readFileSync = () => JSON.stringify([{ id: 'REQ-1', text: 'User LOGIN functionality' }]);

    const result = filterRequirementsByFocus('login', { root: '/tmp' });
    assert(result.has('REQ-1'), 'Should match case insensitively');

    fs.readFileSync = originalRead;
  });

  it('BUG: handles missing file', () => {
    const result = filterRequirementsByFocus('test', { root: '/nonexistent' });
    assert.equal(result.size, 0, 'Should return empty set for missing file');
  });
});