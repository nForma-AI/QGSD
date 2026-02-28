#!/usr/bin/env node
'use strict';
// bin/run-installer-alloy.cjs
// Invokes Alloy 6 JAR headless for QGSD installer and taxonomy specs (GAP-7, GAP-8).
// Requirements: GAP-7, GAP-8
//
// Usage:
//   node bin/run-installer-alloy.cjs [--spec=<name>]
//
// Valid spec names:
//   install-scope   (default) — GAP-7: installer rollback soundness + config sync completeness
//   taxonomy-safety           — GAP-8: Haiku taxonomy injection safety + closed/open consistency
//
// Prerequisites:
//   - Java >=17 (https://adoptium.net/)
//   - formal/alloy/org.alloytools.alloy.dist.jar (see VERIFICATION_TOOLS.md for download)

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { writeCheckResult } = require('./write-check-result.cjs');

// ── 0. Parse --spec argument ──────────────────────────────────────────────────
const VALID_SPECS = ['install-scope', 'taxonomy-safety'];
const CHECK_ID_MAP = {
  'install-scope':   'alloy:install-scope',
  'taxonomy-safety': 'alloy:taxonomy-safety',
};
const PROPERTY_MAP = {
  'install-scope':   'Installer rollback soundness and config sync completeness',
  'taxonomy-safety': 'Taxonomy injection prevention and closed/open consistency',
};

const args    = process.argv.slice(2);
const specArg = args.find(a => a.startsWith('--spec=')) || null;
const specName = specArg
  ? specArg.split('=')[1]
  : (args.find(a => !a.startsWith('-')) || 'install-scope');

