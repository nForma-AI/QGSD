#!/usr/bin/env node
'use strict';
// bin/nf-benchmark-debug.cjs
// Standalone scorer for the nf:debug autonomy benchmark.
// Runs all 7 buggy stubs through nf-debug-runner.cjs and reports a 0-100 score.
//
// Usage:
//   node bin/nf-benchmark-debug.cjs
//   node bin/nf-benchmark-debug.cjs --dry-run
//   node bin/nf-benchmark-debug.cjs --dry-run --json
//   node bin/nf-benchmark-debug.cjs --json
//   node bin/nf-benchmark-debug.cjs --verbose
//   node bin/nf-benchmark-debug.cjs --timeout 120000

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const jsonOutput = args.includes('--json');
const verbose = args.includes('--verbose');
const timeoutIdx = args.indexOf('--timeout');
const runnerTimeout = timeoutIdx !== -1 ? parseInt(args[timeoutIdx + 1], 10) : 180000;

const ROOT = process.cwd();
const NF_DEBUG_RUNNER = path.join(__dirname, 'nf-debug-runner.cjs');

const STUBS = [
  { id: 'sort',        tier: 'easy',   stub: 'bin/bench-buggy-sort.cjs',               test: 'benchmarks/debug/tests/sort.test.cjs' },
  { id: 'filter',      tier: 'easy',   stub: 'bin/bench-buggy-filter.cjs',             test: 'benchmarks/debug/tests/filter.test.cjs' },
  { id: 'counter',     tier: 'easy',   stub: 'bin/bench-buggy-counter.cjs',            test: 'benchmarks/debug/tests/counter.test.cjs' },
  { id: 'dedup',       tier: 'medium', stub: 'bin/bench-buggy-medium-dedup.cjs',       test: 'benchmarks/debug/tests/dedup.test.cjs' },
  { id: 'accumulator', tier: 'medium', stub: 'bin/bench-buggy-medium-accumulator.cjs', test: 'benchmarks/debug/tests/accumulator.test.cjs' },
  { id: 'parser',      tier: 'hard',   stub: 'bin/bench-buggy-hard-parser.cjs',        test: 'benchmarks/debug/tests/parser.test.cjs' },
  { id: 'scheduler',   tier: 'hard',   stub: 'bin/bench-buggy-hard-scheduler.cjs',     test: 'benchmarks/debug/tests/scheduler.test.cjs' },
];

if (dryRun) {
  if (jsonOutput) {
    const result = {
      score: 0,
      total: STUBS.length,
      fixed: 0,
      dry_run: true,
      by_tier: { easy: { total: 3, fixed: 0 }, medium: { total: 2, fixed: 0 }, hard: { total: 2, fixed: 0 } },
      stubs: STUBS.map(function(s) { return { id: s.id, tier: s.tier, fixed: false, stub: s.stub, test: s.test }; })
    };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write('nf:debug autonomy benchmark — DRY RUN\n');
    process.stdout.write('Stubs (' + STUBS.length + '):\n');
    STUBS.forEach(function(s) {
      process.stdout.write('  [' + s.tier.padEnd(6) + '] ' + s.id.padEnd(12) + '  stub: ' + s.stub + '\n');
      process.stdout.write('                       test: ' + s.test + '\n');
    });
    process.stdout.write('\nScore: 0/100 (dry run — no AI invoked)\n');
  }
  process.exit(0);
}

// Live run — invoke nf-debug-runner.cjs per stub with stub restoration guarantee
const results = [];
let fixedCount = 0;

STUBS.forEach(function(entry) {
  const absStubPath = path.join(ROOT, entry.stub);
  const absTestPath = path.join(ROOT, entry.test);

  // Save original stub source for restoration guarantee
  let originalSource = null;
  try {
    originalSource = fs.readFileSync(absStubPath, 'utf8');
  } catch (e) {
    process.stderr.write('[nf-benchmark-debug] WARNING: could not read stub ' + absStubPath + ': ' + e.message + '\n');
    results.push({ id: entry.id, tier: entry.tier, fixed: false, error: 'stub_not_found' });
    return;
  }

  let fixed = false;
  let errorCode = null;

  try {
    const runnerArgs = ['--stub', absStubPath, '--test', absTestPath];
    if (verbose) runnerArgs.push('--verbose');

    const runResult = spawnSync('node', [NF_DEBUG_RUNNER].concat(runnerArgs), {
      encoding: 'utf8',
      timeout: runnerTimeout,
      cwd: ROOT,
      maxBuffer: 4 * 1024 * 1024
    });

    if (runResult.signal === 'SIGTERM' || (runResult.error && runResult.error.code === 'ETIMEDOUT')) {
      errorCode = 'timeout';
      process.stderr.write('[nf-benchmark-debug] runner timed out for stub: ' + entry.id + '\n');
    } else if (runResult.status === 0) {
      fixed = true;
    } else {
      // Try to parse error from runner stdout
      try {
        const parsed = JSON.parse(runResult.stdout || '{}');
        errorCode = parsed.error || 'runner_failed';
      } catch (_) {
        errorCode = 'runner_failed';
      }
    }

    if (verbose && runResult.stderr) {
      process.stderr.write(runResult.stderr);
    }
  } catch (e) {
    errorCode = 'exception';
    process.stderr.write('[nf-benchmark-debug] exception for stub ' + entry.id + ': ' + e.message + '\n');
  } finally {
    // Always restore original stub source — idempotency guarantee
    try {
      fs.writeFileSync(absStubPath, originalSource, 'utf8');
    } catch (restoreErr) {
      process.stderr.write('[nf-benchmark-debug] WARNING: could not restore stub ' + absStubPath + ': ' + restoreErr.message + '\n');
    }
  }

  if (fixed) fixedCount++;
  results.push({ id: entry.id, tier: entry.tier, fixed, error: errorCode || null });
});

const score = Math.round((fixedCount / STUBS.length) * 100);

const byTier = {
  easy: { total: 0, fixed: 0 },
  medium: { total: 0, fixed: 0 },
  hard: { total: 0, fixed: 0 }
};
results.forEach(function(r) {
  if (byTier[r.tier]) {
    byTier[r.tier].total++;
    if (r.fixed) byTier[r.tier].fixed++;
  }
});

if (jsonOutput) {
  const out = {
    score,
    total: STUBS.length,
    fixed: fixedCount,
    by_tier: byTier,
    stubs: results
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
} else {
  process.stdout.write('\nnf:debug autonomy benchmark results\n');
  process.stdout.write('=====================================\n');
  process.stdout.write('ID           Tier     Fixed\n');
  process.stdout.write('------------ -------- -----\n');
  results.forEach(function(r) {
    const status = r.fixed ? 'PASS' : ('FAIL' + (r.error ? ' (' + r.error + ')' : ''));
    process.stdout.write((r.id).padEnd(13) + r.tier.padEnd(9) + status + '\n');
  });
  process.stdout.write('\nScore: ' + score + '/100 (' + fixedCount + '/' + STUBS.length + ' fixed)\n');
  process.stdout.write('By tier: easy=' + byTier.easy.fixed + '/' + byTier.easy.total +
    ' medium=' + byTier.medium.fixed + '/' + byTier.medium.total +
    ' hard=' + byTier.hard.fixed + '/' + byTier.hard.total + '\n');
}

process.exit(0);
