#!/usr/bin/env node
'use strict';
// bin/analyze-solve-convergence.cjs
// Convergence timeline analysis — reads solve-trend.jsonl to show
// per-layer trends, session-over-session deltas, and requirement lifecycle.
//
// Usage:
//   node bin/analyze-solve-convergence.cjs                    # full summary
//   node bin/analyze-solve-convergence.cjs --layer=r_to_f     # single layer timeline
//   node bin/analyze-solve-convergence.cjs --last=20          # last N sessions (default: 20)
//   node bin/analyze-solve-convergence.cjs --json             # machine-readable output
//   node bin/analyze-solve-convergence.cjs --bottlenecks      # show timing bottlenecks (requires timing data)

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
let lastN = 20;
let filterLayer = null;
const showBottlenecks = args.includes('--bottlenecks');

for (const arg of args) {
  if (arg.startsWith('--last=')) lastN = parseInt(arg.slice(7), 10) || 20;
  if (arg.startsWith('--layer=')) filterLayer = arg.slice(8);
}

let ROOT = process.cwd();
for (const arg of args) {
  if (arg.startsWith('--project-root=')) ROOT = path.resolve(arg.slice(15));
}

const trendPath = path.join(ROOT, '.planning', 'formal', 'solve-trend.jsonl');
if (!fs.existsSync(trendPath)) {
  console.error('No solve-trend.jsonl found at', trendPath);
  process.exit(1);
}

// Parse all entries
const lines = fs.readFileSync(trendPath, 'utf8').trim().split('\n');
const entries = [];
for (const line of lines) {
  try { entries.push(JSON.parse(line)); } catch (_) { /* skip malformed */ }
}

if (entries.length === 0) {
  console.error('No valid entries in solve-trend.jsonl');
  process.exit(1);
}

// Take last N
const recent = entries.slice(-lastN);

// ── Per-layer analysis ──────────────────────────────────────────────────────

const FORWARD_LAYERS = ['r_to_f', 'f_to_t', 'c_to_f', 't_to_c', 'f_to_c', 'r_to_d', 'd_to_c', 'p_to_f'];
const REVERSE_LAYERS = ['c_to_r', 't_to_r', 'd_to_r'];
const ALL_LAYERS = [...FORWARD_LAYERS, ...REVERSE_LAYERS];

function analyzeLayer(layerKey) {
  const values = recent.map(e => ({ ts: e.timestamp, val: (e.per_layer || {})[layerKey] }));
  const active = values.filter(v => v.val !== undefined && v.val >= 0);
  if (active.length < 2) return { layer: layerKey, trend: 'INSUFFICIENT_DATA', samples: active.length };

  const first = active[0].val;
  const last = active[active.length - 1].val;
  const delta = last - first;
  const min = Math.min(...active.map(v => v.val));
  const max = Math.max(...active.map(v => v.val));
  const avg = active.reduce((s, v) => s + v.val, 0) / active.length;

  // Trend detection
  let trend = 'STABLE';
  if (delta < 0 && last === 0) trend = 'CONVERGED';
  else if (delta < -2) trend = 'DECREASING';
  else if (delta > 2) trend = 'INCREASING';
  else {
    // Check for oscillation: alternating up/down
    let flips = 0;
    for (let i = 2; i < active.length; i++) {
      const d1 = active[i - 1].val - active[i - 2].val;
      const d2 = active[i].val - active[i - 1].val;
      if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) flips++;
    }
    if (flips > active.length * 0.5) trend = 'OSCILLATING';
  }

  // Sparkline
  const sparkChars = '▁▂▃▄▅▆▇█';
  const range = max - min || 1;
  const spark = active.map(v => sparkChars[Math.min(7, Math.floor((v.val - min) / range * 7))]).join('');

  return {
    layer: layerKey,
    trend,
    current: last,
    delta,
    min,
    max,
    avg: Math.round(avg * 10) / 10,
    samples: active.length,
    spark,
    first_ts: active[0].ts,
    last_ts: active[active.length - 1].ts,
  };
}

// ── Requirement count timeline ──────────────────────────────────────────────

function analyzeRequirementGrowth() {
  const withReqs = recent.filter(e => e.requirement_count);
  if (withReqs.length < 2) return null;
  const first = withReqs[0].requirement_count;
  const last = withReqs[withReqs.length - 1].requirement_count;
  return {
    first,
    last,
    delta: last - first,
    growth_rate: Math.round((last - first) / withReqs.length * 100) / 100,
  };
}

// ── Timing bottlenecks (from entries with timing data) ──────────────────────

