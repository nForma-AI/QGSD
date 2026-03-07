#!/usr/bin/env node
'use strict';
/**
 * check-tui-assets-stale.cjs
 *
 * CI staleness check: regenerates TUI SVGs to a temp dir, compares against
 * docs/assets/tui-*.svg, exits 1 if any differ. Zero side effects on the repo.
 *
 * Usage: node bin/check-tui-assets-stale.cjs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const MODULE_NAMES = ['agents', 'reqs', 'config', 'sessions'];
const ASSETS_DIR = path.join(__dirname, '..', 'docs', 'assets');

function hashFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (_) {
    return null;
  }
}

function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-tui-check-'));
  const { ansiToSvg } = require('./generate-tui-assets.cjs');
  const stale = [];
  const missing = [];

  for (const name of MODULE_NAMES) {
    // Generate fresh screenshot
    const result = spawnSync('node', [path.join(__dirname, 'nForma.cjs'), '--screenshot', name], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    if (result.error || result.status !== 0) {
      process.stderr.write(`Warning: failed to capture ${name}: ${result.error || result.stderr || 'exit ' + result.status}\n`);
      continue;
    }

    const titleName = name.charAt(0).toUpperCase() + name.slice(1);
    const freshSvg = ansiToSvg(result.stdout, `nForma - ${titleName}`);
    const tmpPath = path.join(tmpDir, `tui-${name}.svg`);
    fs.writeFileSync(tmpPath, freshSvg, 'utf8');

    // Compare with existing
    const existingPath = path.join(ASSETS_DIR, `tui-${name}.svg`);
    const freshHash = hashFile(tmpPath);
    const existingHash = hashFile(existingPath);

    if (!existingHash) {
      missing.push(name);
    } else if (freshHash !== existingHash) {
      stale.push(name);
    }
  }

  // Cleanup temp dir
  try {
    for (const f of fs.readdirSync(tmpDir)) fs.unlinkSync(path.join(tmpDir, f));
    fs.rmdirSync(tmpDir);
  } catch (_) {}

  if (missing.length === 0 && stale.length === 0) {
    console.log('TUI assets up-to-date.');
    process.exit(0);
  }

  if (missing.length > 0) {
    console.error(`Missing TUI assets: ${missing.map(n => `tui-${n}.svg`).join(', ')}`);
  }
  if (stale.length > 0) {
    console.error(`Stale TUI assets: ${stale.map(n => `tui-${n}.svg`).join(', ')}`);
  }
  console.error('\nRun: npm run assets:tui');
  process.exit(1);
}

main();
