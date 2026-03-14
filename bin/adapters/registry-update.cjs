'use strict';
// bin/adapters/registry-update.cjs
// Shared updateModelRegistry extracted from generate-formal-specs.cjs.
// Updates .planning/formal/model-registry.json after each spec write.

const fs   = require('fs');
const path = require('path');

/**
 * Update model registry with a new or updated spec file.
 * @param {string} absPath - absolute path to the spec file
 * @param {Object} [options]
 * @param {boolean} [options.dry] - if true, skip update
 * @param {string} [options.projectRoot] - repo root directory
 */
function updateModelRegistry(absPath, options = {}) {
  const { dry = false, projectRoot = path.join(__dirname, '..', '..') } = options;

  if (dry) return; // dry-run: skip registry update

  const registryPath = path.join(projectRoot, '.planning', 'formal', 'model-registry.json');
  if (!fs.existsSync(registryPath)) {
    process.stderr.write('[update-model-registry] Skipping registry update: .planning/formal/model-registry.json not yet initialized\n');
    return;
  }

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (err) {
    process.stderr.write('[update-model-registry] Cannot parse registry: ' + err.message + '\n');
    return;
  }

  if (!registry.models) registry.models = {}; // guard: handles corrupted registry

  const key = path.relative(projectRoot, absPath).replace(/\\/g, '/');
  const now = new Date().toISOString();
  const existing = registry.models[key] || {};
  registry.models[key] = {
    version: (existing.version || 0) + 1,
    last_updated: now,
    update_source: 'generate',
    source_id: 'generate:formal-specs',
    session_id: null,
    description: existing.description || ''
  };
  registry.last_sync = now;

  // Atomic write: tmp file + rename
  const tmpPath = registryPath + '.tmp.' + Date.now() + '.' + Math.random().toString(36).slice(2);
  fs.writeFileSync(tmpPath, JSON.stringify(registry, null, 2), 'utf8');
  fs.renameSync(tmpPath, registryPath);
}

module.exports = { updateModelRegistry };
