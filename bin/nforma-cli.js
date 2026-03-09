#!/usr/bin/env node
'use strict';

/**
 * nforma-cli.js — Unified CLI entry point.
 *
 * Routes subcommands:
 *   npx @nforma.ai/nforma  → Always installer (npx = install intent)
 *   nforma                  → TUI (globally installed)
 *   nforma install [opts]   → Installer
 *   nforma tui              → TUI
 *   nforma --help           → Show usage
 *   nforma --version        → Show version
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const sub = process.argv[2];

/**
 * Detect if running via npx (temporary npm cache, not a persistent global install).
 * When users run `npx @nforma.ai/nforma`, they expect the installer.
 */
function isNpx() {
  // npx runs from ~/.npm/_npx/ cache
  if (__dirname.includes('_npx')) return true;
  // npm_execpath set by npm/npx but not by direct node invocation
  const execPath = process.env.npm_execpath || '';
  if (execPath.includes('npx')) return true;
  return false;
}

if (sub === 'install') {
  process.argv.splice(2, 1);
  require('./install.js');
} else if (sub === 'tui') {
  require('./nForma.cjs');
} else if (sub === '--version' || sub === '-v') {
  const pkg = require('../package.json');
  console.log(pkg.version);
} else if (sub === '--help' || sub === '-h') {
  const pkg = require('../package.json');
  console.log(`nforma v${pkg.version} — Quorum Gets Shit Done\n`);
  console.log('Usage:');
  console.log('  npx @nforma.ai/nforma  Run the installer');
  console.log('  nforma                 Open the TUI dashboard');
  console.log('  nforma install [opts]  Run the installer');
  console.log('  nforma tui             Open the TUI dashboard');
  console.log('  nforma --version       Show version');
  console.log('  nforma --help          Show this help');
} else {
  // npx → always installer; global install → TUI
  if (isNpx()) {
    require('./install.js');
  } else {
    require('./nForma.cjs');
  }
}