function analyzeTimingBottlenecks() {
  const withTiming = recent.filter(e => e.timing && e.timing.total_diagnostic_ms);
  if (withTiming.length === 0) return null;

  // Aggregate per-layer timing across sessions
  const layerTotals = {};
  const layerCounts = {};
  for (const entry of withTiming) {
    for (const [key, val] of Object.entries(entry.timing)) {
      if (key === 'total_diagnostic_ms') continue;
      if (!val || typeof val.duration_ms !== 'number') continue;
      layerTotals[key] = (layerTotals[key] || 0) + val.duration_ms;
      layerCounts[key] = (layerCounts[key] || 0) + 1;
    }
  }

  const avgTiming = Object.entries(layerTotals)
    .map(([key, total]) => ({ layer: key, avg_ms: Math.round(total / layerCounts[key]), sessions: layerCounts[key] }))
    .sort((a, b) => b.avg_ms - a.avg_ms);

  const avgTotal = Math.round(
    withTiming.reduce((s, e) => s + e.timing.total_diagnostic_ms, 0) / withTiming.length
  );

  return { avg_total_ms: avgTotal, top_layers: avgTiming.slice(0, 10), sessions_with_timing: withTiming.length };
}

// ── Main ────────────────────────────────────────────────────────────────────

const layers = filterLayer ? [filterLayer] : ALL_LAYERS;
const analysis = layers.map(analyzeLayer);
const reqGrowth = analyzeRequirementGrowth();
const bottlenecks = showBottlenecks ? analyzeTimingBottlenecks() : null;

if (jsonMode) {
  console.log(JSON.stringify({ analysis, requirement_growth: reqGrowth, bottlenecks, sessions: recent.length }, null, 2));
  process.exit(0);
}

// ── Human-readable output ───────────────────────────────────────────────────

console.log(`\n━━━ Solve Convergence Analysis (last ${recent.length} sessions) ━━━\n`);

// Layer table
const header = 'Layer            Trend          Current  Delta  Avg    Spark';
const sep =    '────────────────────────────────────────────────────────────';
console.log(header);
console.log(sep);

for (const a of analysis) {
  if (a.trend === 'INSUFFICIENT_DATA') {
    console.log(`${a.layer.padEnd(17)}INSUFFICIENT_DATA`);
    continue;
  }
  const trendColor = {
    CONVERGED: '\x1b[32m', DECREASING: '\x1b[32m', STABLE: '\x1b[90m',
    INCREASING: '\x1b[31m', OSCILLATING: '\x1b[33m',
  }[a.trend] || '';
  const reset = '\x1b[0m';
  console.log(
    `${a.layer.padEnd(17)}${trendColor}${a.trend.padEnd(15)}${reset}` +
    `${String(a.current).padStart(7)}  ${(a.delta >= 0 ? '+' : '') + a.delta}`.padEnd(14) +
    `${String(a.avg).padStart(6)}  ${a.spark}`
  );
}

// Requirement growth
if (reqGrowth) {
  console.log(`\n── Requirement Growth ──`);
  console.log(`  ${reqGrowth.first} → ${reqGrowth.last} (${reqGrowth.delta >= 0 ? '+' : ''}${reqGrowth.delta}, ~${reqGrowth.growth_rate}/session)`);
}

// Timing bottlenecks
if (bottlenecks) {
  console.log(`\n── Timing Bottlenecks (avg of ${bottlenecks.sessions_with_timing} sessions) ──`);
  console.log(`  Total diagnostic: ${bottlenecks.avg_total_ms}ms avg`);
  console.log(`  Top layers:`);
  for (const t of bottlenecks.top_layers.slice(0, 5)) {
    console.log(`    ${t.layer.padEnd(20)} ${t.avg_ms}ms avg`);
  }
}

// Overall health
const convergedLayers = analysis.filter(a => a.trend === 'CONVERGED').length;
const increasingLayers = analysis.filter(a => a.trend === 'INCREASING').length;
const oscillatingLayers = analysis.filter(a => a.trend === 'OSCILLATING').length;

console.log(`\n── Health ──`);
console.log(`  ${convergedLayers} converged, ${increasingLayers} increasing, ${oscillatingLayers} oscillating`);
if (increasingLayers > 0) {
  console.log(`  ⚠ ${analysis.filter(a => a.trend === 'INCREASING').map(a => a.layer).join(', ')} trending up`);
}

console.log('');

// ── Exports (for testing) ───────────────────────────────────────────────────

module.exports = { analyzeLayer, analyzeRequirementGrowth, analyzeTimingBottlenecks };
