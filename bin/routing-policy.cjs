#!/usr/bin/env node
'use strict';

/**
 * routing-policy.cjs — Pluggable policy interface for slot selection routing
 *
 * 3-tier progressive authority ladder:
 *   Tier 0: PresetPolicy  — static first-eligible-subprocess (bootstrap prior)
 *   Tier 1: RiverPolicy   — contextual bandit with confidence gating
 *   Tier 2: (future)      — full RL / learned routing
 *
 * PolicyResult shape (JSDoc contract):
 *   { recommendation: string|null, confidence: number, evidenceCount: number,
 *     recentStability: number, reason: string }
 *
 * Exports: PresetPolicy, RiverPolicy, RewardRecorder, selectSlotWithPolicy
 */

const fs   = require('fs');
const path = require('path');

// ─── PolicyResult factory ──────────────────────────────────────────────────
/**
 * @typedef {Object} PolicyResult
 * @property {string|null} recommendation - Provider slot name or null
 * @property {number}      confidence     - 0..1 confidence in recommendation
 * @property {number}      evidenceCount  - Number of reward samples backing this
 * @property {number}      recentStability - 1 - stddev of recent rewards (0..1)
 * @property {string}      reason         - Human-readable explanation
 */
function makePolicyResult({ recommendation = null, confidence = 0, evidenceCount = 0, recentStability = 1.0, reason = '' } = {}) {
  return { recommendation, confidence, evidenceCount, recentStability, reason };
}

// ─── PresetPolicy (Tier 0) ─────────────────────────────────────────────────
/**
 * Bootstrap prior — always available, never fails.
 * Implements identical logic to the original selectSlot: first subprocess
 * provider with has_file_access === true.
 */
class PresetPolicy {
  /**
   * @param {string} taskType - e.g., "implement", "fix", "refactor", "test"
   * @param {Array}  providers - array of provider objects from providers.json
   * @param {string|object} [routingHint] - optional hint: slot name string or { executor: string }
   * @returns {PolicyResult}
   */
  recommend(taskType, providers, routingHint) {
    if (!Array.isArray(providers)) {
      return makePolicyResult({ reason: 'preset:no-providers' });
    }

    // Routing hint preference: if a valid hint is provided and matches an eligible slot, prefer it
    if (routingHint) {
      const hintName = typeof routingHint === 'string'
        ? routingHint
        : (routingHint && typeof routingHint.executor === 'string' ? routingHint.executor : null);

      if (hintName) {
        const hintLower = hintName.toLowerCase();
        const hinted = providers.find(
          p => p.name.toLowerCase().includes(hintLower) && p.type === 'subprocess' && p.has_file_access === true
        );
        if (hinted) {
          return makePolicyResult({
            recommendation: hinted.name,
            confidence: 1.0,
            evidenceCount: 0,
            recentStability: 1.0,
            reason: 'preset:routing-hint-match',
          });
        }
      }
      // Invalid or ineligible hint — fall through to first-eligible
    }

    const candidate = providers.find(
      p => p.type === 'subprocess' && p.has_file_access === true
    );

    if (!candidate) {
      return makePolicyResult({ reason: 'preset:no-eligible-subprocess' });
    }

    return makePolicyResult({
      recommendation: candidate.name,
      confidence: 1.0,
      evidenceCount: 0,
      recentStability: 1.0,
      reason: 'preset:first-eligible-subprocess',
    });
  }
}

// ─── RewardRecorder ────────────────────────────────────────────────────────
/**
 * Append-only JSONL reward log for routing decisions.
 * Fail-open: never throws, logs to stderr on error.
 */
class RewardRecorder {
  /**
   * @param {object} [opts]
   * @param {string} [opts.rewardsPath] - Override path for JSONL file
   */
  constructor(opts = {}) {
    this._rewardsPath = opts.rewardsPath || path.join(process.cwd(), '.nf-routing-rewards.jsonl');
  }

  /**
   * Record a reward event.
   * @param {object} entry
   * @param {string} entry.taskType
   * @param {string} entry.slot
   * @param {number} entry.reward   - 0..1
   * @param {number} [entry.latencyMs]
   * @param {string} [entry.timestamp] - ISO string, defaults to now
   */
  record({ taskType, slot, reward, latencyMs, timestamp } = {}) {
    try {
      const line = JSON.stringify({
        taskType,
        slot,
        reward,
        latencyMs: latencyMs || 0,
        timestamp: timestamp || new Date().toISOString(),
      });
      fs.appendFileSync(this._rewardsPath, line + '\n', 'utf8');
    } catch (err) {
      process.stderr.write(`[routing-policy] reward write error: ${err.message}\n`);
    }
  }

