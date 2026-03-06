#!/usr/bin/env node
'use strict';
/**
 * set-secret.cjs
 * Usage: node bin/set-secret.cjs <KEY_NAME> <value>
 *
 * Stores KEY_NAME=value in the OS keychain under service "nforma",
 * then syncs all nforma secrets into ~/.claude.json mcpServers env blocks.
 */
const { set, syncToClaudeJson, SERVICE } = require('./secrets.cjs');

const [,, keyName, ...valueParts] = process.argv;
if (!keyName || valueParts.length === 0) {
  console.error('Usage: node bin/set-secret.cjs <KEY_NAME> <value>');
  process.exit(1);
}
const value = valueParts.join(' ');

(async () => {
  try {
    await set(SERVICE, keyName, value);
    console.log(`[nf] Stored ${keyName} in keychain (service: ${SERVICE})`);
    await syncToClaudeJson(SERVICE);
    console.log('[nf] Synced keychain secrets to ~/.claude.json');
  } catch (e) {
    console.error('[nf] Error:', e.message);
    process.exit(1);
  }
})();
