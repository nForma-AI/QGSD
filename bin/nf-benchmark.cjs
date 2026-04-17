#!/usr/bin/env node
'use strict';
// bin/nf-benchmark.cjs
// Generic benchmark runner for any nForma skill.
// Loads fixtures from benchmarks/<skill>/fixtures.json and runs them.
//
// Usage:
//   node bin/nf-benchmark.cjs --skill=<name>                        # run skill's smoke fixtures
//   node bin/nf-benchmark.cjs --skill=<name> --track=<name>         # run specific track
//   node bin/nf-benchmark.cjs --skill=<name> --json                 # machine-readable JSON output
//   node bin/nf-benchmark.cjs --skill=<name> --dry-run              # list fixtures, skip running
//   node bin/nf-benchmark.cjs --skill=<name> --verbose              # show subprocess stderr

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { evaluatePassCondition } = require('./benchmark-utils.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// CLI arg parsing
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const jsonOutput = args.includes('--json');

const skillArg = args.find(function (a) { return a.startsWith('--skill='); });
const skill = skillArg ? skillArg.slice('--skill='.length) : null;

const trackArg = args.find(function (a) { return a.startsWith('--track='); });
const track = trackArg ? trackArg.slice('--track='.length) : 'smoke';

if (!skill) {
  process.stderr.write('ERROR: --skill=<name> is required\n');
  process.stderr.write('Usage: node bin/nf-benchmark.cjs --skill=<name> [--track=<name>] [--json] [--dry-run] [--verbose]\n');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const fixturePath = path.join(ROOT, 'benchmarks', skill, 'fixtures.json');

// ─────────────────────────────────────────────────────────────────────────────
// Pre-flight: verify fixture file exists
// ─────────────────────────────────────────────────────────────────────────────

if (!fs.existsSync(fixturePath)) {
  process.stderr.write('ERROR: fixture file not found: ' + fixturePath + '\n');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Load fixtures
// ─────────────────────────────────────────────────────────────────────────────

let fixtureData;
try {
  fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
} catch (e) {
  process.stderr.write('ERROR: failed to parse fixture file: ' + e.message + '\n');
  process.exit(1);
}

const allFixtures = fixtureData.fixtures;
if (!Array.isArray(allFixtures) || allFixtures.length === 0) {
  process.stderr.write('ERROR: fixture file has no fixtures array or is empty\n');
  process.exit(1);
}

// Filter by track if specified (fixtures may optionally have a "track" field)
const fixtures = allFixtures.filter(function (f) {
  // If fixture has no track field, include it in all tracks
  if (!f.track) return true;
  return f.track === track;
});

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

if (!jsonOutput) {
  console.log('nf:' + skill + ' benchmark — ' + fixtures.length + ' ' + track + ' fixtures');
  if (dryRun) {
    console.log('(dry-run mode — commands will not be invoked)');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dry-run: list fixtures and exit
// ─────────────────────────────────────────────────────────────────────────────

if (dryRun) {
  for (const fixture of fixtures) {
    console.log('  [dry-run] ' + fixture.id + ': ' + fixture.label + '  command: ' + fixture.command + ' ' + fixture.args.join(' '));
  }
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Run fixtures
// ─────────────────────────────────────────────────────────────────────────────

const results = [];
const totalStart = Date.now();
let anyFailed = false;

for (const fixture of fixtures) {
  const start = Date.now();

  // Pre-flight: check required env vars
  const envRequired = Array.isArray(fixture.env_required) ? fixture.env_required : [];
  const missingEnv = envRequired.filter(function (envVar) {
    return !process.env[envVar];
  });

  if (missingEnv.length > 0) {
    const skipReason = 'env var ' + missingEnv[0] + ' not set';
    const duration = Date.now() - start;

    if (!jsonOutput) {
      console.log('  [SKIP] ' + fixture.id + ': ' + fixture.label + '  reason=' + skipReason);
    }

    results.push({
      id: fixture.id,
      label: fixture.label,
      passed: false,
      skipped: true,
      skip_reason: skipReason,
      duration_ms: duration
    });
    continue;
  }

  // Spawn the fixture command
  const spawnOpts = {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 60000
  };

  if (verbose) {
    spawnOpts.stdio = ['pipe', 'pipe', 'inherit'];
  } else {
    spawnOpts.stdio = ['pipe', 'pipe', 'pipe'];
  }

  const spawnResult = spawnSync(fixture.command, fixture.args, spawnOpts);
  const duration = Date.now() - start;

  // Parse stdout as JSON (fail-open: if parse fails, treat as {})
  let parsed = {};
  try {
    if (spawnResult.stdout && spawnResult.stdout.trim()) {
      parsed = JSON.parse(spawnResult.stdout);
    }
  } catch (_) {
    parsed = {};
  }

  // Evaluate pass condition (no residual needed for exits_zero)
  const passed = evaluatePassCondition(fixture, spawnResult, parsed, -1);
  const label = passed ? 'PASS' : 'FAIL';

  if (!passed) {
    anyFailed = true;
  }

  if (!jsonOutput) {
    console.log(
      '  [' + label + '] ' + fixture.id + ': ' + fixture.label +
      '  duration=' + duration + 'ms'
    );
    if (!passed && verbose && spawnResult.stderr) {
      process.stderr.write('    stderr: ' + spawnResult.stderr.slice(0, 200) + '\n');
    }
  }

  results.push({
    id: fixture.id,
    label: fixture.label,
    passed: passed,
    skipped: false,
    skip_reason: null,
    exit_status: spawnResult.status,
    duration_ms: duration
  });
}

const totalDuration = Date.now() - totalStart;

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate results
// ─────────────────────────────────────────────────────────────────────────────

const actualResults = results.filter(function (r) { return !r.skipped; });
const passed = actualResults.filter(function (r) { return r.passed; }).length;
const failed = actualResults.length - passed;
const passRate = actualResults.length > 0 ? Math.round((passed / actualResults.length) * 100) : 0;

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

if (jsonOutput) {
  const output = {
    skill: skill,
    track: track,
    passed: passed,
    failed: failed,
    total: actualResults.length,
    pass_rate: passRate,
    duration_ms: totalDuration,
    results: results
  };
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log('─────────────────────────────────────────');
  const skipped = results.filter(function (r) { return r.skipped; }).length;
  if (skipped > 0) {
    console.log(skill + '/' + track + ': ' + passed + '/' + actualResults.length + ' passed  (' + passRate + '%)  ' + skipped + ' skipped');
  } else {
    console.log(skill + '/' + track + ': ' + passed + '/' + actualResults.length + ' passed  (' + passRate + '%)');
  }
  console.log('Total duration: ' + totalDuration + 'ms');
  console.log('─────────────────────────────────────────');
}

process.exit(anyFailed ? 1 : 0);
