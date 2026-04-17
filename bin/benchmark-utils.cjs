#!/usr/bin/env node
'use strict';
// bin/benchmark-utils.cjs
// Shared benchmark utilities extracted from nf-benchmark-solve.cjs.
// Imported by both nf-benchmark-solve.cjs and nf-benchmark.cjs.

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Formal snapshot directory (resolved relative to cwd at call time)
// ─────────────────────────────────────────────────────────────────────────────

const FORMAL_DIR = path.join(process.cwd(), '.planning', 'formal');

// ─────────────────────────────────────────────────────────────────────────────
// Residual extraction helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractResidual(parsed) {
  if (!parsed || typeof parsed !== 'object') return -1;
  // nf-solve --json output: { iterations: [{residuals: {r_to_f: N, ...}}], ...}
  if (Array.isArray(parsed.iterations) && parsed.iterations.length > 0) {
    const last = parsed.iterations[parsed.iterations.length - 1];
    if (last && last.residuals && typeof last.residuals === 'object') {
      return Object.values(last.residuals).reduce(function (s, v) {
        return s + (typeof v === 'number' && v >= 0 ? v : 0);
      }, 0);
    }
  }
  if (typeof parsed.total_residual === 'number') return parsed.total_residual;
  return -1;
}

// Per-layer residual extraction helper
// nf-solve --json outputs: { residual_vector: { f_to_t: { residual: N, detail: {...} }, total: N, ... } }
function extractLayerResidual(parsed, layer) {
  if (!parsed || typeof parsed !== 'object') return -1;
  // Primary format: residual_vector (nf-solve --json output)
  const rv = parsed.residual_vector;
  if (rv && typeof rv === 'object' && rv[layer] !== undefined) {
    const v = rv[layer];
    if (typeof v === 'object' && v !== null) return typeof v.residual === 'number' ? v.residual : -1;
    if (typeof v === 'number') return v;
  }
  // Legacy format: iterations array
  if (Array.isArray(parsed.iterations) && parsed.iterations.length > 0) {
    const last = parsed.iterations[parsed.iterations.length - 1];
    if (last && last.residuals && typeof last.residuals[layer] === 'object') {
      const v = last.residuals[layer];
      return typeof v.residual === 'number' ? v.residual : -1;
    }
    if (last && last.residuals && typeof last.residuals[layer] === 'number') {
      return last.residuals[layer];
    }
  }
  return -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pass condition evaluator
// ─────────────────────────────────────────────────────────────────────────────

function evaluatePassCondition(fixture, spawnResult, parsed, residual) {
  const cond = fixture.pass_condition;

  if (cond === 'exits_zero') {
    return spawnResult.status === 0;
  }
  if (cond === 'converged') {
    return parsed.converged === true;
  }
  if (typeof cond === 'string' && cond.startsWith('residual_lte:')) {
    const limit = parseFloat(cond.slice('residual_lte:'.length));
    return residual <= limit;
  }
  if (typeof cond === 'string' && cond.startsWith('residual_gte:')) {
    const floor = parseFloat(cond.slice('residual_gte:'.length));
    return residual >= floor;
  }
  // Unknown condition — fail-open: treat as passing if exits_zero
  return spawnResult.status === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Track B: snapshot/restore helpers
// ─────────────────────────────────────────────────────────────────────────────

function snapshotFormalJson() {
  // Capture all .json files in .planning/formal/ (non-recursive — top-level only)
  const snap = {};
  try {
    const entries = fs.readdirSync(FORMAL_DIR);
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const fullPath = path.join(FORMAL_DIR, entry);
      try {
        snap[fullPath] = fs.readFileSync(fullPath, 'utf8');
      } catch (_) { /* skip unreadable files fail-open */ }
    }
  } catch (_) { /* fail-open: if formal dir unreadable, return empty snap */ }
  return snap;
}

function restoreFormalJson(snap) {
  // Restore every file captured in the snapshot to its original content.
  // Called unconditionally (even after errors) to guarantee clean state.
  for (const fullPath of Object.keys(snap)) {
    try {
      fs.writeFileSync(fullPath, snap[fullPath], 'utf8');
    } catch (_) { /* fail-open: log to stderr, don't throw */
      process.stderr.write('WARN: could not restore ' + fullPath + '\n');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Track B: nested field mutation helper
// ─────────────────────────────────────────────────────────────────────────────

function setNestedField(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === undefined) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  evaluatePassCondition,
  extractResidual,
  extractLayerResidual,
  snapshotFormalJson,
  restoreFormalJson,
  setNestedField
};
