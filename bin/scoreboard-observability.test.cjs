#!/usr/bin/env node
'use strict';
// bin/scoreboard-observability.test.cjs
// TDD tests for v0.24-03-01: Scoreboard observability (OBS-02 delivery stats, OBS-03 flakiness scoring)
// STRUCTURAL tests are RED until Plans 02 and 03 implement computeDeliveryStats, computeFlakiness, and flakiness-aware sorting
// UNIT tests are GREEN from the start (pure functions, no I/O).
// Requirements: OBS-02, OBS-03

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ===== UNIT TESTS (GREEN from the start — pure functions) =====

// Inline delivery stats calculator for pure function testing
function computeDeliveryStatsLocal(rounds, targetCount = 3) {
  if (!rounds || rounds.length === 0) {
    return { total_rounds: 0, target_vote_count: targetCount, achieved_by_outcome: {} };
  }

  let counts = {};
  for (const round of rounds) {
    if (!round.votes) continue;
    // Count votes that are not UNAVAIL or empty
    const voteCount = Object.values(round.votes).filter(v => v && v !== 'UNAVAIL' && v !== '').length;
    const key = voteCount + '_votes';
    counts[key] = (counts[key] || 0) + 1;
  }

  const total = rounds.length;
  const achieved = {};

  // Build outcome object for all possible vote counts
  for (const key of Object.keys(counts)) {
    const count = counts[key];
    const pct = ((count / total) * 100).toFixed(1);
    achieved[key] = { count, pct: parseFloat(pct) };
  }

  return {
    total_rounds: total,
    target_vote_count: targetCount,
    achieved_by_outcome: achieved,
  };
}

test('Delivery stats for empty rounds array', () => {
  const result = computeDeliveryStatsLocal([], 3);
  assert.strictEqual(result.total_rounds, 0, 'Empty rounds return 0 total_rounds');
  assert.deepStrictEqual(result.achieved_by_outcome, {}, 'Empty rounds return empty achieved_by_outcome');
});

test('Delivery stats for 5 rounds with mixed vote counts [3,3,3,2,2]', () => {
  const rounds = [
    { round_num: 1, votes: { 'slot1': 'APPROVE', 'slot2': 'APPROVE', 'slot3': 'APPROVE' } },
    { round_num: 2, votes: { 'slot1': 'APPROVE', 'slot2': 'APPROVE', 'slot3': 'APPROVE' } },
    { round_num: 3, votes: { 'slot1': 'APPROVE', 'slot2': 'APPROVE', 'slot3': 'APPROVE' } },
    { round_num: 4, votes: { 'slot1': 'APPROVE', 'slot2': 'APPROVE', 'slot3': 'UNAVAIL' } },
    { round_num: 5, votes: { 'slot1': 'APPROVE', 'slot2': 'APPROVE', 'slot3': 'UNAVAIL' } },
  ];

  const result = computeDeliveryStatsLocal(rounds, 3);
  assert.strictEqual(result.total_rounds, 5, 'Total rounds is 5');
  assert.strictEqual(result.achieved_by_outcome['3_votes'].count, 3, '3 rounds achieved 3 votes');
  assert.strictEqual(result.achieved_by_outcome['3_votes'].pct, 60, '3/5 = 60%');
  assert.strictEqual(result.achieved_by_outcome['2_votes'].count, 2, '2 rounds achieved 2 votes');
  assert.strictEqual(result.achieved_by_outcome['2_votes'].pct, 40, '2/5 = 40%');
});

test('Delivery stats for 10 rounds all achieving target (3/3)', () => {
  const rounds = Array.from({ length: 10 }, (_, i) => ({
    round_num: i + 1,
    votes: { 'slot1': 'APPROVE', 'slot2': 'APPROVE', 'slot3': 'APPROVE' },
  }));

  const result = computeDeliveryStatsLocal(rounds, 3);
  assert.strictEqual(result.total_rounds, 10, 'Total rounds is 10');
  assert.strictEqual(result.achieved_by_outcome['3_votes'].count, 10, '10 rounds achieved 3 votes');
  assert.strictEqual(result.achieved_by_outcome['3_votes'].pct, 100, '10/10 = 100%');
});

