'use strict';

/**
 * solve-cycle-detector.cjs — Detects A-B-A-B oscillation patterns in per-layer
 * residual history across solve iterations.
 *
 * Requirements: CONV-01
 */

const { LAYER_KEYS } = require('./layer-constants.cjs');

/**
 * Detect oscillating layers from a history object.
 * A layer oscillates when values[i] === values[i-2] for at least 2 consecutive
 * pairs starting from index 2 (spanning 4+ points: A-B-A-B).
 *
 * @param {Object<string, number[]>} history - layer name -> residual values per iteration
 * @returns {string[]} layer keys exhibiting A-B-A-B oscillation
 */
function detectCycles(history) {
  if (!history || typeof history !== 'object') return [];

  const oscillating = [];

  for (const [layer, values] of Object.entries(history)) {
    if (!Array.isArray(values) || values.length < 4) continue;

    // Check for A-B-A-B pattern: values[2]===values[0] AND values[3]===values[1]
    // spanning any consecutive 4-point window
    let found = false;
    for (let i = 2; i < values.length - 1; i++) {
      if (values[i] === values[i - 2] && values[i + 1] === values[i - 1]) {
        found = true;
        break;
      }
    }

    if (found) {
      oscillating.push(layer);
    }
  }

  return oscillating;
}

/**
 * Stateful cycle detector that accumulates per-layer residual history
 * across iterations and detects A-B-A-B oscillation patterns.
 */
class CycleDetector {
  constructor() {
    /** @type {Object<string, number[]>} */
    this.history = {};
  }

  /**
   * Record per-layer residuals for an iteration.
   *
   * @param {number} iteration - iteration number (informational)
   * @param {Object<string, number>} perLayerResiduals - e.g. { r_to_f: 3, f_to_t: 0, ... }
   */
  record(iteration, perLayerResiduals) {
    if (!perLayerResiduals || typeof perLayerResiduals !== 'object') return;

    for (const [layer, value] of Object.entries(perLayerResiduals)) {
      if (typeof value !== 'number') continue;
      if (!this.history[layer]) {
        this.history[layer] = [];
      }
      this.history[layer].push(value);
    }
  }

  /**
   * Detect layers exhibiting A-B-A-B oscillation patterns.
   *
   * @returns {string[]} layer keys that are oscillating
   */
  detectOscillating() {
    return detectCycles(this.history);
  }

  /**
   * Return the full history object for debugging/reporting.
   *
   * @returns {Object<string, number[]>}
   */
  getHistory() {
    return this.history;
  }
}

module.exports = { CycleDetector, detectCycles };
