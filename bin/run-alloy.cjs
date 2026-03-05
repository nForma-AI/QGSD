#!/usr/bin/env node
'use strict';
// bin/run-alloy.cjs
// Invokes Alloy 6 JAR headless for the QGSD vote-counting model.
// Requirements: ALY-02
//
// Usage:
//   node bin/run-alloy.cjs
//
// Prerequisites:
//   - Java >=17 (https://adoptium.net/)
//   - .planning/formal/alloy/org.alloytools.alloy.dist.jar (see VERIFICATION_TOOLS.md for download)

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { writeCheckResult } = require('./write-check-result.cjs');
const { getRequirementIds } = require('./requirement-map.cjs');

// ── Resolve project root (--project-root= overrides __dirname-relative) ─────
let ROOT = path.join(__dirname, '..');
for (const arg of process.argv) {
  if (arg.startsWith('--project-root=')) ROOT = path.resolve(arg.slice('--project-root='.length));
}

// ── 1. Locate Java ───────────────────────────────────────────────────────────
const JAVA_HOME = process.env.JAVA_HOME;
let javaExe;

if (JAVA_HOME) {
  javaExe = path.join(JAVA_HOME, 'bin', 'java');
  if (!fs.existsSync(javaExe)) {
    process.stderr.write(
      '[run-alloy] JAVA_HOME is set but java binary not found at: ' + javaExe + '\n' +
      '[run-alloy] Unset JAVA_HOME or fix the path.\n'
    );
    try { writeCheckResult({ tool: 'run-alloy', formalism: 'alloy', result: 'fail', check_id: 'alloy:quorum-votes', surface: 'alloy', property: 'Vote counting correctness — no vote loss, no double counting, unanimous agreement invariants', runtime_ms: 0, summary: 'fail: alloy:quorum-votes (Java not found)', triage_tags: [], requirement_ids: getRequirementIds('alloy:quorum-votes'), metadata: {} }); } catch (e) { process.stderr.write('[run-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }
} else {
  // Fall back to PATH lookup
  const probe = spawnSync('java', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    process.stderr.write(
      '[run-alloy] Java not found. Install Java >=17 and set JAVA_HOME.\n' +
      '[run-alloy] Download: https://adoptium.net/\n'
    );
    try { writeCheckResult({ tool: 'run-alloy', formalism: 'alloy', result: 'fail', check_id: 'alloy:quorum-votes', surface: 'alloy', property: 'Vote counting correctness — no vote loss, no double counting, unanimous agreement invariants', runtime_ms: 0, summary: 'fail: alloy:quorum-votes (Java not found)', triage_tags: [], requirement_ids: getRequirementIds('alloy:quorum-votes'), metadata: {} }); } catch (e) { process.stderr.write('[run-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }
  javaExe = 'java';
}

// ── 2. Check Java version >=17 ───────────────────────────────────────────────
const versionResult = spawnSync(javaExe, ['--version'], { encoding: 'utf8' });
if (versionResult.error || versionResult.status !== 0) {
  process.stderr.write('[run-alloy] Failed to run: ' + javaExe + ' --version\n');
  try { writeCheckResult({ tool: 'run-alloy', formalism: 'alloy', result: 'fail', check_id: 'alloy:quorum-votes', surface: 'alloy', property: 'Vote counting correctness — no vote loss, no double counting, unanimous agreement invariants', runtime_ms: 0, summary: 'fail: alloy:quorum-votes (version check failed)', triage_tags: [], requirement_ids: getRequirementIds('alloy:quorum-votes'), metadata: {} }); } catch (e) { process.stderr.write('[run-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}
const versionOutput = versionResult.stdout + versionResult.stderr;
// Java version string varies: "openjdk 17.0.1 ..." or "java version \"17.0.1\""
const versionMatch = versionOutput.match(/(?:openjdk\s+|java version\s+[""]?)(\d+)/i);
const javaMajor    = versionMatch ? parseInt(versionMatch[1], 10) : 0;
if (javaMajor < 17) {
  process.stderr.write(
    '[run-alloy] Java >=17 required. Found: ' + versionOutput.split('\n')[0] + '\n' +
    '[run-alloy] Download Java 17+: https://adoptium.net/\n'
  );
  try { writeCheckResult({ tool: 'run-alloy', formalism: 'alloy', result: 'fail', check_id: 'alloy:quorum-votes', surface: 'alloy', property: 'Vote counting correctness — no vote loss, no double counting, unanimous agreement invariants', runtime_ms: 0, summary: 'fail: alloy:quorum-votes (Java < 17)', triage_tags: [], requirement_ids: getRequirementIds('alloy:quorum-votes'), metadata: {} }); } catch (e) { process.stderr.write('[run-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 3. Locate org.alloytools.alloy.dist.jar ──────────────────────────────────
const jarPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'org.alloytools.alloy.dist.jar');
if (!fs.existsSync(jarPath)) {
  process.stderr.write(
    '[run-alloy] org.alloytools.alloy.dist.jar not found at: ' + jarPath + '\n' +
    '[run-alloy] Download Alloy 6.2.0:\n' +
    '  curl -L https://github.com/AlloyTools/org.alloytools.alloy/releases/download/v6.2.0/org.alloytools.alloy.dist.jar \\\n' +
    '       -o .planning/formal/alloy/org.alloytools.alloy.dist.jar\n'
  );
  try { writeCheckResult({ tool: 'run-alloy', formalism: 'alloy', result: 'fail', check_id: 'alloy:quorum-votes', surface: 'alloy', property: 'Vote counting correctness — no vote loss, no double counting, unanimous agreement invariants', runtime_ms: 0, summary: 'fail: alloy:quorum-votes (JAR not found)', triage_tags: [], requirement_ids: getRequirementIds('alloy:quorum-votes'), metadata: {} }); } catch (e) { process.stderr.write('[run-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 4. Locate .planning/formal/alloy/quorum-votes.als ──────────────────────────────────
const alsPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'quorum-votes.als');
if (!fs.existsSync(alsPath)) {
  process.stderr.write(
    '[run-alloy] quorum-votes.als not found at: ' + alsPath + '\n' +
    '[run-alloy] This file should exist in the repository. Check your git status.\n'
  );
  try { writeCheckResult({ tool: 'run-alloy', formalism: 'alloy', result: 'fail', check_id: 'alloy:quorum-votes', surface: 'alloy', property: 'Vote counting correctness — no vote loss, no double counting, unanimous agreement invariants', runtime_ms: 0, summary: 'fail: alloy:quorum-votes (ALS not found)', triage_tags: [], requirement_ids: getRequirementIds('alloy:quorum-votes'), metadata: {} }); } catch (e) { process.stderr.write('[run-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 5. Invoke Alloy 6 ────────────────────────────────────────────────────────
process.stdout.write('[run-alloy] ALS: ' + alsPath + '\n');
process.stdout.write('[run-alloy] JAR: ' + jarPath + '\n');

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
  process.stderr.write('[run-alloy] Alloy invocation failed: ' + alloyResult.error.message + '\n');
  const _runtimeMs = Date.now() - _startMs;
  try { writeCheckResult({ tool: 'run-alloy', formalism: 'alloy', result: 'fail', check_id: 'alloy:quorum-votes', surface: 'alloy', property: 'Vote counting correctness — no vote loss, no double counting, unanimous agreement invariants', runtime_ms: _runtimeMs, summary: 'fail: alloy:quorum-votes in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], requirement_ids: getRequirementIds('alloy:quorum-votes'), metadata: {} }); } catch (e) { process.stderr.write('[run-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
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
    '[run-alloy] WARNING: Counterexample found in quorum-votes.als assertions\n' +
    '[run-alloy] (ThresholdPasses / BelowThresholdFails / ZeroApprovalsFail).\n' +
    '[run-alloy] This indicates a spec violation — review quorum-votes.als.\n'
  );
  const _runtimeMs = Date.now() - _startMs;
  try { writeCheckResult({ tool: 'run-alloy', formalism: 'alloy', result: 'fail', check_id: 'alloy:quorum-votes', surface: 'alloy', property: 'Vote counting correctness — no vote loss, no double counting, unanimous agreement invariants', runtime_ms: _runtimeMs, summary: 'fail: alloy:quorum-votes in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], requirement_ids: getRequirementIds('alloy:quorum-votes'), metadata: {} }); } catch (e) { process.stderr.write('[run-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

if (alloyResult.status !== 0) {
  const _runtimeMs = Date.now() - _startMs;
  try { writeCheckResult({ tool: 'run-alloy', formalism: 'alloy', result: 'fail', check_id: 'alloy:quorum-votes', surface: 'alloy', property: 'Vote counting correctness — no vote loss, no double counting, unanimous agreement invariants', runtime_ms: _runtimeMs, summary: 'fail: alloy:quorum-votes in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], requirement_ids: getRequirementIds('alloy:quorum-votes'), metadata: {} }); } catch (e) { process.stderr.write('[run-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(alloyResult.status || 1);
}

const _runtimeMs = Date.now() - _startMs;
try { writeCheckResult({ tool: 'run-alloy', formalism: 'alloy', result: 'pass', check_id: 'alloy:quorum-votes', surface: 'alloy', property: 'Vote counting correctness — no vote loss, no double counting, unanimous agreement invariants', runtime_ms: _runtimeMs, summary: 'pass: alloy:quorum-votes in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], requirement_ids: getRequirementIds('alloy:quorum-votes'), metadata: {} }); } catch (e) { process.stderr.write('[run-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
process.exit(0);
