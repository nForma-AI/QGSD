#!/usr/bin/env node
// hooks/config-loader.js
// Shared two-layer config loader with validation and stderr-only warnings.
//
// Exports: loadConfig(projectDir?), DEFAULT_CONFIG
//
// Load order: DEFAULT_CONFIG → ~/.claude/qgsd.json (global) → .claude/qgsd.json in projectDir (project)
// Merge: shallow spread — project values fully replace global values for any overlapping key.
// Warnings: all written to process.stderr — stdout is never touched (it is the hook decision channel).

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_CONFIG = {
  quorum_commands: [
    'plan-phase', 'new-project', 'new-milestone',
    'discuss-phase', 'verify-work', 'research-phase',
  ],
  fail_mode: 'open',
  required_models: {
    codex:    { tool_prefix: 'mcp__codex-cli__',  required: true },
    gemini:   { tool_prefix: 'mcp__gemini-cli__', required: true },
    opencode: { tool_prefix: 'mcp__opencode__',   required: true },
  },
};

// Reads and parses a JSON config file.
// Returns the parsed object on success.
// Returns null silently if the file does not exist.
// Returns null with a stderr warning if the file is malformed.
function readConfigFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    process.stderr.write('[qgsd] WARNING: Malformed config at ' + filePath + ': ' + e.message + '\n');
    return null;
  }
}

// Validates config fields in-place.
// Corrects invalid fields to DEFAULT_CONFIG values and emits a stderr warning for each.
// Returns the (possibly corrected) config object.
function validateConfig(config) {
  if (!Array.isArray(config.quorum_commands)) {
    process.stderr.write('[qgsd] WARNING: qgsd.json: quorum_commands must be an array; using defaults\n');
    config.quorum_commands = DEFAULT_CONFIG.quorum_commands;
  }

  if (typeof config.required_models !== 'object' || config.required_models === null) {
    process.stderr.write('[qgsd] WARNING: qgsd.json: required_models must be an object; using defaults\n');
    config.required_models = DEFAULT_CONFIG.required_models;
  }

  if (!['open', 'closed'].includes(config.fail_mode)) {
    process.stderr.write('[qgsd] WARNING: qgsd.json: fail_mode "' + config.fail_mode + '" invalid; defaulting to "open"\n');
    config.fail_mode = 'open';
  }

  return config;
}

// Loads the two-layer QGSD config.
//
// Layer 1 (global): ~/.claude/qgsd.json
// Layer 2 (project): <projectDir>/.claude/qgsd.json  (defaults to process.cwd())
//
// Merge is shallow: { ...DEFAULT_CONFIG, ...global, ...project }
// If both layers are missing/malformed, returns DEFAULT_CONFIG with a warning.
// All warnings go to stderr — stdout is never touched.
function loadConfig(projectDir) {
  const globalPath = path.join(os.homedir(), '.claude', 'qgsd.json');
  const projectPath = path.join(projectDir || process.cwd(), '.claude', 'qgsd.json');

  const globalObj = readConfigFile(globalPath);
  const projectObj = readConfigFile(projectPath);

  let config;
  if (!globalObj && !projectObj) {
    process.stderr.write('[qgsd] WARNING: No qgsd.json found at ' + globalPath + ' or ' + projectPath + '; using hardcoded defaults\n');
    config = { ...DEFAULT_CONFIG };
  } else {
    config = { ...DEFAULT_CONFIG, ...(globalObj || {}), ...(projectObj || {}) };
  }

  validateConfig(config);
  return config;
}

module.exports = { loadConfig, DEFAULT_CONFIG };