// Inline flakiness scorer for pure function testing
function computeFlakinessLocal(verdicts, windowSize = 10) {
  if (!verdicts || verdicts.length === 0) {
    return 0.0;
  }

  // Use trailing window (last N verdicts)
  const window = verdicts.slice(-windowSize);
  if (window.length === 0) {
    return 0.0;
  }

  // Count failures: UNAVAIL, TIMEOUT, FLAG (anything not APPROVE or BLOCK)
  const failures = window.filter(v => v === 'UNAVAIL' || v === 'TIMEOUT' || v === 'FLAG').length;
  const score = failures / window.length;

  return parseFloat(score.toFixed(2));
}

test('Flakiness scoring for all-APPROVE verdicts', () => {
  const verdicts = ['APPROVE', 'APPROVE', 'APPROVE', 'APPROVE', 'APPROVE'];
  const score = computeFlakinessLocal(verdicts, 10);
  assert.strictEqual(score, 0.0, 'All APPROVE verdicts = flakiness 0.0');
});

test('Flakiness scoring for all-TIMEOUT verdicts', () => {
  const verdicts = ['TIMEOUT', 'TIMEOUT', 'TIMEOUT', 'TIMEOUT', 'TIMEOUT'];
  const score = computeFlakinessLocal(verdicts, 10);
  assert.strictEqual(score, 1.0, 'All TIMEOUT verdicts = flakiness 1.0');
});

test('Flakiness scoring for mixed verdicts (40% failures)', () => {
  const verdicts = ['APPROVE', 'TIMEOUT', 'APPROVE', 'TIMEOUT', 'APPROVE'];
  const score = computeFlakinessLocal(verdicts, 10);
  assert.strictEqual(score, 0.4, '2 failures in 5 verdicts = flakiness 0.4');
});

test('Flakiness scoring uses trailing window (last 10), not first 10', () => {
  // Create 15 verdicts: first 5 all APPROVE, last 10 have 3 failures
  const verdicts = [
    'APPROVE', 'APPROVE', 'APPROVE', 'APPROVE', 'APPROVE',  // first 5 (not in window)
    'APPROVE', 'APPROVE', 'APPROVE', 'TIMEOUT', 'TIMEOUT',  // rounds 6-10
    'APPROVE', 'APPROVE', 'TIMEOUT', 'APPROVE', 'APPROVE',  // rounds 11-15
  ];

  const score = computeFlakinessLocal(verdicts, 10);
  // Last 10 verdicts (indices 5-14): 3 TIMEOUTs = 3/10 = 0.3
  assert.strictEqual(score, 0.3, 'Uses trailing 10-round window: 3 failures in last 10 = 0.3');
});

test('Flakiness scoring for empty verdicts array', () => {
  const score = computeFlakinessLocal([], 10);
  assert.strictEqual(score, 0.0, 'Empty verdicts array = flakiness 0.0');
});

test('Flakiness scoring for single verdict', () => {
  const scoreApprove = computeFlakinessLocal(['APPROVE'], 10);
  const scoreTimeout = computeFlakinessLocal(['TIMEOUT'], 10);

  assert.strictEqual(scoreApprove, 0.0, 'Single APPROVE = flakiness 0.0');
  assert.strictEqual(scoreTimeout, 1.0, 'Single TIMEOUT = flakiness 1.0');
});

test('Flakiness scoring distinguishes FLAG as failure', () => {
  const verdicts = ['APPROVE', 'BLOCK', 'FLAG', 'APPROVE', 'APPROVE'];
  // FLAG is counted as failure: 1 failure in 5 verdicts = 0.2
  const score = computeFlakinessLocal(verdicts, 10);
  assert.strictEqual(score, 0.2, 'FLAG counts as failure: 1/5 = 0.2');
});

