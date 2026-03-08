#!/usr/bin/env node
// @requirement AGENT-01
// Verifies AddAgent action in QGSDAgentProvisioning.tla and
// that manage-agents-core exports writeClaudeJson for adding agents

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const MODEL_FILE = path.join(ROOT, '.planning', 'formal', 'tla', 'QGSDAgentProvisioning.tla');
const MANAGE_AGENTS = path.join(ROOT, 'bin', 'manage-agents-core.cjs');

test('AGENT-01: QGSDAgentProvisioning.tla defines AddAgent action', () => {
  const content = fs.readFileSync(MODEL_FILE, 'utf8');

  // AddAgent action must exist with slot and provider params
  assert.match(content, /AddAgent\(slot,\s*provider\)\s*==/, 'AddAgent(slot, provider) action must exist');

  // Must require idle phase as precondition
  assert.match(content, /AddAgent[\s\S]*?phase\s*=\s*"idle"/, 'AddAgent must require phase = "idle"');

  // Must add slot to roster (TLA+ uses \union)
  assert.match(content, /roster'\s*=\s*roster\s*\\union\s*\{slot\}/, 'AddAgent must add slot to roster');

  // Must transition phase to "adding"
  assert.match(content, /phase'\s*=\s*"adding"/, 'AddAgent must set phase to "adding"');

  // Must have @requirement AGENT-01 annotation
  assert.match(content, /@requirement\s+AGENT-01/, '@requirement AGENT-01 annotation must be present');
});

test('AGENT-01: VerifiedInRoster safety invariant protects AddAgent', () => {
  const content = fs.readFileSync(MODEL_FILE, 'utf8');

  // VerifiedInRoster invariant must exist
  assert.match(content, /VerifiedInRoster\s*==/, 'VerifiedInRoster invariant must exist');
  assert.match(content, /verified\s*\\subseteq\s*roster/, 'verified must be subset of roster');
});

test('AGENT-01: manage-agents-core exports writeClaudeJson for persisting agents', () => {
  const content = fs.readFileSync(MANAGE_AGENTS, 'utf8');

  // Must export writeClaudeJson (used to persist new agents to ~/.claude.json)
  assert.match(content, /writeClaudeJson/, 'manage-agents-core must define writeClaudeJson');
  assert.match(content, /module\.exports\s*=\s*\{[^}]*writeClaudeJson/, 'writeClaudeJson must be exported');

  // Must export readClaudeJson (read existing agents)
  assert.match(content, /readClaudeJson/, 'manage-agents-core must define readClaudeJson');
});
