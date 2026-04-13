#!/usr/bin/env node
'use strict';
// bin/nf-benchmark-solve.cjs
// Benchmark runner for nf:solve end-to-end validation.
// Runs nf-solve against a fixture set of synthetic issues and reports
// pass/fail per issue plus aggregate metrics (pass rate, total duration).
//
// Usage:
//   node bin/nf-benchmark-solve.cjs                        # run all fixtures
//   node bin/nf-benchmark-solve.cjs --dry-run              # list fixtures, skip running
//   node bin/nf-benchmark-solve.cjs --fixture <path>       # override fixture JSON path
//   node bin/nf-benchmark-solve.cjs --verbose              # pipe nf-solve stderr to parent
//   node bin/nf-benchmark-solve.cjs --json                 # machine-readable JSON output

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const DEFAULT_FIXTURE_PATH = path.join(ROOT, '.planning', 'formal', 'solve-benchmark-fixtures.json');
const SOLVE_SCRIPT = path.join(__dirname, 'nf-solve.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// CLI arg parsing
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const jsonOutput = args.includes('--json');

let fixturePath = DEFAULT_FIXTURE_PATH;
const fixtureIdx = args.indexOf('--fixture');
if (fixtureIdx !== -1 && args[fixtureIdx + 1]) {
  fixturePath = path.resolve(args[fixtureIdx + 1]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-flight: verify fixture file exists
// ─────────────────────────────────────────────────────────────────────────────

if (!fs.existsSync(fixturePath)) {
  console.error('ERROR: fixture file not found: ' + fixturePath);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Load fixtures
// ─────────────────────────────────────────────────────────────────────────────

let fixtureData;
try {
  fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
} catch (e) {
  console.error('ERROR: failed to parse fixture file: ' + e.message);
  process.exit(1);
}

const fixtures = fixtureData.fixtures;
if (!Array.isArray(fixtures) || fixtures.length === 0) {
  console.error('ERROR: fixture file has no fixtures array or is empty');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

if (!jsonOutput) {
  console.log('nf:solve benchmark — ' + fixtures.length + ' fixtures');
  if (dryRun) {
    console.log('(dry-run mode — nf-solve will not be invoked)');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dry-run: list fixtures and exit
// ─────────────────────────────────────────────────────────────────────────────

if (dryRun) {
  for (const fixture of fixtures) {
    console.log('  [dry-run] ' + fixture.id + ': ' + fixture.label + '  args: ' + fixture.args.join(' '));
  }
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Residual extraction helper
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
// Run fixtures
// ─────────────────────────────────────────────────────────────────────────────

const results = [];
const totalStart = Date.now();

for (const fixture of fixtures) {
  const start = Date.now();

  const spawnArgs = [SOLVE_SCRIPT].concat(fixture.args).concat(['--project-root=' + ROOT]);
  const spawnOpts = {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 300000
  };

  if (verbose) {
    spawnOpts.stdio = ['pipe', 'pipe', 'inherit'];
  } else {
    spawnOpts.stdio = ['pipe', 'pipe', 'pipe'];
  }

  const result = spawnSync(process.execPath, spawnArgs, spawnOpts);
  const duration = Date.now() - start;

  // Parse stdout as JSON (fail-open: if parse fails, treat as {})
  let parsed = {};
  try {
    if (result.stdout && result.stdout.trim()) {
      parsed = JSON.parse(result.stdout);
    }
  } catch (_) {
    parsed = {};
  }

  const residual = extractResidual(parsed);
  const converged = parsed.converged === true;

  // Evaluate primary pass condition
  let passed = evaluatePassCondition(fixture, result, parsed, residual);

  // Apply min_residual assertion (if both are non-null)
  if (passed && fixture.min_residual !== null && fixture.min_residual !== undefined) {
    if (residual !== -1 && residual < fixture.min_residual) {
      passed = false;
    }
  }

  // Apply max_residual assertion (if both are non-null)
  if (passed && fixture.max_residual !== null && fixture.max_residual !== undefined) {
    if (residual !== -1 && residual > fixture.max_residual) {
      passed = false;
    }
  }

  const label = passed ? 'PASS' : 'FAIL';

  if (!jsonOutput) {
    console.log(
      '  [' + label + '] ' + fixture.id + ': ' + fixture.label +
      '  residual=' + (residual === -1 ? 'n/a' : residual) +
      '  duration=' + duration + 'ms'
    );
  }

  results.push({
    id: fixture.id,
    label: fixture.label,
    passed: passed,
    residual: residual,
    converged: converged,
    duration_ms: duration,
    exit_status: result.status
  });
}

const totalDuration = Date.now() - totalStart;
const passed = results.filter(function (r) { return r.passed; }).length;
const failed = results.length - passed;
const passRate = results.length > 0 ? Math.round((passed / results.length) * 100) : 0;

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

if (jsonOutput) {
  const output = {
    passed: passed,
    failed: failed,
    total: results.length,
    pass_rate: passRate,
    duration_ms: totalDuration,
    results: results
  };
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  console.log('Results: ' + passed + '/' + results.length + ' passed  (' + passRate + '%)');
  console.log('Total duration: ' + totalDuration + 'ms');
  console.log('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
}

process.exit(failed > 0 ? 1 : 0);