if (!VALID_SPECS.includes(specName)) {
  process.stderr.write(
    '[run-installer-alloy] Unknown spec: ' + specName +
    '. Valid: ' + VALID_SPECS.join(', ') + '\n'
  );
  const check_id = CHECK_ID_MAP[specName] || ('alloy:' + specName);
  try { writeCheckResult({ tool: 'run-installer-alloy', formalism: 'alloy', result: 'fail', check_id: check_id, surface: 'alloy', property: PROPERTY_MAP[specName] || specName, runtime_ms: 0, summary: 'fail: ' + check_id + ' (invalid spec)', triage_tags: [], metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-installer-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
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
      '[run-installer-alloy] JAVA_HOME is set but java binary not found at: ' + javaExe + '\n' +
      '[run-installer-alloy] Unset JAVA_HOME or fix the path.\n'
    );
    try { writeCheckResult({ tool: 'run-installer-alloy', formalism: 'alloy', result: 'fail', check_id: check_id, surface: 'alloy', property: property, runtime_ms: 0, summary: 'fail: ' + check_id + ' (Java not found)', triage_tags: [], metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-installer-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }
} else {
  // Fall back to PATH lookup
  const probe = spawnSync('java', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    process.stderr.write(
      '[run-installer-alloy] Java not found. Install Java >=17 and set JAVA_HOME.\n' +
      '[run-installer-alloy] Download: https://adoptium.net/\n'
    );
    try { writeCheckResult({ tool: 'run-installer-alloy', formalism: 'alloy', result: 'fail', check_id: check_id, surface: 'alloy', property: property, runtime_ms: 0, summary: 'fail: ' + check_id + ' (Java not found)', triage_tags: [], metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-installer-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }
  javaExe = 'java';
}

// ── 2. Check Java version >=17 ───────────────────────────────────────────────
const versionResult = spawnSync(javaExe, ['--version'], { encoding: 'utf8' });
if (versionResult.error || versionResult.status !== 0) {
  process.stderr.write('[run-installer-alloy] Failed to run: ' + javaExe + ' --version\n');
  try { writeCheckResult({ tool: 'run-installer-alloy', formalism: 'alloy', result: 'fail', check_id: check_id, surface: 'alloy', property: property, runtime_ms: 0, summary: 'fail: ' + check_id + ' (version check failed)', triage_tags: [], metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-installer-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}
const versionOutput = versionResult.stdout + versionResult.stderr;
// Java version string varies: "openjdk 17.0.1 ..." or "java version \"17.0.1\""
const versionMatch = versionOutput.match(/(?:openjdk\s+|java version\s+[""]?)(\d+)/i);
const javaMajor    = versionMatch ? parseInt(versionMatch[1], 10) : 0;
if (javaMajor < 17) {
  process.stderr.write(
    '[run-installer-alloy] Java >=17 required. Found: ' + versionOutput.split('\n')[0] + '\n' +
    '[run-installer-alloy] Download Java 17+: https://adoptium.net/\n'
  );
  try { writeCheckResult({ tool: 'run-installer-alloy', formalism: 'alloy', result: 'fail', check_id: check_id, surface: 'alloy', property: property, runtime_ms: 0, summary: 'fail: ' + check_id + ' (Java < 17)', triage_tags: [], metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-installer-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 3. Locate org.alloytools.alloy.dist.jar ──────────────────────────────────
const jarPath = path.join(__dirname, '..', 'formal', 'alloy', 'org.alloytools.alloy.dist.jar');
if (!fs.existsSync(jarPath)) {
  process.stderr.write(
    '[run-installer-alloy] org.alloytools.alloy.dist.jar not found at: ' + jarPath + '\n' +
    '[run-installer-alloy] Download Alloy 6.2.0:\n' +
    '  curl -L https://github.com/AlloyTools/org.alloytools.alloy/releases/download/v6.2.0/org.alloytools.alloy.dist.jar \\\n' +
    '       -o formal/alloy/org.alloytools.alloy.dist.jar\n'
  );
  try { writeCheckResult({ tool: 'run-installer-alloy', formalism: 'alloy', result: 'fail', check_id: check_id, surface: 'alloy', property: property, runtime_ms: 0, summary: 'fail: ' + check_id + ' (JAR not found)', triage_tags: [], metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-installer-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 4. Locate .als file ───────────────────────────────────────────────────────
const alsPath = path.join(__dirname, '..', 'formal', 'alloy', specName + '.als');
if (!fs.existsSync(alsPath)) {
  process.stderr.write(
    '[run-installer-alloy] ' + specName + '.als not found at: ' + alsPath + '\n' +
    '[run-installer-alloy] This file should exist in the repository. Check your git status.\n'
  );
  try { writeCheckResult({ tool: 'run-installer-alloy', formalism: 'alloy', result: 'fail', check_id: check_id, surface: 'alloy', property: property, runtime_ms: 0, summary: 'fail: ' + check_id + ' (ALS not found)', triage_tags: [], metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-installer-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 5. Invoke Alloy 6 ────────────────────────────────────────────────────────
process.stdout.write('[run-installer-alloy] spec: ' + specName + '\n');
process.stdout.write('[run-installer-alloy] ALS:  ' + alsPath + '\n');
process.stdout.write('[run-installer-alloy] JAR:  ' + jarPath + '\n');

const _startMs = Date.now();

// Use stdio: 'pipe' so we can scan stdout for counterexamples (Alloy exits 0 even on CEX)
const alloyResult = spawnSync(javaExe, [
  '-jar', jarPath,
  'exec',
  '--output', '-',
  '--type', 'text',
  '--quiet',
  alsPath,
], { encoding: 'utf8', stdio: 'pipe' });

if (alloyResult.error) {
  process.stderr.write('[run-installer-alloy] Alloy invocation failed: ' + alloyResult.error.message + '\n');
  const _runtimeMs = Date.now() - _startMs;
  try { writeCheckResult({ tool: 'run-installer-alloy', formalism: 'alloy', result: 'fail', check_id: check_id, surface: 'alloy', property: property, runtime_ms: _runtimeMs, summary: 'fail: ' + check_id + ' in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-installer-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
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
    '[run-installer-alloy] WARNING: Counterexample found in ' + specName + '.als assertion.\n' +
    '[run-installer-alloy] This indicates a spec violation — review formal/alloy/' + specName + '.als.\n'
  );
  const _runtimeMs = Date.now() - _startMs;
  try { writeCheckResult({ tool: 'run-installer-alloy', formalism: 'alloy', result: 'fail', check_id: check_id, surface: 'alloy', property: property, runtime_ms: _runtimeMs, summary: 'fail: ' + check_id + ' in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-installer-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 7. Propagate Alloy exit code ─────────────────────────────────────────────
if (alloyResult.status !== 0) {
  const _runtimeMs = Date.now() - _startMs;
  try { writeCheckResult({ tool: 'run-installer-alloy', formalism: 'alloy', result: 'fail', check_id: check_id, surface: 'alloy', property: property, runtime_ms: _runtimeMs, summary: 'fail: ' + check_id + ' in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-installer-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(alloyResult.status || 1);
}

const _runtimeMs = Date.now() - _startMs;
try { writeCheckResult({ tool: 'run-installer-alloy', formalism: 'alloy', result: 'pass', check_id: check_id, surface: 'alloy', property: property, runtime_ms: _runtimeMs, summary: 'pass: ' + check_id + ' in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], metadata: { spec: specName } }); } catch (e) { process.stderr.write('[run-installer-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
process.exit(0);