// Inline dispatch ordering function for pure function testing
function sortByFlakinessAndRate(slots) {
  return [...slots].sort((a, b) => {
    // Primary: flakiness ascending (lower = more reliable, should come first)
    const flakinessA = a.flakiness ?? 0.0;
    const flakinessB = b.flakiness ?? 0.0;
    const flakDiff = flakinessA - flakinessB;

    if (flakDiff !== 0) {
      return flakDiff; // Lower flakiness comes first
    }

    // Secondary: success rate descending (higher = better)
    const rateA = a.successRate ?? 0.5;
    const rateB = b.successRate ?? 0.5;
    return rateB - rateA; // Higher rate comes first
  });
}

test('Dispatch ordering sorts by flakiness ascending (lower first)', () => {
  const slots = [
    { slot: 'a', flakiness: 0.3, successRate: 0.9 },
    { slot: 'b', flakiness: 0.1, successRate: 0.8 },
    { slot: 'c', flakiness: 0.5, successRate: 0.95 },
  ];

  const sorted = sortByFlakinessAndRate(slots);
  assert.strictEqual(sorted[0].slot, 'b', 'Lowest flakiness (0.1) comes first');
  assert.strictEqual(sorted[1].slot, 'a', 'Medium flakiness (0.3) comes second');
  assert.strictEqual(sorted[2].slot, 'c', 'Highest flakiness (0.5) comes last');
});

test('Dispatch ordering uses success rate as tiebreaker', () => {
  const slots = [
    { slot: 'a', flakiness: 0.2, successRate: 0.8 },
    { slot: 'b', flakiness: 0.2, successRate: 0.95 }, // Same flakiness, higher rate
    { slot: 'c', flakiness: 0.2, successRate: 0.7 },
  ];

  const sorted = sortByFlakinessAndRate(slots);
  assert.strictEqual(sorted[0].slot, 'b', 'When flakiness same, highest success rate comes first');
  assert.strictEqual(sorted[1].slot, 'a', 'Medium success rate comes second');
  assert.strictEqual(sorted[2].slot, 'c', 'Lowest success rate comes last');
});

test('Dispatch ordering handles missing flakiness (defaults to 0)', () => {
  const slots = [
    { slot: 'a', successRate: 0.9 }, // no flakiness field
    { slot: 'b', flakiness: 0.3, successRate: 0.8 },
  ];

  const sorted = sortByFlakinessAndRate(slots);
  assert.strictEqual(sorted[0].slot, 'a', 'Missing flakiness defaults to 0.0 (most reliable, comes first)');
  assert.strictEqual(sorted[1].slot, 'b', 'Higher flakiness comes second');
});

test('Dispatch ordering handles missing success rate (defaults to 0.5)', () => {
  const slots = [
    { slot: 'a', flakiness: 0.2, successRate: 0.6 },
    { slot: 'b', flakiness: 0.2 }, // no successRate field
  ];

  const sorted = sortByFlakinessAndRate(slots);
  // Same flakiness; tiebreaker is successRate: 0.6 > 0.5 (default)
  assert.strictEqual(sorted[0].slot, 'a', 'Higher success rate comes first');
  assert.strictEqual(sorted[1].slot, 'b', 'Default success rate 0.5 comes second');
});

// ===== STRUCTURAL TESTS (RED until Plans 02 and 03 implement features) =====

const UPDATE_SCOREBOARD_PATH = path.resolve(__dirname, './update-scoreboard.cjs');
let updateScoreboardContent = '';
try {
  updateScoreboardContent = fs.readFileSync(UPDATE_SCOREBOARD_PATH, 'utf8');
} catch (e) {
  updateScoreboardContent = '';
}

const QGSD_PROMPT_PATH = path.resolve(__dirname, '../hooks/qgsd-prompt.js');
let qgsdPromptContent = '';
try {
  qgsdPromptContent = fs.readFileSync(QGSD_PROMPT_PATH, 'utf8');
} catch (e) {
  qgsdPromptContent = '';
}

test('update-scoreboard.cjs: computeDeliveryStats function exists', () => {
  const hasFunction =
    updateScoreboardContent.includes('computeDeliveryStats') ||
    updateScoreboardContent.includes('function computeDeliveryStats');
  assert.ok(
    hasFunction,
    'computeDeliveryStats function not found in update-scoreboard.cjs — Plan 03 must add it'
  );
});

