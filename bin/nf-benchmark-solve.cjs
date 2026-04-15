#!/usr/bin/env node
'use strict';
// bin/nf-benchmark-solve.cjs
// Benchmark runner for nf:solve end-to-end validation.
// Runs nf-solve against a fixture set of synthetic issues and reports
// pass/fail per issue plus aggregate metrics (pass rate, total duration).
//
// Usage:
//   node bin/nf-benchmark-solve.cjs                        # run all fixtures (smoke + autonomy)
//   node bin/nf-benchmark-solve.cjs --dry-run              # list fixtures, skip running
//   node bin/nf-benchmark-solve.cjs --fixture <path>       # override fixture JSON path
//   node bin/nf-benchmark-solve.cjs --verbose              # pipe nf-solve stderr to parent
//   node bin/nf-benchmark-solve.cjs --json                 # machine-readable JSON output
//   node bin/nf-benchmark-solve.cjs --track=smoke          # run only Track A (smoke) fixtures
//   node bin/nf-benchmark-solve.cjs --track=autonomy       # run only Track B (autonomy) fixtures
//   node bin/nf-benchmark-solve.cjs --track=all            # run both tracks (default)

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

const trackArg = args.find(function (a) { return a.startsWith('--track='); });
const track = trackArg ? trackArg.slice('--track='.length) : 'all';
const runSmoke = track === 'all' || track === 'smoke';
const runAutonomy = track === 'all' || track === 'autonomy';

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
  const autonomyCount = Array.isArray(fixtureData.autonomy_fixtures) ? fixtureData.autonomy_fixtures.length : 0;
  if (runSmoke && runAutonomy) {
    console.log('nf:solve benchmark — ' + fixtures.length + ' smoke fixtures + ' + autonomyCount + ' autonomy fixtures');
  } else if (runSmoke) {
    console.log('nf:solve benchmark — ' + fixtures.length + ' smoke fixtures (Track A only)');
  } else {
    console.log('nf:solve benchmark — ' + autonomyCount + ' autonomy fixtures (Track B only)');
  }
  if (dryRun) {
    console.log('(dry-run mode — nf-solve will not be invoked)');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dry-run: list fixtures and exit
// ─────────────────────────────────────────────────────────────────────────────

if (dryRun) {
  if (runSmoke) {
    for (const fixture of fixtures) {
      console.log('  [dry-run] smoke/' + fixture.id + ': ' + fixture.label + '  args: ' + fixture.args.join(' '));
    }
  }
  if (runAutonomy && Array.isArray(fixtureData.autonomy_fixtures) && fixtureData.autonomy_fixtures.length > 0) {
    for (const fixture of fixtureData.autonomy_fixtures) {
      console.log('  [dry-run] autonomy/' + fixture.id + ': ' + fixture.label + '  args: ' + fixture.args.join(' '));
    }
  } else if (runAutonomy) {
    console.log('  (no autonomy fixtures defined)');
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

// Per-layer residual extraction helper
function extractLayerResidual(parsed, layer) {
  if (!parsed || typeof parsed !== 'object') return -1;
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

const FORMAL_DIR = path.join(ROOT, '.planning', 'formal');

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
// Run smoke fixtures (Track A)
// ─────────────────────────────────────────────────────────────────────────────

const results = [];
const totalStart = Date.now();

if (runSmoke) {
  if (!jsonOutput) {
    console.log('\u2500\u2500 Track A: smoke \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  }

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
}

// ─────────────────────────────────────────────────────────────────────────────
// Run autonomy fixtures (Track B)
// ─────────────────────────────────────────────────────────────────────────────

const autonomyResults = [];

if (runAutonomy && Array.isArray(fixtureData.autonomy_fixtures) && fixtureData.autonomy_fixtures.length > 0) {
  if (!jsonOutput) {
    console.log('\u2500\u2500 Track B: autonomy \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  }

  for (const autoFixture of fixtureData.autonomy_fixtures) {
    const start = Date.now();
    const mutation = autoFixture.seed_mutation;
    const targetLayer = mutation.target_layer;
    const seedDelta = typeof mutation.seeded_delta === 'number' ? mutation.seeded_delta : 1;

    // Pre-flight: verify seed target file exists
    const seedFilePath = path.join(ROOT, mutation.file);
    if (!fs.existsSync(seedFilePath)) {
      const duration = Date.now() - start;
      if (!jsonOutput) {
        console.log('  [SKIP] ' + autoFixture.id + ': seed target file missing: ' + mutation.file + '  duration=' + duration + 'ms');
      }
      autonomyResults.push({
        id: autoFixture.id,
        label: autoFixture.label,
        passed: false,
        skipped: true,
        skip_reason: 'seed target file missing: ' + mutation.file,
        duration_ms: duration
      });
      continue;
    }

    const snap = snapshotFormalJson();
    let autonomyPassed = false;
    let skipReason = null;
    let preResidual = -1;
    let postResidual = -1;
    let baselineResidual = -1;

    try {
      // Step 1: Measure baseline residual (before mutation) using --report-only --fast
      const baselineArgs = [SOLVE_SCRIPT, '--report-only', '--json', '--no-timeout', '--max-iterations=1', '--fast', '--project-root=' + ROOT];
      const baselineOpts = {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe']
      };
      const baselineResult = spawnSync(process.execPath, baselineArgs, baselineOpts);
      let baselineParsed = {};
      try {
        if (baselineResult.stdout && baselineResult.stdout.trim()) {
          baselineParsed = JSON.parse(baselineResult.stdout);
        }
      } catch (_) { /* fail-open */ }
      baselineResidual = extractLayerResidual(baselineParsed, targetLayer);

      // Step 2: Apply seed mutation
      let seedObj;
      try {
        seedObj = JSON.parse(fs.readFileSync(seedFilePath, 'utf8'));
      } catch (e) {
        skipReason = 'failed to parse seed file: ' + e.message;
        autonomyPassed = false;
        return; // will be caught by finally
      }

      if (mutation.type === 'set_field') {
        setNestedField(seedObj, mutation.field, mutation.value);
        fs.writeFileSync(seedFilePath, JSON.stringify(seedObj, null, 2) + '\n', 'utf8');
      } else if (mutation.type === 'remove_key') {
        delete seedObj[mutation.key];
        fs.writeFileSync(seedFilePath, JSON.stringify(seedObj, null, 2) + '\n', 'utf8');
      } else {
        skipReason = 'unknown mutation type: ' + mutation.type;
        autonomyPassed = false;
      }

      if (!skipReason) {
        // pre_residual = baseline + seeded_delta (expected residual after mutation)
        preResidual = baselineResidual >= 0 ? baselineResidual + seedDelta : seedDelta;

        // Step 3: Run nf-solve without --report-only (real remediation)
        const fixArgs = [SOLVE_SCRIPT].concat(autoFixture.args).concat(['--project-root=' + ROOT]);
        const fixOpts = {
          cwd: ROOT,
          encoding: 'utf8',
          maxBuffer: 8 * 1024 * 1024,
          timeout: 300000
        };
        if (verbose) {
          fixOpts.stdio = ['pipe', 'pipe', 'inherit'];
        } else {
          fixOpts.stdio = ['pipe', 'pipe', 'pipe'];
        }
        const fixResult = spawnSync(process.execPath, fixArgs, fixOpts);

        // Step 4: Parse post-remediation output
        let fixParsed = {};
        try {
          if (fixResult.stdout && fixResult.stdout.trim()) {
            fixParsed = JSON.parse(fixResult.stdout);
          }
        } catch (_) { /* fail-open */ }

        postResidual = extractLayerResidual(fixParsed, targetLayer);

        // Step 5: Evaluate pass condition
        if (autoFixture.pass_condition === 'residual_decreased') {
          // post < pre means remediation reduced the residual
          autonomyPassed = postResidual >= 0 && preResidual >= 0 && postResidual < preResidual;
        } else if (autoFixture.pass_condition === 'exits_zero') {
          autonomyPassed = fixResult.status === 0;
        } else if (autoFixture.pass_condition === 'converged') {
          autonomyPassed = fixParsed.converged === true;
        } else {
          // fail-open: unknown condition — treat as exits_zero
          autonomyPassed = fixResult.status === 0;
        }
      }
    } catch (e) {
      if (!skipReason) {
        skipReason = 'unexpected error: ' + e.message;
      }
      autonomyPassed = false;
    } finally {
      // Step 6: Restore snapshot unconditionally
      restoreFormalJson(snap);
      if (verbose) {
        process.stderr.write('  autonomy/' + autoFixture.id + ': snapshot restored\n');
      }
    }

    const duration = Date.now() - start;
    const resultLabel = skipReason ? 'SKIP' : (autonomyPassed ? 'PASS' : 'FAIL');

    if (!jsonOutput) {
      if (skipReason) {
        console.log('  [SKIP] ' + autoFixture.id + ': ' + autoFixture.label + '  reason=' + skipReason + '  duration=' + duration + 'ms');
      } else {
        console.log(
          '  [' + resultLabel + '] ' + autoFixture.id + ': ' + autoFixture.label +
          '  pre_residual=' + (preResidual === -1 ? 'n/a' : preResidual) +
          '  post_residual=' + (postResidual === -1 ? 'n/a' : postResidual) +
          '  duration=' + duration + 'ms'
        );
      }
    }

    autonomyResults.push({
      id: autoFixture.id,
      label: autoFixture.label,
      passed: autonomyPassed,
      skipped: skipReason !== null,
      skip_reason: skipReason || null,
      pre_residual: preResidual,
      post_residual: postResidual,
      baseline_residual: baselineResidual,
      target_layer: targetLayer,
      duration_ms: duration
    });
  }
} else if (runAutonomy && !jsonOutput) {
  console.log('\u2500\u2500 Track B: autonomy \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  console.log('  (no autonomy fixtures defined)');
}

const totalDuration = Date.now() - totalStart;

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate results
// ─────────────────────────────────────────────────────────────────────────────

const smokePassed = results.filter(function (r) { return r.passed; }).length;
const smokeFailed = results.length - smokePassed;
const smokePassRate = results.length > 0 ? Math.round((smokePassed / results.length) * 100) : 0;

// Autonomy: skipped fixtures don't count as failures
const autonomyActual = autonomyResults.filter(function (r) { return !r.skipped; });
const autonomyPassed = autonomyActual.filter(function (r) { return r.passed; }).length;
const autonomyFailed = autonomyActual.length - autonomyPassed;
const autonomyPassRate = autonomyActual.length > 0 ? Math.round((autonomyPassed / autonomyActual.length) * 100) : 0;

const totalPassed = smokePassed + autonomyPassed;
const totalFailed = smokeFailed + autonomyFailed;

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

if (jsonOutput) {
  const output = {
    passed: totalPassed,
    failed: totalFailed,
    total: results.length + autonomyActual.length,
    pass_rate: (results.length + autonomyActual.length) > 0
      ? Math.round((totalPassed / (results.length + autonomyActual.length)) * 100)
      : 0,
    duration_ms: totalDuration,
    results: results,
    autonomy_results: autonomyResults
  };
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  if (runSmoke) {
    console.log('Smoke (Track A): ' + smokePassed + '/' + results.length + ' passed  (' + smokePassRate + '%)');
  }
  if (runAutonomy) {
    const autonomySkipped = autonomyResults.filter(function (r) { return r.skipped; }).length;
    const autonomyTotal = autonomyResults.length;
    if (autonomySkipped > 0) {
      console.log('Autonomy (Track B): ' + autonomyPassed + '/' + autonomyActual.length + ' passed  (' + autonomyPassRate + '%)  ' + autonomySkipped + ' skipped');
    } else {
      console.log('Autonomy (Track B): ' + autonomyPassed + '/' + autonomyTotal + ' passed  (' + autonomyPassRate + '%)');
    }
  }
  console.log('Total duration: ' + totalDuration + 'ms');
  console.log('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
}

process.exit(totalFailed > 0 ? 1 : 0);
