#!/usr/bin/env node
'use strict';
// bin/run-prism.cjs
// Invokes PRISM model checker against formal/prism/quorum.pm.
// Requirements: PRM-01
//
// Usage:
//   node bin/run-prism.cjs                         # default: P=? [ F s=1 ]
//   node bin/run-prism.cjs -pf "P=? [ F s=1 ]"    # explicit property
//   node bin/run-prism.cjs -const tp_rate=0.9274 -const unavail=0.0215
//
// Prerequisites:
//   - PRISM 4.x installed; set PRISM_BIN to path of the prism shell script
//     e.g. export PRISM_BIN="$HOME/prism/bin/prism"
//   - Java >=17 (same JRE used by TLA+/Alloy CI step)
//
// CI: PRISM_BIN is set by the formal-verify workflow step that extracts the
//     Linux binary tarball.

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { writeCheckResult } = require('./write-check-result.cjs');

// ── Locate PRISM binary ──────────────────────────────────────────────────────
const prismBin = process.env.PRISM_BIN || 'prism';

// Verify the binary exists (skip check if it's just 'prism' on PATH)
if (prismBin !== 'prism' && !fs.existsSync(prismBin)) {
  process.stderr.write(
    '[run-prism] PRISM binary not found at: ' + prismBin + '\n' +
    '[run-prism] Install PRISM and set PRISM_BIN env var:\n' +
    '[run-prism]   export PRISM_BIN="$HOME/prism/bin/prism"\n' +
    '[run-prism] Download: https://www.prismmodelchecker.org/download.php\n'
  );
  try { writeCheckResult({ tool: 'run-prism', formalism: 'prism', result: 'fail', metadata: {} }); } catch (e) { process.stderr.write('[run-prism] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── Locate model file ────────────────────────────────────────────────────────
const modelPath = path.join(__dirname, '..', 'formal', 'prism', 'quorum.pm');
if (!fs.existsSync(modelPath)) {
  process.stderr.write(
    '[run-prism] Model file not found: ' + modelPath + '\n'
  );
  try { writeCheckResult({ tool: 'run-prism', formalism: 'prism', result: 'fail', metadata: {} }); } catch (e) { process.stderr.write('[run-prism] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── Read scoreboard for empirical tp_rate / unavail injection (PRISM-02) ────
// Uses process.cwd()/.planning/quorum-scoreboard.json so tests can point to
// a fixture by spawning with a custom cwd (same pattern as run-formal-verify).
const PRISM_PRIOR_TP     = 0.85;
const PRISM_PRIOR_UNAVAIL = 0.15;
let liveTPRate    = null;
let liveUnavail   = null;
const scoreboardPath = path.join(process.cwd(), '.planning', 'quorum-scoreboard.json');
if (fs.existsSync(scoreboardPath)) {
  try {
    const sb = JSON.parse(fs.readFileSync(scoreboardPath, 'utf8'));
    const rounds = Array.isArray(sb.rounds) ? sb.rounds : [];
    // Aggregate TP and UNAVAIL counts across all slots (excluding 'claude')
    let totalVotes = 0;
    let tpCount    = 0;
    let unavailCount = 0;
    for (const round of rounds) {
      const votes = round.votes || {};
      for (const [slot, code] of Object.entries(votes)) {
        if (slot === 'claude') continue;  // exclude self
        totalVotes++;
        if (code === 'TP' || code === 'TP+' || code === 'TN' || code === 'TN+') tpCount++;
        if (code === 'UNAVAIL') unavailCount++;
      }
    }
    if (totalVotes > 0) {
      liveTPRate  = Math.round((tpCount    / totalVotes) * 1e6) / 1e6;
      liveUnavail = Math.round((unavailCount / totalVotes) * 1e6) / 1e6;
      process.stdout.write(
        '[run-prism] Injected from scoreboard: tp_rate=' + liveTPRate +
        ' unavail=' + liveUnavail + ' (' + rounds.length + ' rounds)\n'
      );
    }
  } catch (_) { /* malformed scoreboard — fall through to priors */ }
}
if (liveTPRate === null) {
  liveTPRate    = PRISM_PRIOR_TP;
  liveUnavail   = PRISM_PRIOR_UNAVAIL;
  process.stderr.write(
    '[run-prism] No scoreboard found — using conservative priors: ' +
    'tp_rate=' + PRISM_PRIOR_TP + ' unavail=' + PRISM_PRIOR_UNAVAIL + '\n'
  );
}

// ── Build argument list ──────────────────────────────────────────────────────
// Extra args passed to this script are forwarded to PRISM after the model path.
// If formal/prism/quorum.props exists, pass it as the properties file (runs all 4 properties).
// Otherwise fall back to: -pf "P=? [ F s=1 ]"
const extraArgs = process.argv.slice(2);
const hasPf    = extraArgs.some(a => a === '-pf' || a === '-prop');
const propsFile = path.join(__dirname, '..', 'formal', 'prism', 'quorum.props');
const hasProps  = !hasPf && fs.existsSync(propsFile);

// Determine if caller already overrides tp_rate or unavail
const callerOverridesTP     = extraArgs.some((a, i) => a === '-const' && (extraArgs[i + 1] || '').startsWith('tp_rate='));
const callerOverridesUnavail = extraArgs.some((a, i) => a === '-const' && (extraArgs[i + 1] || '').startsWith('unavail='));

const prismArgs = [modelPath];
if (hasProps) {
  prismArgs.push(propsFile);
} else if (!hasPf) {
  prismArgs.push('-pf', 'P=? [ F s=1 ]');
}
// Inject empirical/prior rates unless caller overrides
if (!callerOverridesTP) {
  prismArgs.push('-const', 'tp_rate=' + liveTPRate);
}
if (!callerOverridesUnavail) {
  prismArgs.push('-const', 'unavail=' + liveUnavail);
}
prismArgs.push(...extraArgs);

process.stdout.write('[run-prism] Binary: ' + prismBin + '\n');
process.stdout.write('[run-prism] Model:  ' + modelPath + '\n');
process.stdout.write('[run-prism] Args:   ' + prismArgs.slice(1).join(' ') + '\n');

// ── Invoke PRISM ─────────────────────────────────────────────────────────────
const result = spawnSync(prismBin, prismArgs, {
  encoding: 'utf8',
  stdio: 'inherit',
});

if (result.error) {
  process.stderr.write('[run-prism] Failed to launch PRISM: ' + result.error.message + '\n');
  try { writeCheckResult({ tool: 'run-prism', formalism: 'prism', result: 'fail', metadata: {} }); } catch (e) { process.stderr.write('[run-prism] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

const passed = (result.status || 0) === 0;
try { writeCheckResult({ tool: 'run-prism', formalism: 'prism', result: passed ? 'pass' : 'fail', metadata: {} }); } catch (e) { process.stderr.write('[run-prism] Warning: failed to write check result: ' + e.message + '\n'); }
process.exit(result.status || 0);
