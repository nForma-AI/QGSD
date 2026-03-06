#!/usr/bin/env node
'use strict';
// bin/run-account-manager-tlc.cjs
// Invokes TLC model checker for the nForma account manager TLA+ specification.
// Source spec: .planning/formal/tla/NFAccountManager.tla
// Source impl: bin/account-manager.cjs
//
// Checks:
//   TypeOK              — all variables conform to declared types
//   ActiveIsPoolMember  — active account (when set) must be in the pool
//   NoActiveWhenEmpty   — empty pool implies no active account
//   IdleNoPending       — in IDLE state, no pending operation
//   OpMatchesState      — pending_op.type matches current FSM state
//   IdleReachable       — IDLE is eventually reachable from any state (liveness)
//
// Usage:
//   node bin/run-account-manager-tlc.cjs                    # default: MCaccount-manager
//   node bin/run-account-manager-tlc.cjs MCaccount-manager
//   node bin/run-account-manager-tlc.cjs --config=MCaccount-manager
//
// Prerequisites:
//   - Java >=17 (https://adoptium.net/)
//   - .planning/formal/tla/tla2tools.jar (see .planning/formal/tla/README.md for download command)

const { spawnSync } = require('child_process');
const JAVA_HEAP_MAX = process.env.NF_JAVA_HEAP_MAX || '512m';
const fs   = require('fs');
const path = require('path');
const { writeCheckResult } = require('./write-check-result.cjs');
const { detectLivenessProperties } = require('./run-tlc.cjs');
const { getRequirementIds } = require('./requirement-map.cjs');

// ── Resolve project root (--project-root= overrides __dirname-relative) ─────
let ROOT = path.join(__dirname, '..');
for (const arg of process.argv) {
  if (arg.startsWith('--project-root=')) ROOT = path.resolve(arg.slice('--project-root='.length));
}

// ── Parse --config argument ──────────────────────────────────────────────────
const args       = process.argv.slice(2);
const configArg  = args.find(a => a.startsWith('--config=')) || null;
const configName = configArg
  ? configArg.split('=')[1]
  : (args.find(a => !a.startsWith('-')) || 'MCaccount-manager');

