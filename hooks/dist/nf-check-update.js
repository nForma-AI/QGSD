#!/usr/bin/env node
// Check for nForma updates in background, write result to cache
// Called by SessionStart hook - runs once per session

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { validateHookInput } = require('./config-loader');

// Read stdin for hook input validation (SessionStart event)
let _checkUpdateRaw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { _checkUpdateRaw += chunk; });
process.stdin.on('end', () => {
  try {
    if (_checkUpdateRaw.trim()) {
      const _input = JSON.parse(_checkUpdateRaw);
      const _eventType = _input.hook_event_name || _input.hookEventName || 'SessionStart';
      const _validation = validateHookInput(_eventType, _input);
      if (!_validation.valid) {
        process.stderr.write('[nf] WARNING: nf-check-update: invalid input: ' + JSON.stringify(_validation.errors) + '\n');
      }
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      process.stderr.write('[nf] WARNING: nf-check-update: malformed JSON on stdin: ' + e.message + '\n');
    }
  }
});

const homeDir = os.homedir();
const cwd = process.cwd();
const cacheDir = path.join(homeDir, '.claude', 'cache');
const cacheFile = path.join(cacheDir, 'nf-update-check.json');

// VERSION file locations (check project first, then global)
const projectVersionFile = path.join(cwd, '.claude', 'nf', 'VERSION');
const globalVersionFile = path.join(homeDir, '.claude', 'nf', 'VERSION');

// Ensure cache directory exists
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Run check in background (spawn background process, windowsHide prevents console flash)
const child = spawn(process.execPath, ['-e', `
  const fs = require('fs');
  const { execSync } = require('child_process');

  const cacheFile = ${JSON.stringify(cacheFile)};
  const projectVersionFile = ${JSON.stringify(projectVersionFile)};
  const globalVersionFile = ${JSON.stringify(globalVersionFile)};

  // Check project directory first (local install), then global
  let installed = '0.0.0';
  try {
    if (fs.existsSync(projectVersionFile)) {
      installed = fs.readFileSync(projectVersionFile, 'utf8').trim();
    } else if (fs.existsSync(globalVersionFile)) {
      installed = fs.readFileSync(globalVersionFile, 'utf8').trim();
    }
  } catch (e) {}

  let latest = null;
  try {
    latest = execSync('npm view @nforma.ai/nforma version', { encoding: 'utf8', timeout: 10000, windowsHide: true }).trim();
  } catch (e) {}

  const result = {
    update_available: latest && installed !== latest,
    installed,
    latest: latest || 'unknown',
    checked: Math.floor(Date.now() / 1000)
  };

  fs.writeFileSync(cacheFile, JSON.stringify(result));
`], {
  stdio: 'ignore',
  windowsHide: true,
  detached: true  // Required on Windows for proper process detachment
});

child.unref();
