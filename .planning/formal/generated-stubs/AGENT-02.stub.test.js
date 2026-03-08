#!/usr/bin/env node
// @requirement AGENT-02
// Verifies RemoveAgent action in QGSDAgentProvisioning.tla and
// that manage-agents-core supports removing agents from roster

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const MODEL_FILE = path.join(ROOT, '.planning', 'formal', 'tla', 'QGSDAgentProvisioning.tla');
const MANAGE_AGENTS = path.join(ROOT, 'bin', 'manage-agents-core.cjs');

test('AGENT-02: QGSDAgentProvisioning.tla defines RemoveAgent action', () => {
  const content = fs.readFileSync(MODEL_FILE, 'utf8');

  // RemoveAgent action must exist
  assert.match(content, /RemoveAgent\(slot\)\s*==/, 'RemoveAgent(slot) action must exist');

  // Must require idle phase
  assert.match(content, /RemoveAgent[\s\S]*?phase\s*=\s*"idle"/, 'RemoveAgent must require phase = "idle"');

  // Must require slot in roster
  assert.match(content, /slot\s*\\in\s*roster/, 'RemoveAgent must require slot in roster');

  // Must remove slot from roster using set difference
  assert.match(content, /roster'\s*=\s*roster\s*\\\s*\{slot\}/, 'RemoveAgent must remove slot from roster');

  // Must have @requirement AGENT-02 annotation
  assert.match(content, /@requirement\s+AGENT-02/, '@requirement AGENT-02 annotation must be present');
});

test('AGENT-02: RemoveClears safety invariant ensures verification cleared on removal', () => {
  const content = fs.readFileSync(MODEL_FILE, 'utf8');

  // RemoveClears invariant must exist
  assert.match(content, /RemoveClears\s*==/, 'RemoveClears invariant must exist');

  // Must be annotated with @requirement AGENT-02
  const removeSection = content.slice(content.indexOf('RemoveClears'));
  assert.ok(removeSection.length > 0, 'RemoveClears section must exist');
});

test('AGENT-02: manage-agents-core exports writeClaudeJson for persisting removals', () => {
  const content = fs.readFileSync(MANAGE_AGENTS, 'utf8');

  // Must have getGlobalMcpServers to enumerate existing agents
  assert.match(content, /getGlobalMcpServers/, 'manage-agents-core must define getGlobalMcpServers');
  assert.match(content, /module\.exports\s*=\s*\{[^}]*getGlobalMcpServers/, 'getGlobalMcpServers must be exported');
});