const VALID_CONFIGS = ['MCaccount-manager'];
if (!VALID_CONFIGS.includes(configName)) {
  process.stderr.write(
    '[run-account-manager-tlc] Unknown config: ' + configName +
    '. Valid: ' + VALID_CONFIGS.join(', ') + '\n'
  );
  const _startMs = Date.now();
  const _runtimeMs = 0;
  try { writeCheckResult({ tool: 'run-account-manager-tlc', formalism: 'tla', result: 'fail', check_id: 'tla:account-manager', surface: 'tla', property: 'Account manager quorum state machine — MCAM correctness', runtime_ms: _runtimeMs, summary: 'fail: unknown config in ' + _runtimeMs + 'ms', requirement_ids: getRequirementIds('tla:account-manager'), metadata: {} }); } catch (e) { process.stderr.write('[run-account-manager-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 1. Locate Java ───────────────────────────────────────────────────────────
const JAVA_HOME = process.env.JAVA_HOME;
let javaExe;

if (JAVA_HOME) {
  javaExe = path.join(JAVA_HOME, 'bin', 'java');
  if (!fs.existsSync(javaExe)) {
    process.stderr.write(
      '[run-account-manager-tlc] JAVA_HOME is set but java binary not found at: ' + javaExe + '\n' +
      '[run-account-manager-tlc] Unset JAVA_HOME or fix the path.\n'
    );
    const _startMs = Date.now();
    const _runtimeMs = 0;
    try { writeCheckResult({ tool: 'run-account-manager-tlc', formalism: 'tla', result: 'fail', check_id: 'tla:account-manager', surface: 'tla', property: 'Account manager quorum state machine — MCAM correctness', runtime_ms: _runtimeMs, summary: 'fail: Java not found in ' + _runtimeMs + 'ms', requirement_ids: getRequirementIds('tla:account-manager'), metadata: {} }); } catch (e) { process.stderr.write('[run-account-manager-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }
} else {
  const probe = spawnSync('java', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    process.stderr.write(
      '[run-account-manager-tlc] Java not found. Install Java >=17 and set JAVA_HOME.\n' +
      '[run-account-manager-tlc] Download: https://adoptium.net/\n'
    );
    const _startMs = Date.now();
    const _runtimeMs = 0;
    try { writeCheckResult({ tool: 'run-account-manager-tlc', formalism: 'tla', result: 'fail', check_id: 'tla:account-manager', surface: 'tla', property: 'Account manager quorum state machine — MCAM correctness', runtime_ms: _runtimeMs, summary: 'fail: Java not found in ' + _runtimeMs + 'ms', requirement_ids: getRequirementIds('tla:account-manager'), metadata: {} }); } catch (e) { process.stderr.write('[run-account-manager-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }
  javaExe = 'java';
}

// ── 2. Check Java version >=17 ───────────────────────────────────────────────
const versionResult = spawnSync(javaExe, ['--version'], { encoding: 'utf8' });
if (versionResult.error || versionResult.status !== 0) {
  process.stderr.write('[run-account-manager-tlc] Failed to run: ' + javaExe + ' --version\n');
  const _startMs = Date.now();
  const _runtimeMs = 0;
  try { writeCheckResult({ tool: 'run-account-manager-tlc', formalism: 'tla', result: 'fail', check_id: 'tla:account-manager', surface: 'tla', property: 'Account manager quorum state machine — MCAM correctness', runtime_ms: _runtimeMs, summary: 'fail: Java version check failed in ' + _runtimeMs + 'ms', requirement_ids: getRequirementIds('tla:account-manager'), metadata: {} }); } catch (e) { process.stderr.write('[run-account-manager-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}
const versionOutput = versionResult.stdout + versionResult.stderr;
const versionMatch  = versionOutput.match(/(?:openjdk\s+|java version\s+[""]?)(\d+)/i);
const javaMajor     = versionMatch ? parseInt(versionMatch[1], 10) : 0;
if (javaMajor < 17) {
  process.stderr.write(
    '[run-account-manager-tlc] Java >=17 required. Found: ' + versionOutput.split('\n')[0] + '\n' +
    '[run-account-manager-tlc] Download Java 17+: https://adoptium.net/\n'
  );
  const _startMs = Date.now();
  const _runtimeMs = 0;
  try { writeCheckResult({ tool: 'run-account-manager-tlc', formalism: 'tla', result: 'fail', check_id: 'tla:account-manager', surface: 'tla', property: 'Account manager quorum state machine — MCAM correctness', runtime_ms: _runtimeMs, summary: 'fail: Java ' + javaMajor + ' < 17 in ' + _runtimeMs + 'ms', requirement_ids: getRequirementIds('tla:account-manager'), metadata: {} }); } catch (e) { process.stderr.write('[run-account-manager-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 3. Locate tla2tools.jar ──────────────────────────────────────────────────
const jarPath = path.join(ROOT, '.planning', 'formal', 'tla', 'tla2tools.jar');
if (!fs.existsSync(jarPath)) {
  process.stderr.write(
    '[run-account-manager-tlc] tla2tools.jar not found at: ' + jarPath + '\n' +
    '[run-account-manager-tlc] Download v1.8.0:\n' +
    '  curl -L https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar \\\n' +
    '       -o .planning/formal/tla/tla2tools.jar\n'
  );
  const _startMs = Date.now();
  const _runtimeMs = 0;
  try { writeCheckResult({ tool: 'run-account-manager-tlc', formalism: 'tla', result: 'fail', check_id: 'tla:account-manager', surface: 'tla', property: 'Account manager quorum state machine — MCAM correctness', runtime_ms: _runtimeMs, summary: 'fail: tla2tools.jar not found in ' + _runtimeMs + 'ms', requirement_ids: getRequirementIds('tla:account-manager'), metadata: {} }); } catch (e) { process.stderr.write('[run-account-manager-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 4. Invoke TLC ────────────────────────────────────────────────────────────
const specPath = path.join(ROOT, '.planning', 'formal', 'tla', 'NFAccountManager.tla');
const cfgPath  = path.join(ROOT, '.planning', 'formal', 'tla', configName + '.cfg');
// Use workers=1 for liveness (IdleReachable) — avoids multi-worker liveness bugs in TLC
const workers  = '1';

process.stdout.write('[run-account-manager-tlc] Config: ' + configName + '  Workers: ' + workers + '\n');
process.stdout.write('[run-account-manager-tlc] Spec:   ' + specPath + '\n');
process.stdout.write('[run-account-manager-tlc] Cfg:    ' + cfgPath + '\n');

const _startMs = Date.now();
process.stderr.write('[heap] Xms=64m Xmx=' + JAVA_HEAP_MAX + '\n');
const tlcResult = spawnSync(javaExe, [
  '-Xms64m', '-Xmx' + JAVA_HEAP_MAX,
  '-jar', jarPath,
  '-config', cfgPath,
  '-workers', workers,
  specPath,
], { encoding: 'utf8', stdio: 'inherit' });
const _runtimeMs = Date.now() - _startMs;

if (tlcResult.error) {
  process.stderr.write('[run-account-manager-tlc] TLC invocation failed: ' + tlcResult.error.message + '\n');
  try { writeCheckResult({ tool: 'run-account-manager-tlc', formalism: 'tla', result: 'fail', check_id: 'tla:account-manager', surface: 'tla', property: 'Account manager quorum state machine — MCAM correctness', runtime_ms: _runtimeMs, summary: 'fail: TLC invocation failed in ' + _runtimeMs + 'ms', requirement_ids: getRequirementIds('tla:account-manager'), metadata: {} }); } catch (e) { process.stderr.write('[run-account-manager-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

const passed = (tlcResult.status || 0) === 0;
const triage_tags = _runtimeMs > 120000 ? ['timeout-risk'] : [];

if (passed) {
  const missingDeclarations = detectLivenessProperties(configName, cfgPath);
  if (missingDeclarations.length > 0) {
    try {
      writeCheckResult({
        tool: 'run-account-manager-tlc',
        formalism: 'tla',
        result: 'inconclusive',
        check_id: 'tla:account-manager',
        surface: 'tla',
        property: 'Account manager quorum state machine — MCAM correctness',
        runtime_ms: _runtimeMs,
        summary: 'inconclusive: fairness missing in ' + _runtimeMs + 'ms',
        triage_tags: ['needs-fairness'],
        requirement_ids: getRequirementIds('tla:account-manager'),
        metadata: {
          config: configName,
          reason: 'Fairness declaration missing for: ' + missingDeclarations.join(', '),
        }
      });
    } catch (e) {
      process.stderr.write('[run-account-manager-tlc] Warning: failed to write inconclusive result: ' + e.message + '\n');
    }
    process.stdout.write('[run-account-manager-tlc] Result: inconclusive — fairness declaration missing for: ' + missingDeclarations.join(', ') + '\n');
    process.exit(0);
  }
  try { writeCheckResult({ tool: 'run-account-manager-tlc', formalism: 'tla', result: 'pass', check_id: 'tla:account-manager', surface: 'tla', property: 'Account manager quorum state machine — MCAM correctness', runtime_ms: _runtimeMs, summary: 'pass: ' + configName + ' in ' + _runtimeMs + 'ms', triage_tags: triage_tags, requirement_ids: getRequirementIds('tla:account-manager'), metadata: {} }); } catch (e) { process.stderr.write('[run-account-manager-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(0);
} else {
  try { writeCheckResult({ tool: 'run-account-manager-tlc', formalism: 'tla', result: 'fail', check_id: 'tla:account-manager', surface: 'tla', property: 'Account manager quorum state machine — MCAM correctness', runtime_ms: _runtimeMs, summary: 'fail: ' + configName + ' in ' + _runtimeMs + 'ms', triage_tags: triage_tags, requirement_ids: getRequirementIds('tla:account-manager'), metadata: {} }); } catch (e) { process.stderr.write('[run-account-manager-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(tlcResult.status || 0);
}
