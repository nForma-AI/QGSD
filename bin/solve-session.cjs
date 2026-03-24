#!/usr/bin/env node
'use strict';
// bin/solve-session.cjs
// Persistence for solve sessions — write/read solve-session.json
// Enables --plan-only / --execute two-phase solve and crash recovery.
//
// Requirements: QUICK-345

const fs = require('fs');
const path = require('path');

const SESSION_FILE = '.planning/formal/solve-session.json';

/**
 * Write a solve session to disk.
 * @param {string} root - project root
 * @param {Object} session - session data
 */
function writeSession(root, session) {
  const filePath = path.join(root, SESSION_FILE);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data = {
    ...session,
    updated_at: new Date().toISOString(),
  };
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, filePath);
  return filePath;
}

/**
 * Read a solve session from disk.
 * @param {string} root - project root
 * @returns {Object|null} session data or null if not found/invalid
 */
function readSession(root) {
  const filePath = path.join(root, SESSION_FILE);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * Clear the solve session file.
 * @param {string} root - project root
 */
function clearSession(root) {
  const filePath = path.join(root, SESSION_FILE);
  try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
}

/**
 * Compute a remediation plan summary from a baseline residual vector.
 * @param {Object} residual - baseline residual from nf-solve.cjs
 * @param {number} maxIterations - max convergence iterations
 * @returns {Object} plan summary
 */
function computePlanSummary(residual, maxIterations) {
  const layers = [];
  const layerMap = {
    r_to_f: 'R→F (Req→Formal)',
    f_to_t: 'F→T (Formal→Test)',
    c_to_f: 'C→F (Code→Formal)',
    t_to_c: 'T→C (Test→Code)',
    f_to_c: 'F→C (Formal→Code)',
    r_to_d: 'R→D (Req→Docs)',
    d_to_c: 'D→C (Docs→Code)',
    l1_to_l3: 'L1→L3 (Gate A)',
    l3_to_tc: 'L3→TC (Gate C)',
  };

  for (const [key, label] of Object.entries(layerMap)) {
    const r = residual[key]?.residual ?? -1;
    if (r > 0) layers.push({ key, label, residual: r });
  }

  // Estimate iterations based on cascade patterns
  const hasRtoF = (residual.r_to_f?.residual || 0) > 0;
  const hasFtoT = (residual.f_to_t?.residual || 0) > 0;
  const hasTtoC = (residual.t_to_c?.residual || 0) > 0;

  let estimatedIterations = 1;
  if (hasRtoF && !hasFtoT) estimatedIterations = 2; // R→F will cascade to F→T
  if (hasRtoF && hasFtoT) estimatedIterations = 2;
  if (hasRtoF && hasFtoT && hasTtoC) estimatedIterations = 3;

  // Cascade forecast
  const cascades = [];
  if (hasRtoF) {
    const rCount = residual.r_to_f.residual;
    cascades.push(`${rCount} R→F → ~${Math.ceil(rCount * 0.3)} F→T (estimated 30% cascade)`);
  }

  return {
    total_residual: residual.total || 0,
    active_layers: layers,
    estimated_iterations: Math.min(estimatedIterations, maxIterations),
    max_iterations: maxIterations,
    cascade_forecast: cascades,
    manual_layers: ['d_to_c'].filter(k => (residual[k]?.residual || 0) > 0).length,
    reverse_discovery: (residual.c_to_r?.residual || 0) + (residual.t_to_r?.residual || 0) + (residual.d_to_r?.residual || 0),
  };
}

/**
 * Format a plan summary for display.
 * @param {Object} summary - from computePlanSummary
 * @returns {string} formatted text
 */
function formatPlanSummary(summary) {
  const lines = [];
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(' nForma ► SOLVE PLAN');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`Forward residual: ${summary.total_residual}`);
  lines.push(`Estimated iterations: ${summary.estimated_iterations} (max ${summary.max_iterations})`);
  lines.push(`Reverse discovery: ${summary.reverse_discovery} (informational)`);
  lines.push('');

  if (summary.active_layers.length > 0) {
    lines.push('Active layers:');
    for (const l of summary.active_layers) {
      lines.push(`  ${l.label}: ${l.residual} gaps`);
    }
    lines.push('');
  }

  if (summary.cascade_forecast.length > 0) {
    lines.push('Cascade forecast:');
    for (const c of summary.cascade_forecast) {
      lines.push(`  → ${c}`);
    }
    lines.push('');
  }

  lines.push('To execute: /nf:solve --execute');
  lines.push('To re-diagnose: /nf:solve (starts fresh)');
  lines.push('');

  return lines.join('\n');
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  let root = process.cwd();
  for (const a of args) { if (a.startsWith('--project-root=')) root = a.slice(15); }

  if (cmd === 'read') {
    const s = readSession(root);
    process.stdout.write(JSON.stringify(s, null, 2) + '\n');
  } else if (cmd === 'clear') {
    clearSession(root);
    process.stderr.write('Session cleared\n');
  } else {
    process.stderr.write('Usage: solve-session.cjs <read|clear> [--project-root=...]\n');
  }
}

module.exports = { writeSession, readSession, clearSession, computePlanSummary, formatPlanSummary, SESSION_FILE };
