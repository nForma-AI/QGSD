'use strict';

/**
 * Baseline drift detection for solve report (CONV-04).
 *
 * Compares a session-start residual baseline with a current snapshot taken at
 * report time. Flags layers where residual changed by more than a configurable
 * threshold (default 10%), indicating mid-session external edits that would
 * make the before/after delta misleading.
 */

const fs = require('fs');
const { LAYER_KEYS } = require('./layer-constants.cjs');

/**
 * Detect baseline drift between session-start and current residual snapshots.
 *
 * @param {Object} sessionStartBaseline - Per-layer residual values from session start
 * @param {Object} currentSnapshot - Same structure, taken at report time
 * @param {Object} [options] - Configuration options
 * @param {number} [options.threshold=0.10] - Drift threshold as fraction (10% = 0.10)
 * @param {string} [options.requirementsPath] - Path to requirements.json for req count comparison
 * @param {Object} [options.modelStaleness] - Output from check-model-staleness.cjs checkStaleness()
 * @returns {{ detected: boolean, layers: Array, requirement_count_changed: boolean, model_staleness_detected: boolean, warning: string|null }}
 */
function detectBaselineDrift(sessionStartBaseline, currentSnapshot, options) {
  const threshold = (options && options.threshold != null) ? options.threshold : 0.10;
  const requirementsPath = options && options.requirementsPath;

  const driftedLayers = [];

  for (const layer of LAYER_KEYS) {
    const baselineResidual = (sessionStartBaseline && sessionStartBaseline[layer] && sessionStartBaseline[layer].residual != null)
      ? sessionStartBaseline[layer].residual
      : -1;
    const currentResidual = (currentSnapshot && currentSnapshot[layer] && currentSnapshot[layer].residual != null)
      ? currentSnapshot[layer].residual
      : -1;

    // Skip missing/skipped layers
    if (baselineResidual === -1 || currentResidual === -1) continue;

    if (baselineResidual === 0) {
      // Can't compute % change from 0 -- use absolute change > 2 instead
      if (Math.abs(currentResidual - baselineResidual) > 2) {
        driftedLayers.push({
          layer: layer,
          baseline: baselineResidual,
          current: currentResidual,
          pct_change: null, // Not meaningful when baseline is 0
        });
      }
    } else {
      const pctChange = Math.abs(currentResidual - baselineResidual) / baselineResidual;
      if (pctChange > threshold) {
        driftedLayers.push({
          layer: layer,
          baseline: baselineResidual,
          current: currentResidual,
          pct_change: Math.round(pctChange * 10000) / 100, // e.g., 0.20 -> 20.00
        });
      }
    }
  }

  // Requirement count change detection
  let requirementCountChanged = false;
  if (requirementsPath && sessionStartBaseline && sessionStartBaseline.requirement_count != null) {
    try {
      const reqData = JSON.parse(fs.readFileSync(requirementsPath, 'utf8'));
      const currentCount = Array.isArray(reqData.requirements)
        ? reqData.requirements.length
        : (reqData.count || 0);
      if (currentCount !== sessionStartBaseline.requirement_count) {
        requirementCountChanged = true;
      }
    } catch (_) {
      // fail-open: can't read requirements, skip count comparison
    }
  }

  // Model staleness as a drift signal (CONV-04 extension)
  const modelStaleness = options && options.modelStaleness;
  const modelStalenessDetected = modelStaleness && modelStaleness.total_stale > 0;

  const detected = driftedLayers.length > 0 || requirementCountChanged || !!modelStalenessDetected;

  let warning = null;
  if (driftedLayers.length > 0) {
    const layerDescs = driftedLayers.map(l => {
      const pctStr = l.pct_change != null ? l.pct_change + '%' : 'abs>' + 2;
      return l.layer + ' (' + pctStr + ')';
    });
    warning = 'Baseline drift detected in ' + driftedLayers.length + ' layer(s): ' +
      layerDescs.join(', ') +
      '. Mid-session external edits may have affected the before/after comparison.';
  }
  if (requirementCountChanged && !warning) {
    warning = 'Requirement count changed during session. Mid-session scope changes may affect before/after comparison.';
  } else if (requirementCountChanged && warning) {
    warning += ' Additionally, requirement count changed during session.';
  }
  if (modelStalenessDetected) {
    const staleCount = modelStaleness.total_stale;
    const reqIds = (modelStaleness.stale || [])
      .flatMap(s => s.requirements || [])
      .filter((v, i, a) => a.indexOf(v) === i);
    const reqSuffix = reqIds.length > 0 ? ' affecting ' + reqIds.join(', ') : '';
    const msg = staleCount + ' formal model(s) stale' + reqSuffix +
      ' — verification results may not reflect current code.';
    warning = warning ? warning + ' Additionally, ' + msg : 'Model staleness: ' + msg;
  }

  return {
    detected: detected,
    layers: driftedLayers,
    requirement_count_changed: requirementCountChanged,
    model_staleness_detected: !!modelStalenessDetected,
    warning: warning,
  };
}

module.exports = { detectBaselineDrift };