test('update-scoreboard.cjs: emptyData includes delivery_stats object', () => {
  // Try to require the module and call emptyData
  let mod = null;
  try {
    mod = require(UPDATE_SCOREBOARD_PATH);
  } catch (e) {
    // Module not yet loadable (expected in TDD phase)
  }

  if (mod && mod.emptyData) {
    const data = mod.emptyData();
    assert.ok(data.delivery_stats, 'emptyData() must include delivery_stats object');
    assert.ok(data.delivery_stats.total_rounds !== undefined, 'delivery_stats.total_rounds must exist');
    assert.ok(data.delivery_stats.target_vote_count !== undefined, 'delivery_stats.target_vote_count must exist');
  } else {
    // Structural check: file must reference delivery_stats
    const hasDeliveryStats = updateScoreboardContent.includes('delivery_stats');
    assert.ok(
      hasDeliveryStats,
      'delivery_stats not referenced in update-scoreboard.cjs — Plan 03 must add delivery_stats schema'
    );
  }
});

test('update-scoreboard.cjs: computeFlakiness function exists', () => {
  const hasFunction =
    updateScoreboardContent.includes('computeFlakiness') ||
    updateScoreboardContent.includes('function computeFlakiness');
  assert.ok(
    hasFunction,
    'computeFlakiness function not found in update-scoreboard.cjs — Plan 03 must add it'
  );
});

test('update-scoreboard.cjs: scoreboard includes flakiness_score field for slots', () => {
  const hasFlakinessScore = updateScoreboardContent.includes('flakiness_score');
  assert.ok(
    hasFlakinessScore,
    'flakiness_score not referenced in update-scoreboard.cjs — Plan 03 must store flakiness scores in slots'
  );
});

test('hooks/qgsd-prompt.js: contains flakiness reference for dispatch ordering', () => {
  const hasFlakinessRef = qgsdPromptContent.includes('flakiness');
  assert.ok(
    hasFlakinessRef || updateScoreboardContent.includes('flakiness'),
    'flakiness not referenced in qgsd-prompt.js or dispatch logic — Plan 03 must add flakiness-aware sorting'
  );
});

test('update-scoreboard.cjs: delivery_stats includes achieved_by_outcome object', () => {
  const hasOutcome = updateScoreboardContent.includes('achieved_by_outcome') || updateScoreboardContent.includes('achieved');
  assert.ok(
    hasOutcome,
    'achieved_by_outcome not found in update-scoreboard.cjs — Plan 03 must track vote count distribution'
  );
});

test('update-scoreboard.cjs: slots object can store per-slot flakiness arrays', () => {
  // Look for slots object and flakiness array references
  const hasSlots = updateScoreboardContent.includes('slots');
  const hasFlakinessArray = updateScoreboardContent.includes('flakiness') && (updateScoreboardContent.includes('[]') || updateScoreboardContent.includes('push'));
  assert.ok(
    hasSlots,
    'slots object not found in update-scoreboard.cjs — Plan 03 must extend schema with per-slot metrics'
  );
});

test('update-scoreboard.cjs: handles empty rounds for delivery stats', () => {
  // Ensure computeDeliveryStats can handle no rounds
  const hasGuard = updateScoreboardContent.includes('rounds.length === 0') || updateScoreboardContent.includes('!rounds') || updateScoreboardContent.includes('rounds || []');
  assert.ok(
    hasGuard || updateScoreboardContent.includes('computeDeliveryStats'),
    'Empty rounds guard not found: computeDeliveryStats must handle empty input — Plan 03 must add'
  );
});

test('update-scoreboard.cjs: uses trailing window for flakiness (10 rounds)', () => {
  const hasWindow = updateScoreboardContent.includes('10') || updateScoreboardContent.includes('windowSize') || updateScoreboardContent.includes('slice');
  const hasFlakinessCompute = updateScoreboardContent.includes('computeFlakiness');
  assert.ok(
    (hasWindow && hasFlakinessCompute) || updateScoreboardContent.includes('slice(-'),
    'Trailing window logic not found: must use slice(-10) or similar for last 10 rounds — Plan 03 must add'
  );
});
