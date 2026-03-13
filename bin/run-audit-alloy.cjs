#!/usr/bin/env node
'use strict';
// bin/run-audit-alloy.cjs
// Invokes Alloy 6 JAR headless for nForma audit trail specs (GAP-3, GAP-9).
// Requirements: GAP-3, GAP-9
//
// Usage:
//   node bin/run-audit-alloy.cjs [--spec=<name>]
//
// Valid spec names:
//   scoreboard-recompute  (default) — GAP-3: recomputation idempotency invariants
//   availability-parsing             — GAP-9: date arithmetic invariants
//
// Prerequisites:
//   - Java >=17 (https://adoptium.net/)
//   - .planning/formal/alloy/org.alloytools.alloy.dist.jar (see VERIFICATION_TOOLS.md for download)

const { spawnSync } = require('child_process');
const JAVA_HEAP_MAX = process.env.NF_JAVA_HEAP_MAX || '512m';
const fs   = require('fs');
const path = require('path');
const { writeCheckResult } = require('./write-check-result.cjs');
const { getRequirementIds } = require('./requirement-map.cjs');
const { resolveAlloyJar } = require('./resolve-formal-tools.cjs');

// ── Resolve project root (--project-root= overrides __dirname-relative) ─────
let ROOT = path.join(__dirname, '..');
for (const arg of process.argv) {
  if (arg.startsWith('--project-root=')) ROOT = path.resolve(arg.slice('--project-root='.length));
}

// ── 0. Parse --spec argument ──────────────────────────────────────────────────
const VALID_SPECS = ['scoreboard-recompute', 'availability-parsing'];
const CHECK_ID_MAP = {
  'scoreboard-recompute': 'alloy:scoreboard',
  'availability-parsing': 'alloy:availability',
};
const PROPERTY_MAP = {
  'scoreboard-recompute': 'Scoreboard idempotency — no vote loss, no double counting',
  'availability-parsing': 'Availability hint date arithmetic correctness',
};

const args    = process.argv.slice(2);
const specArg = args.find(a => a.startsWith('--spec=')) || null;
const specName = specArg
  ? specArg.split('=')[1]
  : (args.find(a => !a.startsWith('-')) || 'scoreboard-recompute');

