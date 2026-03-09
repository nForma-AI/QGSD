#!/usr/bin/env node
'use strict';

/**
 * refresh-evidence.cjs — Lightweight evidence refresh from recent traces.
 *
 * Runs the 4 evidence generators in sequence to populate/update evidence files:
 *   1. trace-corpus-stats.cjs
 *   2. failure-taxonomy.cjs
 *   3. instrumentation-map.cjs
 *   4. state-candidates.cjs
 *
 * Fail-open: logs warnings but continues if any script fails.
 *
 * Usage:
 *   node bin/refresh-evidence.cjs          # human-readable summary
 *   node bin/refresh-evidence.cjs --json   # machine-readable JSON
 */

const { spawnSync } = require('child_process');
const path = require('path');

const TAG = '[refresh-evidence]';

const ROOT = (() => {
  const idx = process.argv.findIndex(a => a.startsWith('--project-root='));
  return idx >= 0 ? process.argv[idx].split('=')[1] : (process.env.PROJECT_ROOT || path.join(__dirname, '..'));
})();

const JSON_FLAG = process.argv.includes('--json');

const SCRIPTS = [
  'trace-corpus-stats.cjs',
  'failure-taxonomy.cjs',
  'instrumentation-map.cjs',
  'state-candidates.cjs',
];

function main() {
  const results = [];
  let refreshed = 0;
  let failed = 0;

  for (const script of SCRIPTS) {
    const scriptPath = path.join(__dirname, script);
    const start = Date.now();

    const result = spawnSync(process.execPath, [scriptPath, '--project-root=' + ROOT], {
      cwd: ROOT,
      timeout: 30000,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    const elapsed_ms = Date.now() - start;
    const ok = !result.error && result.status === 0;

    if (ok) {
      refreshed++;
    } else {
      failed++;
      const errMsg = result.error ? result.error.message : (result.stderr || '').trim().slice(0, 200);
      if (!JSON_FLAG) {
        process.stderr.write(TAG + ' WARNING: ' + script + ' failed: ' + errMsg + '\n');
      }
    }

    results.push({ name: script, ok, elapsed_ms });
  }

  const output = { refreshed, failed, scripts: results };

  if (JSON_FLAG) {
    process.stdout.write(JSON.stringify(output));
  } else {
    process.stdout.write(TAG + ' Evidence refresh complete: ' + refreshed + ' refreshed, ' + failed + ' failed\n');
    for (const r of results) {
      const mark = r.ok ? 'OK' : 'FAIL';
      process.stdout.write(TAG + '   ' + mark + ' ' + r.name + ' (' + r.elapsed_ms + 'ms)\n');
    }
  }
}

main();