  /**
   * Read rewards filtered by taskType.
   * @param {string} taskType
   * @returns {Array<object>}
   */
  readRewards(taskType) {
    try {
      const content = fs.readFileSync(this._rewardsPath, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      const entries = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.taskType === taskType) {
            entries.push(entry);
          }
        } catch (_) {
          // Skip malformed lines
        }
      }
      return entries;
    } catch (_) {
      return [];
    }
  }
}

// ─── RiverPolicy (Tier 1 — contextual bandit) ─────────────────────────────
/**
 * Contextual bandit with confidence gating, incumbent bias, and cooldown.
 * Runs in shadow mode by default — observes but does not override preset.
 */
class RiverPolicy {
  /**
   * @param {object} [opts]
   * @param {string} [opts.statePath]    - Path to state JSON file
   * @param {string} [opts.rewardsPath]  - Path to rewards JSONL file
   * @param {object} [opts.config]       - Bandit configuration overrides
   */
  constructor(opts = {}) {
    this._statePath = opts.statePath || path.join(process.cwd(), '.nf-river-state.json');
    this._rewardsPath = opts.rewardsPath || path.join(process.cwd(), '.nf-routing-rewards.jsonl');
    this._config = Object.assign({
      minSamples: 10,
      rewardMargin: 0.15,
      stabilityWindow: 5,
      cooldownMs: 300000,
      shadowMode: true,
    }, opts.config || {});
  }

  /**
   * @param {string} taskType
   * @param {Array}  providers
   * @returns {PolicyResult}
   */
  recommend(taskType, providers) {
    if (!Array.isArray(providers)) {
      return makePolicyResult({ reason: 'river:no-providers' });
    }

    const eligible = providers.filter(
      p => p.type === 'subprocess' && p.has_file_access === true
    );
    if (eligible.length === 0) {
      return makePolicyResult({ reason: 'river:no-eligible-providers' });
    }

    // Load rewards for this taskType
    const recorder = new RewardRecorder({ rewardsPath: this._rewardsPath });
    const rewards = recorder.readRewards(taskType);

    if (rewards.length === 0) {
      return makePolicyResult({ reason: 'river:no-reward-data' });
    }

    // Compute per-arm statistics
    const armStats = {};
    for (const provider of eligible) {
      const armRewards = rewards.filter(r => r.slot === provider.name);
      const count = armRewards.length;
      if (count === 0) {
        armStats[provider.name] = { mean: 0, count: 0, stability: 0 };
        continue;
      }

      const sum = armRewards.reduce((s, r) => s + (r.reward || 0), 0);
      const mean = sum / count;

      // Recent stability: 1 - stddev of last N rewards
      const window = this._config.stabilityWindow;
      const recentRewards = armRewards.slice(-window).map(r => r.reward || 0);
      let stability = 1.0;
      if (recentRewards.length >= 2) {
        const recentMean = recentRewards.reduce((s, v) => s + v, 0) / recentRewards.length;
        const variance = recentRewards.reduce((s, v) => s + (v - recentMean) ** 2, 0) / recentRewards.length;
        const stddev = Math.sqrt(variance);
        stability = Math.max(0, 1 - stddev);
      }

      armStats[provider.name] = { mean, count, stability };
    }

    // Find best and second-best arms
    const sorted = Object.entries(armStats)
      .filter(([, s]) => s.count > 0)
      .sort((a, b) => b[1].mean - a[1].mean);

    if (sorted.length === 0) {
      return makePolicyResult({ reason: 'river:no-arm-data' });
    }

    const [bestName, bestStats] = sorted[0];
    const secondBestMean = sorted.length > 1 ? sorted[1][1].mean : 0;

    // Confidence gate checks
    if (bestStats.count < this._config.minSamples) {
      return makePolicyResult({
        confidence: bestStats.mean,
        evidenceCount: bestStats.count,
        recentStability: bestStats.stability,
        reason: `river:insufficient-samples (${bestStats.count} < ${this._config.minSamples})`,
      });
    }

    const margin = bestStats.mean - secondBestMean;
    if (margin < this._config.rewardMargin) {
      return makePolicyResult({
        confidence: bestStats.mean,
        evidenceCount: bestStats.count,
        recentStability: bestStats.stability,
        reason: `river:margin-insufficient (${margin.toFixed(3)} < ${this._config.rewardMargin})`,
      });
    }

    if (bestStats.stability < 0.7) {
      return makePolicyResult({
        confidence: bestStats.mean,
        evidenceCount: bestStats.count,
        recentStability: bestStats.stability,
        reason: `river:stability-low (${bestStats.stability.toFixed(3)} < 0.7)`,
      });
    }

    // Incumbent bias: if preset winner is within margin, do not override
    const presetWinner = eligible[0] ? eligible[0].name : null;
    if (presetWinner && presetWinner !== bestName) {
      const presetStats = armStats[presetWinner];
      if (presetStats && presetStats.count > 0) {
        const incumbentMargin = bestStats.mean - presetStats.mean;
        if (incumbentMargin < this._config.rewardMargin) {
          return makePolicyResult({
            confidence: bestStats.mean,
            evidenceCount: bestStats.count,
            recentStability: bestStats.stability,
            reason: `incumbent-bias:margin-insufficient (${incumbentMargin.toFixed(3)} < ${this._config.rewardMargin})`,
          });
        }
      }
    }

    // Cooldown check
    const state = this._loadState();
    const lastPromotion = (state.promotions && state.promotions[taskType]) || 0;
    if (Date.now() - lastPromotion < this._config.cooldownMs) {
      return makePolicyResult({
        recommendation: bestName,
        confidence: bestStats.mean,
        evidenceCount: bestStats.count,
        recentStability: bestStats.stability,
        reason: 'river:in-cooldown',
      });
    }

    // Gate passes — record promotion and return recommendation
    if (!state.promotions) state.promotions = {};
    state.promotions[taskType] = Date.now();
    this._saveState(state);

    return makePolicyResult({
      recommendation: bestName,
      confidence: bestStats.mean,
      evidenceCount: bestStats.count,
      recentStability: bestStats.stability,
      reason: 'river:confidence-gate-passed',
    });
  }

