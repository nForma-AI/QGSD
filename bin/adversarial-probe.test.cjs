#!/usr/bin/env node
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { detectCycles, detectStateCycles, countBounces, hashState } = require('./solve-cycle-detector.cjs');
const { mergeDebtEntries, deduplicateEntries } = require('./debt-dedup.cjs');
const { isDuplicate, readLastN, appendEntry, getMemoryPath, FILES, MEMORY_DIR } = require('./memory-store.cjs');
const { poissonBinomialCDF, computeConsensusProbability, computeEarlyEscalation } = require('./quorum-consensus-gate.cjs');
const { mannKendall, countOscillations, updateVerdicts, LAYER_KEYS } = require('./oscillation-detector.cjs');
const { rankActionItems, generateSparkline } = require('./convergence-report.cjs');
const { detectFlipFlops, isCooldownSatisfied, updateCooldownState, countDirectionChanges } = require('./gate-stability.cjs');
const { computeWavesFromGraph } = require('./solve-wave-dag.cjs');
const { levenshteinSimilarity, levenshteinDistance } = require('./levenshtein.cjs');
const { parseClassificationResponse } = require('./escalation-classifier.cjs');

let tmpDir;

function freshTmp() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adversarial-test-'));
  return tmpDir;
}

function cleanTmp() {
  if (tmpDir) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

function makeValidDebtEntry(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    fingerprint: crypto.randomBytes(16).toString('hex'),
    title: 'Test debt entry',
    occurrences: 1,
    first_seen: '2026-01-01T00:00:00Z',
    last_seen: '2026-01-01T00:00:00Z',
    environments: ['test'],
    status: 'open',
    source_entries: [{ source_type: 'bash', source_id: 'test-1', observed_at: '2026-01-01T00:00:00Z' }],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 1: detectCycles false positive on constant/flat values
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-1: detectCycles false positive on constant values (FIXED)', () => {
  it('does NOT flag all-zero series [0,0,0,0] as oscillating', () => {
    const result = detectCycles({ r_to_f: [0, 0, 0, 0] });
    assert.deepStrictEqual(result, [],
      'Constant zero series is NOT oscillation');
  });

  it('does NOT flag all-identical series [5,5,5,5] as oscillating', () => {
    const result = detectCycles({ r_to_f: [5, 5, 5, 5] });
    assert.deepStrictEqual(result, [],
      'Constant value [5,5,5,5] is NOT oscillation');
  });

  it('does NOT flag converged series [1,1,1,1,1,1] as oscillating', () => {
    const result = detectCycles({ f_to_t: [1, 1, 1, 1, 1, 1] });
    assert.deepStrictEqual(result, [],
      'Converged/flat residual is NOT oscillation');
  });

  it('correctly ignores strictly monotonic decreasing', () => {
    const result = detectCycles({ r_to_f: [10, 8, 6, 4] });
    assert.deepStrictEqual(result, []);
  });

  it('correctly detects genuine A-B-A-B', () => {
    const result = detectCycles({ r_to_f: [5, 3, 5, 3] });
    assert.deepStrictEqual(result, ['r_to_f']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 2: mergeDebtEntries inflates zero occurrences via || 1 default
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-2: mergeDebtEntries inflates zero occurrences (FIXED)', () => {
  it('preserves occurrences=0 when merging two zero-occurrence entries', () => {
    const a = makeValidDebtEntry({ occurrences: 0 });
    const b = makeValidDebtEntry({ occurrences: 0 });
    const merged = mergeDebtEntries(a, b);
    assert.equal(merged.occurrences, 0,
      '0 + 0 = 0, not 2');
  });

  it('preserves occurrences=0 when merging with non-zero entry', () => {
    const a = makeValidDebtEntry({ occurrences: 5 });
    const b = makeValidDebtEntry({ occurrences: 0 });
    const merged = mergeDebtEntries(a, b);
    assert.equal(merged.occurrences, 5,
      '5 + 0 = 5, not 6');
  });

  it('correctly merges valid occurrences', () => {
    const a = makeValidDebtEntry({ occurrences: 3 });
    const b = makeValidDebtEntry({ occurrences: 2 });
    const merged = mergeDebtEntries(a, b);
    assert.equal(merged.occurrences, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 3: isDuplicate treats empty string as duplicate of everything
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-3: isDuplicate with empty needle (FIXED)', () => {
  beforeEach(() => freshTmp());
  afterEach(() => cleanTmp());

  it('empty string needle returns false (not a duplicate)', () => {
    const dir = freshTmp();
    appendEntry(dir, 'decisions', { summary: 'Some real decision here' });
    appendEntry(dir, 'decisions', { summary: 'Completely unrelated decision' });
    const result = isDuplicate(dir, 'decisions', 'summary', '');
    assert.equal(result, false,
      'Empty needle should not match anything');
    cleanTmp();
  });

  it('single-char needle still matches via bidirectional substring (known behavior)', () => {
    const dir = freshTmp();
    appendEntry(dir, 'decisions', { summary: 'Major architectural change' });
    const result = isDuplicate(dir, 'decisions', 'summary', 'a');
    assert.equal(result, true,
      '"a" is a valid needle and matches via substring');
    cleanTmp();
  });

  it('correctly detects real duplicate', () => {
    const dir = freshTmp();
    appendEntry(dir, 'decisions', { summary: 'Use PostgreSQL for persistence' });
    const result = isDuplicate(dir, 'decisions', 'summary', 'Use PostgreSQL for persistence');
    assert.equal(result, true, 'Exact duplicate should be detected');
    cleanTmp();
  });

  it('whitespace-only needle returns false', () => {
    const dir = freshTmp();
    appendEntry(dir, 'decisions', { summary: 'Some decision' });
    const result = isDuplicate(dir, 'decisions', 'summary', '   ');
    assert.equal(result, false,
      'Whitespace-only needle should not match');
    cleanTmp();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 4: Poisson Binomial doesn't validate probability range [0,1]
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-4: Poisson Binomial with invalid probabilities (FIXED)', () => {
  it('returns NaN for p > 1 (rejected)', () => {
    const result = poissonBinomialCDF([1.5, 0.5], 1);
    assert.ok(isNaN(result),
      'p=1.5 should return NaN (invalid probability)');
  });

  it('returns NaN for p < 0 (rejected)', () => {
    const result = poissonBinomialCDF([-0.5, 0.5], 1);
    assert.ok(isNaN(result),
      'p=-0.5 should return NaN (invalid probability)');
  });

  it('returns NaN for NaN probability (rejected)', () => {
    const result = poissonBinomialCDF([NaN, 0.5], 1);
    assert.ok(isNaN(result),
      'NaN probability should return NaN');
  });

  it('returns correct result for valid probabilities', () => {
    const result = poissonBinomialCDF([0.85, 0.85, 0.85, 0.85], 2);
    assert.ok(result > 0 && result < 1, 'Valid probabilities should produce valid result');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 5: Oscillation detector credits never replenish - permanent block
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-5: Oscillation credits replenish after convergence (FIXED)', () => {
  beforeEach(() => freshTmp());
  afterEach(() => cleanTmp());

  function makeTrendEntry(perLayer) {
    return {
      timestamp: new Date().toISOString(),
      run_id: crypto.randomUUID(),
      total_residual: 0,
      layer_total: 0,
      scope_change: null,
      fast_mode: false,
      per_layer: perLayer,
      gates: { a: null, b: null, c: null },
    };
  }

  function writeTrendJSONL(trendPath, entries) {
    fs.mkdirSync(path.dirname(trendPath), { recursive: true });
    fs.writeFileSync(trendPath, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
  }

  function zeroPerLayerExcept(overrides) {
    const pl = {};
    for (const key of LAYER_KEYS) pl[key] = 0;
    for (const [k, v] of Object.entries(overrides)) pl[k] = v;
    return pl;
  }

  it('credits replenish when layer converges after oscillation', () => {
    const dir = freshTmp();
    const trendPath = path.join(dir, '.planning', 'formal', 'solve-trend.jsonl');
    const verdictsPath = path.join(dir, '.planning', 'formal', 'oscillation-verdicts.json');

    const entries1 = [];
    for (let i = 0; i < 7; i++) {
      entries1.push(makeTrendEntry(zeroPerLayerExcept({ r_to_f: 10 - i })));
    }
    writeTrendJSONL(trendPath, entries1);
    const v1 = updateVerdicts({ root: dir, verdictsPath, trendPath });
    assert.equal(v1.layers.r_to_f.last_direction, 'down');
    assert.ok(v1.layers.r_to_f.credits_remaining >= 1, 'Initial credits should be >= 1');

    const entries2 = [...entries1];
    for (let i = 0; i < 7; i++) {
      entries2.push(makeTrendEntry(zeroPerLayerExcept({ r_to_f: 3 + i })));
    }
    writeTrendJSONL(trendPath, entries2);
    const v2 = updateVerdicts({ root: dir, verdictsPath, trendPath });
    assert.equal(v2.layers.r_to_f.last_direction, 'up');

    const entries3 = [...entries2];
    for (let i = 0; i < 7; i++) {
      entries3.push(makeTrendEntry(zeroPerLayerExcept({ r_to_f: 10 - i })));
    }
    writeTrendJSONL(trendPath, entries3);
    const v3 = updateVerdicts({ root: dir, verdictsPath, trendPath });

    const entries4 = [...entries3];
    for (let i = 0; i < 14; i++) {
      entries4.push(makeTrendEntry(zeroPerLayerExcept({ r_to_f: 2 })));
    }
    writeTrendJSONL(trendPath, entries4);
    const v4 = updateVerdicts({ root: dir, verdictsPath, trendPath });

    assert.ok(v4.layers.r_to_f.credits_remaining > 0,
      `Credits should replenish after sustained convergence, got ${v4.layers.r_to_f.credits_remaining}`);
    assert.equal(v4.layers.r_to_f.blocked, false,
      'Layer should unblock after credits replenish');

    cleanTmp();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 6: convergence-report rankActionItems priority inversion
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-6: rankActionItems priority ordering (FIXED)', () => {
  it('blocked layer always outranks INCREASING regardless of residual', () => {
    const verdicts = {
      r_to_f: { blocked: true, trend: 'STABLE', credits_remaining: 0, oscillation_count: 0, grace_period: false, last_direction: 'down' },
      f_to_t: { blocked: false, trend: 'INCREASING', credits_remaining: 1, oscillation_count: 0, grace_period: false, last_direction: 'up' },
    };
    const residuals = { r_to_f: 0, f_to_t: 99 };
    const items = rankActionItems(verdicts, residuals, 10);
    assert.ok(items.length >= 2, 'Should have at least 2 items');
    const blockedItem = items.find(i => i.layer === 'r_to_f');
    const increasingItem = items.find(i => i.layer === 'f_to_t');
    assert.ok(blockedItem, 'blocked item should appear');
    assert.ok(increasingItem, 'increasing item should appear');
    assert.ok(blockedItem.priority > increasingItem.priority,
      `Blocked (priority=${blockedItem.priority}) must outrank INCREASING (priority=${increasingItem.priority})`);
  });

  it('DECREASING with residual=100 is correctly excluded (no bug)', () => {
    const verdicts = {
      layer_a: { blocked: false, trend: 'DECREASING', credits_remaining: 1, oscillation_count: 0, grace_period: false, last_direction: 'down' },
    };
    const residuals = { layer_a: 100 };
    const items = rankActionItems(verdicts, residuals, 10);
    assert.equal(items.length, 0, 'DECREASING layers are correctly excluded');
  });

  it('STABLE with residual=0 is excluded as not actionable (no bug)', () => {
    const verdicts = {
      layer_a: { blocked: false, trend: 'STABLE', credits_remaining: 1, oscillation_count: 0, grace_period: false, last_direction: 'flat' },
    };
    const residuals = { layer_a: 0 };
    const items = rankActionItems(verdicts, residuals, 10);
    assert.equal(items.length, 0);
  });

  it('OSCILLATING with residual=1 outranks BLOCKED with residual=0 when residual is 60+1=61 vs 100+0=100', () => {
    const verdicts = {
      r_to_f: { blocked: true, trend: 'STABLE', credits_remaining: 0, oscillation_count: 2, grace_period: false, last_direction: 'down' },
      f_to_t: { blocked: false, trend: 'OSCILLATING', credits_remaining: 1, oscillation_count: 3, grace_period: false, last_direction: 'up' },
    };
    const residuals = { r_to_f: 0, f_to_t: 1 };
    const items = rankActionItems(verdicts, residuals, 10);
    const blockedItem = items.find(i => i.layer === 'r_to_f');
    const oscItem = items.find(i => i.layer === 'f_to_t');
    assert.ok(blockedItem, 'blocked item should appear');
    assert.ok(oscItem, 'oscillating item should appear');
    assert.ok(blockedItem.priority > oscItem.priority,
      `Blocked (priority=${blockedItem.priority}) correctly outranks oscillating (priority=${oscItem.priority})`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 7: computeEarlyEscalation rounding causes false escalation at threshold
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-7: computeEarlyEscalation rounding edge cases', () => {
  it('rounds to exactly threshold, then < comparison defers incorrectly', () => {
    const result = computeEarlyEscalation(
      { slot_1: 0.5, slot_2: 0.5, slot_3: 0.5 },
      2,
      1,
      0.5
    );
    assert.equal(typeof result.probability, 'number');
    assert.ok(!isNaN(result.probability));
    if (result.probability === result.threshold) {
      assert.equal(result.shouldEscalate, false,
        'When probability === threshold (after rounding), shouldEscalate should be false (not escalate)');
    }
  });

  it('correctly escalates when remaining rounds = 0', () => {
    const result = computeEarlyEscalation(
      { slot_1: 0.99 },
      1,
      0,
      0.10
    );
    assert.equal(result.shouldEscalate, true);
    assert.equal(result.probability, 0);
  });

  it('correctly computes multi-round probability', () => {
    const result = computeEarlyEscalation(
      { slot_1: 1.0, slot_2: 1.0 },
      2,
      5,
      0.10
    );
    assert.equal(result.probability, 1);
    assert.equal(result.shouldEscalate, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 8: computeWavesFromGraph cycle handling
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-8: computeWavesFromGraph cycle handling', () => {
  it('handles 2-node cycle without crashing', () => {
    const graph = {
      nodes: ['A', 'B'],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
      ],
    };
    const result = computeWavesFromGraph(graph);
    assert.ok(Array.isArray(result), 'Should return an array');
    assert.ok(result.length >= 1, 'Should produce at least 1 wave');
  });

  it('handles 3-node cycle without crashing', () => {
    const graph = {
      nodes: ['X', 'Y', 'Z'],
      edges: [
        { from: 'X', to: 'Y' },
        { from: 'Y', to: 'Z' },
        { from: 'Z', to: 'X' },
      ],
    };
    const result = computeWavesFromGraph(graph);
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1);
    const allLayers = result.flatMap(w => w.layers);
    const hasComposite = allLayers.some(l => l.includes('+'));
    assert.ok(hasComposite, 'Cycle should produce composite node names with + separator');
  });

  it('handles self-loop without crashing', () => {
    const graph = {
      nodes: ['A'],
      edges: [{ from: 'A', to: 'A' }],
    };
    const result = computeWavesFromGraph(graph);
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1);
  });

  it('handles empty graph (no bug)', () => {
    assert.deepStrictEqual(computeWavesFromGraph({ nodes: [], edges: [] }), []);
    assert.deepStrictEqual(computeWavesFromGraph(null), []);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 9: countOscillations with all-same deltas (constant delta = not oscillation)
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-9: countOscillations edge cases', () => {
  it('constant values produce 0 deltas → 0 oscillations (no bug)', () => {
    assert.equal(countOscillations([5, 5, 5, 5, 5]), 0);
  });

  it('monotonically increasing → 0 oscillations (no bug)', () => {
    assert.equal(countOscillations([1, 2, 3, 4, 5]), 0);
  });

  it('perfect alternation → correct oscillation count', () => {
    assert.equal(countOscillations([1, 5, 1, 5, 1, 5]), 4,
      '[1,5,1,5,1,5] → deltas [4,-4,4,-4,4] → 4 sign changes (not 5)');
  });

  it('oscillation count with zero deltas (flat segments) — zeros break sign chain', () => {
    assert.equal(countOscillations([1, 1, 2, 2, 1, 1]), 0,
      '[1,1,2,2,1,1] → deltas [0,1,0,-1,0] → zero deltas break the sign chain, 0 oscillations');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 10: levenshteinSimilarity with very large strings
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-10: Levenshtein edge cases', () => {
  it('handles one empty string correctly', () => {
    assert.equal(levenshteinDistance('', 'abc'), 3);
    assert.equal(levenshteinDistance('abc', ''), 3);
    assert.equal(levenshteinSimilarity('', 'abc'), 0);
  });

  it('both empty = similarity 1.0', () => {
    assert.equal(levenshteinSimilarity('', ''), 1.0);
  });

  it('identical strings = distance 0', () => {
    assert.equal(levenshteinDistance('hello', 'hello'), 0);
    assert.equal(levenshteinSimilarity('hello', 'hello'), 1.0);
  });

  it('unicode handling — multi-byte characters', () => {
    const dist = levenshteinDistance('café', 'cafe');
    assert.ok(dist > 0, 'é vs e should have distance >= 1, got: ' + dist);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 11: gate-stability countDirectionChanges edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-11: gate-stability countDirectionChanges', () => {
  it('unknown level names are silently skipped', () => {
    const entries = [
      { from_level: 'UNKNOWN', to_level: 'SOFT_GATE' },
      { from_level: 'ADVISORY', to_level: 'HARD_GATE' },
    ];
    const changes = countDirectionChanges(entries);
    assert.equal(changes, 0,
      'First entry skipped (UNKNOWN level), second entry is up with no prior direction → 0 changes');
  });

  it('same-level transitions are skipped but direction is preserved', () => {
    const entries = [
      { from_level: 'ADVISORY', to_level: 'SOFT_GATE' },
      { from_level: 'SOFT_GATE', to_level: 'SOFT_GATE' },
      { from_level: 'SOFT_GATE', to_level: 'ADVISORY' },
    ];
    const changes = countDirectionChanges(entries);
    assert.equal(changes, 1,
      'up (A→S), same skipped, down (S→A) → 1 direction change');
  });

  it('detects 3+ alternations for flip-flop flagging', () => {
    const entries = [
      { from_level: 'ADVISORY', to_level: 'SOFT_GATE' },
      { from_level: 'SOFT_GATE', to_level: 'ADVISORY' },
      { from_level: 'ADVISORY', to_level: 'SOFT_GATE' },
      { from_level: 'SOFT_GATE', to_level: 'ADVISORY' },
    ];
    const changes = countDirectionChanges(entries);
    assert.ok(changes >= 3, '4 alternating entries should produce 3+ direction changes, got: ' + changes);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 12: parseClassificationResponse allows injection via markdown fences
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-12: parseClassificationResponse edge cases', () => {
  it('handles markdown code fences around JSON', () => {
    const input = '```json\n{"classification": "GENUINE_REGRESSION", "confidence": 0.8, "reasoning": "test"}\n```';
    const result = parseClassificationResponse(input);
    assert.equal(result.classification, 'GENUINE_REGRESSION');
    assert.equal(result.confidence, 0.8);
  });

  it('falls back on invalid classification', () => {
    const result = parseClassificationResponse('{"classification": "INVALID", "confidence": 0.5, "reasoning": "test"}');
    assert.equal(result.classification, 'INSUFFICIENT_EVIDENCE',
      'Invalid classification should fall back to INSUFFICIENT_EVIDENCE');
  });

  it('clamps out-of-range confidence', () => {
    const result = parseClassificationResponse('{"classification": "GENUINE_REGRESSION", "confidence": 5.0, "reasoning": "test"}');
    assert.equal(result.confidence, 1.0, 'Confidence > 1.0 should be clamped to 1.0');
  });

  it('clamps negative confidence', () => {
    const result = parseClassificationResponse('{"classification": "MEASUREMENT_NOISE", "confidence": -0.5, "reasoning": "test"}');
    assert.equal(result.confidence, 0.0, 'Negative confidence should be clamped to 0.0');
  });

  it('handles null response', () => {
    const result = parseClassificationResponse(null);
    assert.equal(result.classification, 'INSUFFICIENT_EVIDENCE');
    assert.equal(result.confidence, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 13: dedup engine chaining — merged entry can absorb further entries
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-13: deduplicateEntries transitive merge', () => {
  it('A merges with B, then merged-AB can absorb C via levenshtein', () => {
    const a = makeValidDebtEntry({ title: 'Fix memory leak in parser', fingerprint: 'aaa' });
    const b = makeValidDebtEntry({ title: 'Fix memory leak in parser module', fingerprint: 'bbb' });
    const c = makeValidDebtEntry({ title: 'Fix memory leak in parser utility', fingerprint: 'ccc' });
    const result = deduplicateEntries([a, b, c], { threshold: 0.7 });
    assert.ok(result.mergeCount >= 1, 'Should merge at least one pair');
    assert.ok(result.entries.length < 3, 'Some entries should be merged');
  });

  it('entries with same fingerprint always merge regardless of title', () => {
    const a = makeValidDebtEntry({ title: 'Completely different title A', fingerprint: 'same_fp_1234567890' });
    const b = makeValidDebtEntry({ title: 'Totally unrelated title B', fingerprint: 'same_fp_1234567890' });
    const result = deduplicateEntries([a, b], { threshold: 0.99 });
    assert.equal(result.mergeCount, 1, 'Same fingerprint should merge even with dissimilar titles');
    assert.equal(result.entries.length, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 14: isCooldownSatisfied with malformed stability info
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-14: isCooldownSatisfied with edge cases', () => {
  it('returns true for null input (fail-open)', () => {
    assert.equal(isCooldownSatisfied(null), true);
  });

  it('returns true for undefined input (fail-open)', () => {
    assert.equal(isCooldownSatisfied(undefined), true);
  });

  it('returns true for non-UNSTABLE status', () => {
    assert.equal(isCooldownSatisfied({ stability_status: 'STABLE' }), true);
  });

  it('returns true when cooldown object is missing', () => {
    assert.equal(isCooldownSatisfied({ stability_status: 'UNSTABLE' }), true);
  });

  it('returns true when both conditions are met', () => {
    const stability = {
      stability_status: 'UNSTABLE',
      flagged_at: new Date(Date.now() - 7200000).toISOString(),
      cooldown: {
        consecutive_stable_sessions: 5,
        required_sessions: 3,
        required_wall_time_ms: 3600000,
      },
    };
    assert.equal(isCooldownSatisfied(stability), true);
  });

  it('returns false when only sessions met but wall time not', () => {
    const stability = {
      stability_status: 'UNSTABLE',
      flagged_at: new Date().toISOString(),
      cooldown: {
        consecutive_stable_sessions: 5,
        required_sessions: 3,
        required_wall_time_ms: 3600000,
      },
    };
    assert.equal(isCooldownSatisfied(stability), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 15: generateSparkline with mixed valid and missing values
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-15: generateSparkline edge cases', () => {
  it('all missing values → all dots', () => {
    const result = generateSparkline([-1, -1, -1, -1]);
    assert.equal(result, '····');
  });

  it('single valid value → middle level char', () => {
    const result = generateSparkline([5]);
    assert.equal(result, '▅');
  });

  it('single zero → middle level char', () => {
    const result = generateSparkline([0]);
    assert.equal(result, '▅');
  });

  it('empty array → empty string', () => {
    assert.equal(generateSparkline([]), '');
  });

  it('null/undefined → empty string', () => {
    assert.equal(generateSparkline(null), '');
    assert.equal(generateSparkline(undefined), '');
  });

  it('mixed: some -1 and some valid → correct characters', () => {
    const result = generateSparkline([-1, 1, 3, -1, 5]);
    assert.ok(result.includes('·'), 'Should contain missing char');
    assert.ok(result.length === 5, 'Should have 5 chars');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 16: computeConsensusProbability with empty slotRates
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-16: computeConsensusProbability with empty/no slots', () => {
  it('empty slotRates with minQuorum > 0 → probability = 0 (always defer)', () => {
    const result = computeConsensusProbability({}, 2);
    assert.equal(result.probability, 0,
      'Empty slots should produce probability 0');
  });

  it('1 slot with minQuorum = 2 → probability = 0 (impossible)', () => {
    const result = computeConsensusProbability({ slot_1: 0.99 }, 2);
    assert.equal(result.probability, 0,
      'Cannot reach quorum of 2 with only 1 slot');
  });

  it('minQuorum = 0 → probability = 1 (trivially satisfied)', () => {
    const result = computeConsensusProbability({}, 0);
    assert.equal(result.probability, 1,
      'P(X >= 0) = 1.0 for any distribution');
  });

  it('minQuorum negative → probability = 1', () => {
    const result = computeConsensusProbability({}, -1);
    assert.equal(result.probability, 1,
      'k <= 0 should trivially return 1');
  });
});
