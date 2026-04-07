#!/usr/bin/env node
'use strict';
// bin/routing-policy.test.cjs
// Tests for routing-policy.cjs — Tier 0/1 policy interface, reward recorder, bandit
// Pattern: routing-policy\.cjs|PresetPolicy|RiverPolicy|RewardRecorder|selectSlotWithPolicy

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// ── Load module ─────────────────────────────────────────────────────────────
let mod;
try {
  mod = require(path.resolve(__dirname, './routing-policy.cjs'));
} catch (e) {
  mod = null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function tmpPath(name) {
  return path.join(os.tmpdir(), `nf-test-${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`);
}

function cleanUp(...paths) {
  for (const p of paths) {
    try { fs.unlinkSync(p); } catch (_) { /* ignore */ }
  }
}

const PROVIDERS = [
  { name: 'claude-1', type: 'http', has_file_access: false },
  { name: 'codex-1', type: 'subprocess', has_file_access: true },
  { name: 'gemini-1', type: 'subprocess', has_file_access: true },
];

const NO_MATCH_PROVIDERS = [
  { name: 'claude-1', type: 'http', has_file_access: false },
  { name: 'claude-2', type: 'http', has_file_access: false },
];

// ── STRUCTURAL TESTS ────────────────────────────────────────────────────────

test('module exists: bin/routing-policy.cjs can be required without error', () => {
  assert.ok(mod, 'bin/routing-policy.cjs not found');
});

test('exports: PresetPolicy is exported as a function', () => {
  assert.ok(mod);
  assert.strictEqual(typeof mod.PresetPolicy, 'function');
});

test('exports: RiverPolicy is exported as a function', () => {
  assert.ok(mod);
  assert.strictEqual(typeof mod.RiverPolicy, 'function');
});

test('exports: RewardRecorder is exported as a function', () => {
  assert.ok(mod);
  assert.strictEqual(typeof mod.RewardRecorder, 'function');
});

test('exports: selectSlotWithPolicy is exported as a function', () => {
  assert.ok(mod);
  assert.strictEqual(typeof mod.selectSlotWithPolicy, 'function');
});

// ── PresetPolicy TESTS ──────────────────────────────────────────────────────

test('PresetPolicy.recommend returns first subprocess+file_access provider', () => {
  assert.ok(mod);
  const policy = new mod.PresetPolicy();
  const result = policy.recommend('implement', PROVIDERS);

  assert.strictEqual(result.recommendation, 'codex-1');
  assert.strictEqual(result.confidence, 1.0);
  assert.strictEqual(result.evidenceCount, 0);
  assert.strictEqual(result.recentStability, 1.0);
  assert.strictEqual(result.reason, 'preset:first-eligible-subprocess');
});

test('PresetPolicy.recommend returns null recommendation for no-match providers', () => {
  assert.ok(mod);
  const policy = new mod.PresetPolicy();
  const result = policy.recommend('implement', NO_MATCH_PROVIDERS);

  assert.strictEqual(result.recommendation, null);
  assert.strictEqual(result.reason, 'preset:no-eligible-subprocess');
});

test('PresetPolicy.recommend returns null recommendation for empty providers', () => {
  assert.ok(mod);
  const policy = new mod.PresetPolicy();
  const result = policy.recommend('fix', []);

  assert.strictEqual(result.recommendation, null);
});

test('PresetPolicy.recommend returns null recommendation for non-array input', () => {
  assert.ok(mod);
  const policy = new mod.PresetPolicy();
  const result = policy.recommend('fix', null);

  assert.strictEqual(result.recommendation, null);
  assert.strictEqual(result.reason, 'preset:no-providers');
});

// ── RewardRecorder TESTS ────────────────────────────────────────────────────

test('RewardRecorder.record writes valid JSONL line', () => {
  assert.ok(mod);
  const rewardsPath = tmpPath('rewards.jsonl');
  try {
    const recorder = new mod.RewardRecorder({ rewardsPath });
    recorder.record({ taskType: 'implement', slot: 'codex-1', reward: 0.85, latencyMs: 1200 });

    const content = fs.readFileSync(rewardsPath, 'utf8').trim();
    const entry = JSON.parse(content);
    assert.strictEqual(entry.taskType, 'implement');
    assert.strictEqual(entry.slot, 'codex-1');
    assert.strictEqual(entry.reward, 0.85);
    assert.strictEqual(entry.latencyMs, 1200);
    assert.ok(entry.timestamp, 'should have timestamp');
  } finally {
    cleanUp(rewardsPath);
  }
});

test('RewardRecorder.readRewards filters by taskType', () => {
  assert.ok(mod);
  const rewardsPath = tmpPath('rewards-filter.jsonl');
  try {
    const recorder = new mod.RewardRecorder({ rewardsPath });
    recorder.record({ taskType: 'implement', slot: 'codex-1', reward: 0.9 });
    recorder.record({ taskType: 'fix', slot: 'gemini-1', reward: 0.7 });
    recorder.record({ taskType: 'implement', slot: 'codex-1', reward: 0.8 });

    const implRewards = recorder.readRewards('implement');
    assert.strictEqual(implRewards.length, 2);
    assert.ok(implRewards.every(r => r.taskType === 'implement'));

    const fixRewards = recorder.readRewards('fix');
    assert.strictEqual(fixRewards.length, 1);
    assert.strictEqual(fixRewards[0].slot, 'gemini-1');
  } finally {
    cleanUp(rewardsPath);
  }
});

test('RewardRecorder handles missing file gracefully (returns [])', () => {
  assert.ok(mod);
  const rewardsPath = tmpPath('nonexistent.jsonl');
  const recorder = new mod.RewardRecorder({ rewardsPath });
  const rewards = recorder.readRewards('implement');

  assert.deepStrictEqual(rewards, []);
});

// ── RiverPolicy TESTS ───────────────────────────────────────────────────────

test('RiverPolicy.recommend returns null when insufficient samples', () => {
  assert.ok(mod);
  const rewardsPath = tmpPath('river-insufficient.jsonl');
  const statePath = tmpPath('river-insufficient-state.json');
  try {
    // Write only 3 rewards (below minSamples of 10)
    const recorder = new mod.RewardRecorder({ rewardsPath });
    for (let i = 0; i < 3; i++) {
      recorder.record({ taskType: 'implement', slot: 'codex-1', reward: 0.9 });
    }

    const policy = new mod.RiverPolicy({ rewardsPath, statePath, config: { minSamples: 10 } });
    const result = policy.recommend('implement', PROVIDERS);

    assert.strictEqual(result.recommendation, null);
    assert.ok(result.reason.includes('insufficient-samples'), `reason: ${result.reason}`);
  } finally {
    cleanUp(rewardsPath, statePath);
  }
});

test('RiverPolicy.recommend returns best arm when confidence gate passes', () => {
  assert.ok(mod);
  const rewardsPath = tmpPath('river-passes.jsonl');
  const statePath = tmpPath('river-passes-state.json');
  try {
    const recorder = new mod.RewardRecorder({ rewardsPath });

    // Write 12 high rewards for gemini-1 and 12 low for codex-1
    for (let i = 0; i < 12; i++) {
      recorder.record({ taskType: 'implement', slot: 'gemini-1', reward: 0.95 });
      recorder.record({ taskType: 'implement', slot: 'codex-1', reward: 0.5 });
    }

    const policy = new mod.RiverPolicy({
      rewardsPath,
      statePath,
      config: { minSamples: 10, rewardMargin: 0.15, stabilityWindow: 5, cooldownMs: 0 },
    });
    const result = policy.recommend('implement', PROVIDERS);

    assert.strictEqual(result.recommendation, 'gemini-1');
    assert.ok(result.confidence > 0, 'should have positive confidence');
    assert.strictEqual(result.reason, 'river:confidence-gate-passed');
  } finally {
    cleanUp(rewardsPath, statePath);
  }
});

test('RiverPolicy incumbent bias: does not override when margin insufficient', () => {
  assert.ok(mod);
  const rewardsPath = tmpPath('river-incumbent.jsonl');
  const statePath = tmpPath('river-incumbent-state.json');
  try {
    const recorder = new mod.RewardRecorder({ rewardsPath });

    // gemini-1 slightly better than codex-1 but within margin
    for (let i = 0; i < 12; i++) {
      recorder.record({ taskType: 'implement', slot: 'gemini-1', reward: 0.82 });
      recorder.record({ taskType: 'implement', slot: 'codex-1', reward: 0.78 });
    }

    const policy = new mod.RiverPolicy({
      rewardsPath,
      statePath,
      config: { minSamples: 10, rewardMargin: 0.15, stabilityWindow: 5, cooldownMs: 0 },
    });
    const result = policy.recommend('implement', PROVIDERS);

    // codex-1 is the preset winner (first eligible), gemini-1 margin is only 0.04 < 0.15
    assert.strictEqual(result.recommendation, null);
    assert.ok(result.reason.includes('incumbent-bias') || result.reason.includes('margin-insufficient'),
      `expected incumbent bias, got: ${result.reason}`);
  } finally {
    cleanUp(rewardsPath, statePath);
  }
});

// ── selectSlotWithPolicy TESTS ──────────────────────────────────────────────

test('selectSlotWithPolicy returns preset result by default (no reward data)', () => {
  assert.ok(mod);
  const rewardsPath = tmpPath('swp-default.jsonl');
  const statePath = tmpPath('swp-default-state.json');
  try {
    const result = mod.selectSlotWithPolicy('implement', PROVIDERS, {
      policies: [
        new mod.PresetPolicy(),
        new mod.RiverPolicy({ rewardsPath, statePath }),
      ],
    });

    assert.strictEqual(result.slot, 'codex-1');
    assert.strictEqual(result.tier, 0);
    assert.strictEqual(result.policyResult.reason, 'preset:first-eligible-subprocess');
    assert.strictEqual(result.shadow, null);
  } finally {
    cleanUp(rewardsPath, statePath);
  }
});

test('selectSlotWithPolicy shadow mode logs but does not override', () => {
  assert.ok(mod);
  const rewardsPath = tmpPath('swp-shadow.jsonl');
  const statePath = tmpPath('swp-shadow-state.json');
  try {
    const recorder = new mod.RewardRecorder({ rewardsPath });
    for (let i = 0; i < 12; i++) {
      recorder.record({ taskType: 'implement', slot: 'gemini-1', reward: 0.95 });
      recorder.record({ taskType: 'implement', slot: 'codex-1', reward: 0.5 });
    }

    const result = mod.selectSlotWithPolicy('implement', PROVIDERS, {
      shadowMode: true,
      policies: [
        new mod.PresetPolicy(),
        new mod.RiverPolicy({
          rewardsPath,
          statePath,
          config: { minSamples: 10, rewardMargin: 0.15, stabilityWindow: 5, cooldownMs: 0 },
        }),
      ],
    });

    // Preset wins in shadow mode
    assert.strictEqual(result.slot, 'codex-1');
    assert.strictEqual(result.tier, 0);
    // Shadow should contain the River recommendation
    assert.ok(result.shadow, 'shadow result should exist');
    assert.strictEqual(result.shadow.recommendation, 'gemini-1');
  } finally {
    cleanUp(rewardsPath, statePath);
  }
});

test('selectSlotWithPolicy with shadowMode:false promotes River when gate passes', () => {
  assert.ok(mod);
  const rewardsPath = tmpPath('swp-promote.jsonl');
  const statePath = tmpPath('swp-promote-state.json');
  try {
    const recorder = new mod.RewardRecorder({ rewardsPath });
    for (let i = 0; i < 12; i++) {
      recorder.record({ taskType: 'implement', slot: 'gemini-1', reward: 0.95 });
      recorder.record({ taskType: 'implement', slot: 'codex-1', reward: 0.5 });
    }

    const result = mod.selectSlotWithPolicy('implement', PROVIDERS, {
      shadowMode: false,
      policies: [
        new mod.PresetPolicy(),
        new mod.RiverPolicy({
          rewardsPath,
          statePath,
          config: { minSamples: 10, rewardMargin: 0.15, stabilityWindow: 5, cooldownMs: 0 },
        }),
      ],
    });

    // River promoted
    assert.strictEqual(result.slot, 'gemini-1');
    assert.strictEqual(result.tier, 1);
    assert.strictEqual(result.shadow, null);
  } finally {
    cleanUp(rewardsPath, statePath);
  }
});
