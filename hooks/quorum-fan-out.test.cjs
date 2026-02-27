#!/usr/bin/env node
// hooks/quorum-fan-out.test.cjs — Wave 0 test scaffold for FAN-05
// Smoke tests for quorum.md R6.4 reduced-quorum note
// Uses node:test + node:assert/strict with file system reading
//
// Purpose: Define test contracts for reduced-quorum note emission before implementation.
// Tests verify that quorum.md includes risk_level context and reduced-quorum documentation.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Path to quorum.md
const QUORUM_MD_PATH = path.join(__dirname, '..', 'commands', 'qgsd', 'quorum.md');

// Helper: read quorum.md content
function readQuorumMd() {
  try {
    return fs.readFileSync(QUORUM_MD_PATH, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read quorum.md: ${err.message}`);
  }
}

// FAN-QUORUM-TC1: quorum.md contains R6.4 reduced-quorum note wiring after risk_level section
test('FAN-QUORUM-TC1: quorum.md contains R6.4 reduced-quorum note wiring', () => {
  const content = readQuorumMd();
  assert.match(content, /R6\.4 reduced-quorum note/, 'quorum.md must contain "R6.4 reduced-quorum note" text');
});

// FAN-QUORUM-TC2: quorum.md R6.4 note includes fan_out_count and max_quorum_size context
test('FAN-QUORUM-TC2: quorum.md R6.4 note includes fan_out_count and max_quorum_size context', () => {
  const content = readQuorumMd();
  assert.match(content, /FAN_OUT_COUNT/, 'quorum.md must reference FAN_OUT_COUNT variable');
  assert.match(content, /MAX_QUORUM_SIZE/, 'quorum.md must reference MAX_QUORUM_SIZE variable');
  assert.match(content, /risk_level/, 'quorum.md must reference risk_level context');
});

// FAN-QUORUM-TC3: quorum.md does not emit note when risk_level is high (fan-out = max)
test('FAN-QUORUM-TC3: quorum.md conditional logic for reduced-quorum note', () => {
  const content = readQuorumMd();
  assert.match(content, /if \[ "\$FAN_OUT_COUNT" -lt "\$MAX_QUORUM_SIZE" \]/, 'quorum.md must contain conditional check for fan_out_count < max_quorum_size');
  assert.match(content, /When FAN_OUT_COUNT = MAX_QUORUM_SIZE \(high\/absent\): no note emitted/, 'quorum.md must document that no note is emitted when fan-out equals max');
});
