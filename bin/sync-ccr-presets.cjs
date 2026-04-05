#!/usr/bin/env node
'use strict';

/**
 * sync-ccr-presets.cjs
 *
 * Generates ~/.claude-code-router/presets/claude-N/manifest.json
 * from ccr-N entries in providers.json. Ensures CCR presets stay
 * in sync when models are changed in providers.json.
 *
 * Usage:
 *   node bin/sync-ccr-presets.cjs [--dry-run]
 *
 * Requires TOGETHER_API_KEY env var (or reads from existing manifest).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const green = (s) => '\x1b[32m' + s + '\x1b[0m';
const yellow = (s) => '\x1b[33m' + s + '\x1b[0m';
const dim = (s) => '\x1b[2m' + s + '\x1b[0m';

// ── Load providers.json ──────────────────────────────────────────────────────
const pjPath = path.join(__dirname, 'providers.json');
let providers;
try {
  providers = JSON.parse(fs.readFileSync(pjPath, 'utf8')).providers || [];
} catch (e) {
  console.error('Could not read providers.json:', e.message);
  process.exit(1);
}

// ── Find ccr-* entries and their corresponding api-* baseUrl ─────────────────
const ccrEntries = providers.filter(p => p.type === 'ccr' && p.name && p.name.startsWith('ccr-'));

// Map ccr-N to api-N for baseUrl lookup
const apiByIndex = {};
for (const p of providers) {
  if (p.type === 'http' && p.name && p.name.startsWith('api-')) {
    const idx = p.name.replace('api-', '');
    apiByIndex[idx] = p;
  }
}

const presetsDir = path.join(os.homedir(), '.claude-code-router', 'presets');

// ── Read API key from env or existing manifest ──────────────────────────────
function resolveApiKey(presetName, apiKeyEnv) {
  // Try env var first
  if (apiKeyEnv && process.env[apiKeyEnv]) {
    return process.env[apiKeyEnv];
  }
  // Fall back to reading from existing manifest
  const existingManifest = path.join(presetsDir, presetName, 'manifest.json');
  try {
    const existing = JSON.parse(fs.readFileSync(existingManifest, 'utf8'));
    const existingKey = existing.Providers && existing.Providers[0] && existing.Providers[0].api_key;
    if (existingKey) return existingKey;
  } catch (_) {}
  return null;
}

// ── Derive provider short name from baseUrl ──────────────────────────────────
function providerShortName(baseUrl) {
  try {
    const hostname = new URL(baseUrl).hostname;
    if (hostname.includes('together')) return 'together';
    if (hostname.includes('fireworks')) return 'fireworks';
    if (hostname.includes('akash')) return 'akashml';
    return hostname.replace(/^api\./, '').split('.')[0];
  } catch {
    return 'unknown';
  }
}

// ── Generate manifests ───────────────────────────────────────────────────────
let updated = 0;
let skipped = 0;

for (const ccr of ccrEntries) {
  const idx = ccr.name.replace('ccr-', '');
  const presetName = 'claude-' + idx;
  const api = apiByIndex[idx];

  if (!api || !api.baseUrl) {
    console.log(yellow('  SKIP') + ' ' + ccr.name + ': no matching api-' + idx + ' with baseUrl');
    skipped++;
    continue;
  }

  const apiKey = resolveApiKey(presetName, api.apiKeyEnv);
  if (!apiKey) {
    console.log(yellow('  SKIP') + ' ' + ccr.name + ': no API key (set ' + (api.apiKeyEnv || 'TOGETHER_API_KEY') + ' or have existing manifest)');
    skipped++;
    continue;
  }

  const shortName = providerShortName(api.baseUrl);
  const manifest = {
    name: presetName,
    description: ccr.model.split('/').pop() + ' via ' + shortName.charAt(0).toUpperCase() + shortName.slice(1) + '.xyz',
    version: '1.0.0',
    Providers: [
      {
        name: shortName,
        api_base_url: api.baseUrl + '/chat/completions',
        api_key: apiKey,
        models: [ccr.model]
      }
    ],
    Router: {
      default: shortName + ',' + ccr.model
    }
  };

  const presetDir = path.join(presetsDir, presetName);
  const manifestPath = path.join(presetDir, 'manifest.json');

  // Check if manifest already matches
  try {
    const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (existing.Providers &&
        existing.Providers[0] &&
        existing.Providers[0].models[0] === ccr.model &&
        existing.Router.default === manifest.Router.default) {
      console.log(dim('  ↳ ' + presetName + ': already up to date (' + ccr.model + ')'));
      skipped++;
      continue;
    }
  } catch (_) {}

  if (dryRun) {
    console.log(green('  WOULD UPDATE') + ' ' + presetName + ': ' + ccr.model);
    updated++;
    continue;
  }

  fs.mkdirSync(presetDir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(green('  ✓') + ' ' + presetName + ': ' + ccr.model);
  updated++;
}

console.log('\nSync complete: ' + updated + ' updated, ' + skipped + ' skipped');
