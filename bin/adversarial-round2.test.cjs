#!/usr/bin/env node
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { fitExponentialDecay } = require('./predictive-power.cjs');
const { parseClassificationResponse } = require('./escalation-classifier.cjs');
const { verifyMergedState } = require('./worktree-merge.cjs');
const { countOscillations } = require('./oscillation-detector.cjs');

let tmpDir;

function freshTmp() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adversarial-round2-'));
  return tmpDir;
}

function cleanTmp() {
  if (tmpDir) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 7: fitExponentialDecay edge cases and division by zero
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-7: fitExponentialDecay edge cases', () => {
  it('handles near-zero denominator without crashing', () => {
    // Create series that would make denominator very small
    const values = [1.0000001, 1.0000002, 1.0000003, 1.0000004, 1.0000005, 1.0000006, 1.0000007, 1.0000008, 1.0000009, 1.0000010, 1.0000011];
    const result = fitExponentialDecay(values);
    assert.ok(result.status === 'STABLE' || result.status === 'DEGENERATE' || result.status === 'NOT_CONVERGING',
      'Should not crash on near-zero denominator, got status: ' + result.status);
  });

  it('handles very small lambda causing massive sessions calculation', () => {
    // Create exponential decay with very small lambda
    const values = [10, 9.9, 9.8, 9.7, 9.6, 9.5, 9.4, 9.3, 9.2, 9.1, 9.0, 8.9, 8.8, 8.7, 8.6, 8.5, 8.4, 8.3, 8.2, 8.1];
    const result = fitExponentialDecay(values);
    assert.ok(typeof result.sessions_to_convergence === 'number' && result.sessions_to_convergence >= 0,
      'Sessions calculation should be reasonable, got: ' + result.sessions_to_convergence);
  });

  it('handles negative lambda (increasing series)', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const result = fitExponentialDecay(values);
    assert.equal(result.status, 'NOT_CONVERGING');
    assert.ok(result.lambda < 0, 'Increasing series should have negative lambda');
  });

  it('correctly identifies converged series', () => {
    const values = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    const result = fitExponentialDecay(values);
    assert.equal(result.status, 'STABLE'); // All same values = STABLE, not CONVERGED
    assert.equal(result.lambda, 0);
    assert.equal(result.sessions_to_convergence, null);
  });

  it('handles insufficient data gracefully', () => {
    const values = [1, 2, 3, 4]; // < 10 points
    const result = fitExponentialDecay(values);
    assert.equal(result.status, 'INSUFFICIENT_DATA');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 8: parseClassificationResponse markdown stripping incomplete
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-8: parseClassificationResponse markdown handling', () => {
  it('handles code blocks without language specifier', () => {
    const input = '```\n{"classification": "GENUINE_REGRESSION", "confidence": 0.9, "reasoning": "test"}\n```';
    const result = parseClassificationResponse(input);
    assert.equal(result.classification, 'GENUINE_REGRESSION');
    assert.equal(result.confidence, 0.9);
  });

  it('handles mixed case code fences', () => {
    const input = '```JSON\n{"classification": "MEASUREMENT_NOISE", "confidence": 0.7}\n```';
    const result = parseClassificationResponse(input);
    assert.equal(result.classification, 'MEASUREMENT_NOISE');
    assert.equal(result.confidence, 0.7);
  });

  it('handles code blocks with extra spaces', () => {
    const input = '``` json \n{"classification": "INSUFFICIENT_EVIDENCE", "confidence": 0.1}\n ``` ';
    const result = parseClassificationResponse(input);
    assert.equal(result.classification, 'INSUFFICIENT_EVIDENCE');
    assert.equal(result.confidence, 0.1);
  });

  it('handles nested code blocks', () => {
    const input = '```\n```\n{"classification": "GENUINE_REGRESSION", "confidence": 0.8}\n```\n```';
    const result = parseClassificationResponse(input);
    assert.equal(result.classification, 'INSUFFICIENT_EVIDENCE',
      'Should fallback on nested code blocks');
  });

  it('strips incomplete code fences', () => {
    const input = '{"classification": "MEASUREMENT_NOISE", "confidence": 0.6}```';
    const result = parseClassificationResponse(input);
    assert.equal(result.classification, 'MEASUREMENT_NOISE');
    assert.equal(result.confidence, 0.6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 9: verifyMergedState assumes npm test exists
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-9: verifyMergedState npm test assumptions', () => {
  beforeEach(() => freshTmp());
  afterEach(() => cleanTmp());

  it('handles directory without package.json gracefully', () => {
    const dir = freshTmp();
    // No package.json in directory
    const result = verifyMergedState(dir, 'abc123');
    assert.equal(result.pass, false);
    assert.ok(result.error.includes('test failure') || result.error.includes('ENOENT'),
      'Should fail gracefully without package.json');
    cleanTmp();
  });

  it('handles npm test failure', () => {
    const dir = freshTmp();
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'test',
      version: '1.0.0',
      scripts: { test: 'exit 1' }
    }));
    const result = verifyMergedState(dir, 'abc123');
    assert.equal(result.pass, false);
    assert.ok(result.error.length > 0, 'Should capture test failure');
    cleanTmp();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 10: escalation-classifier callHaiku JSON injection vulnerability
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-10: callHaiku JSON injection (SKIPPED - requires ANTHROPIC_API_KEY)', () => {
  it.skip('would demonstrate JSON injection if API key was available', () => {
    // This test would demonstrate code injection vulnerability if we had an API key
    // The child process script does: content: ${JSON.stringify(prompt)}
    // If prompt contains malicious code, it could break out of the string
    // However, we can't test this without exposing API keys
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 11: countOscillations with many zero deltas
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-11: countOscillations zero delta handling', () => {
  it('handles series with many zero deltas', () => {
    const values = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5]; // 9 deltas, all zero
    const result = countOscillations(values);
    assert.equal(result, 0, 'Zero deltas should not count as oscillations');
  });

  it('handles oscillation interrupted by zeros', () => {
    const values = [1, 3, 1, 1, 1, 3, 1]; // deltas: [2, -2, 0, 0, 2, -2]
    const result = countOscillations(values);
    assert.equal(result, 2, 'Should count oscillations despite zero deltas in between');
  });

  it('handles single oscillation', () => {
    const values = [1, 2, 1]; // deltas: [1, -1]
    const result = countOscillations(values);
    assert.equal(result, 1, 'Single oscillation should be counted');
  });

  it('handles increasing then flat then oscillation', () => {
    const values = [1, 2, 2, 2, 1, 3, 1]; // deltas: [1, 0, 0, -1, 2, -2]
    const result = countOscillations(values);
    assert.equal(result, 2, 'Should count 2 oscillations');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 12: oscillation-detector readTrendWindow malformed JSON
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-12: readTrendWindow malformed JSON handling', () => {
  beforeEach(() => freshTmp());
  afterEach(() => cleanTmp());

  it('handles malformed JSON lines gracefully', () => {
    const dir = freshTmp();
    const trendPath = path.join(dir, 'trend.jsonl');
    fs.writeFileSync(trendPath, '{"valid": "json"}\n{invalid json\n{"also": "valid"}\n');
    const result = require('./oscillation-detector.cjs').readTrendWindow(trendPath, 10);
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 2, 'Should skip malformed lines and return valid ones');
    cleanTmp();
  });

  it('handles empty file', () => {
    const dir = freshTmp();
    const trendPath = path.join(dir, 'trend.jsonl');
    fs.writeFileSync(trendPath, '');
    const result = require('./oscillation-detector.cjs').readTrendWindow(trendPath, 10);
    assert.deepEqual(result, []);
    cleanTmp();
  });

  it('handles non-existent file', () => {
    const dir = freshTmp();
    const trendPath = path.join(dir, 'nonexistent.jsonl');
    const result = require('./oscillation-detector.cjs').readTrendWindow(trendPath, 10);
    assert.deepEqual(result, []);
    cleanTmp();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 13: worktree-merge branch deletion with unmerged changes
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-13: cleanupWorktreeBranches safety', () => {
  beforeEach(() => freshTmp());
  afterEach(() => cleanTmp());

  it('handles branch deletion failure gracefully', () => {
    const dir = freshTmp();
    // Try to delete a non-existent branch
    const result = require('./worktree-merge.cjs').cleanupWorktreeBranches(dir, ['nonexistent-branch']);
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'failed');
    assert.ok(result[0].error.length > 0);
    cleanTmp();
  });

  it('handles empty branch list', () => {
    const dir = freshTmp();
    const result = require('./worktree-merge.cjs').cleanupWorktreeBranches(dir, []);
    assert.deepEqual(result, []);
    cleanTmp();
  });

  it('handles null/undefined branch list', () => {
    const dir = freshTmp();
    const result = require('./worktree-merge.cjs').cleanupWorktreeBranches(dir, null);
    assert.deepEqual(result, []);
    cleanTmp();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 14: solve-wave-dag LAYER_DEPS circular dependencies
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-14: solve-wave-dag circular dependency handling', () => {
  it('handles layers with self-dependencies', () => {
    const deps = { 'test_layer': ['test_layer'] };
    const result = require('./solve-wave-dag.cjs').computeWaves({ test_layer: { residual: 1 } }, deps);
    assert.ok(Array.isArray(result));
    // Self-dependencies are filtered out, so layer gets wave 0 if no real dependencies
    assert.ok(result.length === 1 || result.length === 0);
  });

  it('handles empty residual vector', () => {
    const result = require('./solve-wave-dag.cjs').computeWaves({});
    assert.deepEqual(result, []);
  });

  it('handles residual with zero values', () => {
    const result = require('./solve-wave-dag.cjs').computeWaves({ r_to_f: { residual: 0 } });
    assert.deepEqual(result, []);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 15: validate-debt-entry with malicious input
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-15: validateDebtEntry edge cases', () => {
  const { validateDebtEntry } = require('./validate-debt-entry.cjs');

  it('handles null input', () => {
    const result = validateDebtEntry(null);
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
  });

  it('handles non-object input', () => {
    const result = validateDebtEntry("string");
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
  });

  it('validates UUID format strictly', () => {
    const entry = {
      id: 'not-a-uuid',
      fingerprint: 'a'.repeat(16),
      title: 'Test',
      occurrences: 1,
      first_seen: '2026-01-01T00:00:00Z',
      last_seen: '2026-01-01T00:00:00Z',
      environments: ['test'],
      status: 'open',
      source_entries: [{ source_type: 'bash', source_id: 'test-1', observed_at: '2026-01-01T00:00:00Z' }]
    };
    const result = validateDebtEntry(entry);
    assert.ok(Array.isArray(result));
    assert.ok(result.some(err => err.includes('UUID format')));
  });

  it('validates fingerprint length', () => {
    const entry = {
      id: '12345678-1234-1234-1234-123456789abc',
      fingerprint: 'too_short',
      title: 'Test',
      occurrences: 1,
      first_seen: '2026-01-01T00:00:00Z',
      last_seen: '2026-01-01T00:00:00Z',
      environments: ['test'],
      status: 'open',
      source_entries: [{ source_type: 'bash', source_id: 'test-1', observed_at: '2026-01-01T00:00:00Z' }]
    };
    const result = validateDebtEntry(entry);
    assert.ok(Array.isArray(result));
    assert.ok(result.some(err => err.includes('fingerprint')));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 16: solve-focus-filter tokenization edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-16: solve-focus-filter tokenization', () => {
  const { tokenize, filterRequirementsByFocus } = require('./solve-focus-filter.cjs');

  it('handles empty phrase', () => {
    const result = tokenize('');
    assert.deepEqual(result, []);
  });

  it('handles null/undefined phrase', () => {
    const result = tokenize(null);
    assert.deepEqual(result, []);
  });

  it('filters stop words correctly', () => {
    const result = tokenize('the quick brown fox jumps over the lazy dog');
    assert.ok(!result.includes('the'));
    assert.ok(result.includes('over')); // 'over' is not in STOP_WORDS
    assert.ok(result.includes('quick'));
    assert.ok(result.includes('brown'));
    assert.ok(result.includes('fox'));
  });

  it('handles hyphenated words', () => {
    const result = tokenize('end-to-end testing');
    assert.ok(result.includes('end'));
    assert.ok(result.includes('testing'));
  });

  it('enforces minimum token length', () => {
    const result = tokenize('a an i to');
    assert.deepEqual(result, [], 'Single chars should be filtered out');
  });
});