  /** @private */
  _loadState() {
    try {
      const content = fs.readFileSync(this._statePath, 'utf8');
      return JSON.parse(content);
    } catch (_) {
      return {};
    }
  }

  /** @private */
  _saveState(state) {
    try {
      fs.writeFileSync(this._statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
    } catch (err) {
      process.stderr.write(`[routing-policy] state write error: ${err.message}\n`);
    }
  }
}

// ─── selectSlotWithPolicy ──────────────────────────────────────────────────
/**
 * Override chain: iterate policies from highest tier to lowest.
 * First policy whose recommendation is non-null and confidence gate passes wins.
 * Shadow mode: River recommends but preset result is returned.
 *
 * @param {string} taskType
 * @param {Array}  providers
 * @param {object} [opts]
 * @param {Array}  [opts.policies]   - Array of policy objects ordered by tier
 * @param {boolean} [opts.shadowMode] - Default true
 * @returns {{ slot: string|null, tier: number, policyResult: PolicyResult, shadow: PolicyResult|null }}
 */
function selectSlotWithPolicy(taskType, providers, opts = {}) {
  const shadowMode = opts.shadowMode !== undefined ? opts.shadowMode : true;
  const policies = opts.policies || [new PresetPolicy(), new RiverPolicy()];

  // Collect results from all policies
  const results = policies.map((p, i) => {
    try {
      // Pass routingHint to preset policy (index 0); other policies ignore it
      return i === 0 ? p.recommend(taskType, providers, opts.routingHint) : p.recommend(taskType, providers);
    } catch (_) {
      return makePolicyResult({ reason: 'policy:error' });
    }
  });

  // Preset is always tier 0 (index 0)
  const presetResult = results[0];

  // Check higher tiers (River = index 1, etc.) in reverse order (highest first)
  let shadow = null;
  for (let i = results.length - 1; i >= 1; i--) {
    const result = results[i];
    if (result.recommendation) {
      if (shadowMode) {
        // Log shadow recommendation to stderr
        process.stderr.write(
          `[routing-policy] shadow: river recommends ${result.recommendation} for ${taskType} (confidence: ${result.confidence.toFixed(3)})\n`
        );
        shadow = result;
        // Return preset result with shadow info
        return {
          slot: presetResult.recommendation,
          tier: 0,
          policyResult: presetResult,
          shadow,
        };
      }
      // Shadow mode off — promote higher tier
      return {
        slot: result.recommendation,
        tier: i,
        policyResult: result,
        shadow: null,
      };
    }
  }

  // Default: preset wins
  return {
    slot: presetResult.recommendation,
    tier: 0,
    policyResult: presetResult,
    shadow,
  };
}

// ─── Module exports ────────────────────────────────────────────────────────
module.exports = {
  PresetPolicy,
  RiverPolicy,
  RewardRecorder,
  selectSlotWithPolicy,
};