if (!VALID_SPECS.includes(specName)) {
  process.stderr.write(
    '[run-audit-alloy] Unknown spec: ' + specName +
    '. Valid: ' + VALID_SPECS.join(', ') + '\n'
  );
  const check_id = CHECK_ID_MAP[specName] || ('alloy:' + specName);
  try { writeCheckResult({ tool: 'run-audit-alloy', formalism: 'alloy', result: 'error', check_id: check_id, surface: 'alloy', property: PROPERTY_MAP[specName] || specName, runtime_ms: 0, summary: 'error: ' + check_id + ' (invalid spec)', triage_tags: [], requirement_ids: getRequirementIds(check_id), metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-audit-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 1. Locate Java ───────────────────────────────────────────────────────────
const JAVA_HOME = process.env.JAVA_HOME;
let javaExe;

const check_id = CHECK_ID_MAP[specName];
const property = PROPERTY_MAP[specName];

if (JAVA_HOME) {
  javaExe = path.join(JAVA_HOME, 'bin', 'java');
  if (!fs.existsSync(javaExe)) {
    process.stderr.write(
      '[run-audit-alloy] JAVA_HOME is set but java binary not found at: ' + javaExe + '\n' +
      '[run-audit-alloy] Unset JAVA_HOME or fix the path.\n'
    );
    try { writeCheckResult({ tool: 'run-audit-alloy', formalism: 'alloy', result: 'error', check_id: check_id, surface: 'alloy', property: property, runtime_ms: 0, summary: 'error: ' + check_id + ' (Java not found)', triage_tags: [], requirement_ids: getRequirementIds(check_id), metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-audit-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }
} else {
  // Fall back to PATH lookup
  const probe = spawnSync('java', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    process.stderr.write(
      '[run-audit-alloy] Java not found. Install Java >=17 and set JAVA_HOME.\n' +
      '[run-audit-alloy] Download: https://adoptium.net/\n'
    );
    try { writeCheckResult({ tool: 'run-audit-alloy', formalism: 'alloy', result: 'error', check_id: check_id, surface: 'alloy', property: property, runtime_ms: 0, summary: 'error: ' + check_id + ' (Java not found)', triage_tags: [], requirement_ids: getRequirementIds(check_id), metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-audit-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }
  javaExe = 'java';
}

// ── 2. Check Java version >=17 ───────────────────────────────────────────────
const versionResult = spawnSync(javaExe, ['--version'], { encoding: 'utf8' });
if (versionResult.error || versionResult.status !== 0) {
  process.stderr.write('[run-audit-alloy] Failed to run: ' + javaExe + ' --version\n');
  try { writeCheckResult({ tool: 'run-audit-alloy', formalism: 'alloy', result: 'error', check_id: check_id, surface: 'alloy', property: property, runtime_ms: 0, summary: 'error: ' + check_id + ' (version check failed)', triage_tags: [], requirement_ids: getRequirementIds(check_id), metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-audit-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}
const versionOutput = versionResult.stdout + versionResult.stderr;
// Java version string varies: "openjdk 17.0.1 ..." or "java version \"17.0.1\""
const versionMatch = versionOutput.match(/(?:openjdk\s+|java version\s+[""]?)(\d+)/i);
const javaMajor    = versionMatch ? parseInt(versionMatch[1], 10) : 0;
if (javaMajor < 17) {
  process.stderr.write(
    '[run-audit-alloy] Java >=17 required. Found: ' + versionOutput.split('\n')[0] + '\n' +
    '[run-audit-alloy] Download Java 17+: https://adoptium.net/\n'
  );
  try { writeCheckResult({ tool: 'run-audit-alloy', formalism: 'alloy', result: 'error', check_id: check_id, surface: 'alloy', property: property, runtime_ms: 0, summary: 'error: ' + check_id + ' (Java < 17)', triage_tags: [], requirement_ids: getRequirementIds(check_id), metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-audit-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 3. Locate org.alloytools.alloy.dist.jar ──────────────────────────────────
const jarPath = resolveAlloyJar(ROOT);
if (!jarPath) {
  process.stderr.write(
    '[run-audit-alloy] org.alloytools.alloy.dist.jar not found.\n' +
    '[run-audit-alloy] Install: node bin/install-formal-tools.cjs\n'
  );
  try { writeCheckResult({ tool: 'run-audit-alloy', formalism: 'alloy', result: 'error', check_id: check_id, surface: 'alloy', property: property, runtime_ms: 0, summary: 'error: ' + check_id + ' (JAR not found)', triage_tags: [], requirement_ids: getRequirementIds(check_id), metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-audit-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 4. Locate .als file ───────────────────────────────────────────────────────
const alsPath = path.join(ROOT, '.planning', 'formal', 'alloy', specName + '.als');
if (!fs.existsSync(alsPath)) {
  process.stderr.write(
    '[run-audit-alloy] ' + specName + '.als not found at: ' + alsPath + '\n' +
    '[run-audit-alloy] This file should exist in the repository. Check your git status.\n'
  );
  try { writeCheckResult({ tool: 'run-audit-alloy', formalism: 'alloy', result: 'error', check_id: check_id, surface: 'alloy', property: property, runtime_ms: 0, summary: 'error: ' + check_id + ' (ALS not found)', triage_tags: [], requirement_ids: getRequirementIds(check_id), metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-audit-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 5. Invoke Alloy 6 ────────────────────────────────────────────────────────
process.stdout.write('[run-audit-alloy] spec: ' + specName + '\n');
process.stdout.write('[run-audit-alloy] ALS:  ' + alsPath + '\n');
process.stdout.write('[run-audit-alloy] JAR:  ' + jarPath + '\n');

const _startMs = Date.now();

// Use stdio: 'pipe' so we can scan stdout for counterexamples (Alloy exits 0 even on CEX)
process.stderr.write('[heap] Xms=64m Xmx=' + JAVA_HEAP_MAX + '\n');
const alloyResult = spawnSync(javaExe, [
  '-Djava.awt.headless=true',
  '-Xms64m', '-Xmx' + JAVA_HEAP_MAX,
  '-jar', jarPath,
  'exec',
  '--output', '-',
  '--type', 'text',
  '--quiet',
  alsPath,
], { encoding: 'utf8', stdio: 'pipe' });

if (alloyResult.error) {
  process.stderr.write('[run-audit-alloy] Alloy invocation failed: ' + alloyResult.error.message + '\n');
  const _runtimeMs = Date.now() - _startMs;
  try { writeCheckResult({ tool: 'run-audit-alloy', formalism: 'alloy', result: 'fail', check_id: check_id, surface: 'alloy', property: property, runtime_ms: _runtimeMs, summary: 'fail: ' + check_id + ' in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], requirement_ids: getRequirementIds(check_id), metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-audit-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 6. Scan stdout for counterexamples ───────────────────────────────────────
// Alloy 6 exits 0 even when counterexamples are found. Scan stdout to detect them.
const stdout = alloyResult.stdout || '';
const stderr = alloyResult.stderr || '';

// Write stdout to process.stdout (mirrors stdio: 'inherit' output)
if (stdout) { process.stdout.write(stdout); }
if (stderr) { process.stderr.write(stderr); }

if (/Counterexample/i.test(stdout)) {
  process.stderr.write(
    '[run-audit-alloy] WARNING: Counterexample found in ' + specName + '.als assertion.\n' +
    '[run-audit-alloy] This indicates a spec violation — review .planning/formal/alloy/' + specName + '.als.\n'
  );
  const _runtimeMs = Date.now() - _startMs;
  try { writeCheckResult({ tool: 'run-audit-alloy', formalism: 'alloy', result: 'fail', check_id: check_id, surface: 'alloy', property: property, runtime_ms: _runtimeMs, summary: 'fail: ' + check_id + ' in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], requirement_ids: getRequirementIds(check_id), metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-audit-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

if (alloyResult.status !== 0) {
  const _runtimeMs = Date.now() - _startMs;
  try { writeCheckResult({ tool: 'run-audit-alloy', formalism: 'alloy', result: 'fail', check_id: check_id, surface: 'alloy', property: property, runtime_ms: _runtimeMs, summary: 'fail: ' + check_id + ' in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], requirement_ids: getRequirementIds(check_id), metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-audit-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(alloyResult.status || 1);
}

const _runtimeMs = Date.now() - _startMs;
try { writeCheckResult({ tool: 'run-audit-alloy', formalism: 'alloy', result: 'pass', check_id: check_id, surface: 'alloy', property: property, runtime_ms: _runtimeMs, summary: 'pass: ' + check_id + ' in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], requirement_ids: getRequirementIds(check_id), metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-audit-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
process.exit(0);
