#!/usr/bin/env node
'use strict';
// bin/resolve-formal-tools.cjs
// Centralized resolution of formal verification tool binaries.
// All runners should use these helpers instead of hardcoding paths.
//
// Resolution order (consistent across all tools):
//   1. Environment variable override (VERIFYTA_BIN, PRISM_BIN, etc.)
//   2. System-wide install: ~/.local/share/nf-formal/
//   3. Project-local (legacy): .planning/formal/
//   4. Legacy ~/.claude/ fallback (Alloy only)
//   5. PATH lookup (UPPAAL only)

const fs = require('fs');
const path = require('path');
const os = require('os');

const NF_FORMAL_HOME = path.join(os.homedir(), '.local', 'share', 'nf-formal');

/**
 * Resolve TLA+ tla2tools.jar.
 * @param {string} [projectRoot] - Project root directory (defaults to __dirname/..)
 * @returns {string|null} Absolute path to tla2tools.jar, or null if not found.
 */
function resolveTlaJar(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..');
  const candidates = [
    path.join(NF_FORMAL_HOME, 'tla', 'tla2tools.jar'),
    path.join(root, '.planning', 'formal', 'tla', 'tla2tools.jar'),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

/**
 * Resolve Alloy org.alloytools.alloy.dist.jar.
 * @param {string} [projectRoot] - Project root directory (defaults to __dirname/..)
 * @returns {string|null} Absolute path to Alloy JAR, or null if not found.
 */
function resolveAlloyJar(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..');
  const candidates = [
    path.join(NF_FORMAL_HOME, 'alloy', 'org.alloytools.alloy.dist.jar'),
    path.join(root, '.planning', 'formal', 'alloy', 'org.alloytools.alloy.dist.jar'),
    path.join(os.homedir(), '.claude', '.planning', 'formal', 'alloy', 'org.alloytools.alloy.dist.jar'),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

/**
 * Resolve UPPAAL verifyta binary.
 * @param {string} [projectRoot] - Project root directory (defaults to __dirname/..)
 * @returns {string|null} Absolute path to verifyta, or null if not found.
 */
function resolveVerifyta(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..');

  // 1. Env var override
  const envBin = process.env.VERIFYTA_BIN;
  if (envBin && fs.existsSync(envBin)) return envBin;

  // 2. System-wide
  const systemPath = path.join(NF_FORMAL_HOME, 'uppaal', 'bin', 'verifyta');
  if (fs.existsSync(systemPath)) return systemPath;

  // 3. Project-local (legacy)
  const localPath = path.join(root, '.planning', 'formal', 'uppaal', 'bin', 'verifyta');
  if (fs.existsSync(localPath)) return localPath;

  // 4. PATH lookup
  try {
    const { spawnSync } = require('child_process');
    const which = spawnSync('which', ['verifyta'], { encoding: 'utf8' });
    if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  } catch (_) { /* fail-open */ }

  return null;
}

module.exports = { resolveTlaJar, resolveAlloyJar, resolveVerifyta, NF_FORMAL_HOME };
