#!/usr/bin/env node
// @requirement AGENT-03
// Verifies VerifyAgent action in QGSDAgentProvisioning.tla and
// that mcp-setup.md documents identity ping after provisioning

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const MODEL_FILE = path.join(ROOT, '.planning', 'formal', 'tla', 'QGSDAgentProvisioning.tla');
const MCP_SETUP = path.join(ROOT, 'commands', 'nf', 'mcp-setup.md');

test('AGENT-03: QGSDAgentProvisioning.tla defines VerifyAgent action', () => {
  const content = fs.readFileSync(MODEL_FILE, 'utf8');

  // VerifyAgent action must exist
  assert.match(content, /VerifyAgent\(slot\)\s*==/, 'VerifyAgent(slot) action must exist');

  // Must require phase = "adding" (happens after AddAgent)
  assert.match(content, /VerifyAgent[\s\S]*?phase\s*=\s*"adding"/, 'VerifyAgent must require phase = "adding"');

  // Must require slot in roster
  assert.match(content, /VerifyAgent[\s\S]*?slot\s*\\in\s*roster/, 'VerifyAgent must require slot in roster');

  // Must add slot to verified set (TLA+ uses \union)
  assert.match(content, /verified'\s*=\s*verified\s*\\union\s*\{slot\}/, 'VerifyAgent must add slot to verified set');

  // Must have @requirement AGENT-03 annotation
  assert.match(content, /@requirement\s+AGENT-03/, '@requirement AGENT-03 annotation must be present');
});

test('AGENT-03: VerifyAgent is invoked in Next after AddAgent', () => {
  const content = fs.readFileSync(MODEL_FILE, 'utf8');

  // Both AddAgent and VerifyAgent must be in Next relation
  assert.match(content, /AddAgent/, 'AddAgent must exist in model');
  assert.match(content, /VerifyAgent/, 'VerifyAgent must exist in model');

  // VerifyAgent must appear in Next disjunction
  const nextSection = content.slice(content.indexOf('Next =='));
  assert.match(nextSection, /VerifyAgent/, 'VerifyAgent must appear in Next state relation');
});

test('AGENT-03: mcp-setup.md documents identity ping step after provisioning', () => {
  const content = fs.readFileSync(MCP_SETUP, 'utf8');

  // Must reference identity ping
  assert.match(content, /identity ping/i, 'mcp-setup.md must document identity ping');

  // Must reference AGENT-03 requirement
  assert.match(content, /AGENT-03/, 'mcp-setup.md must reference AGENT-03');

  // Must describe ping step after add-agent flow
  assert.match(content, /Step D.*Identity ping/i, 'mcp-setup.md must have Step D for identity ping');
});
