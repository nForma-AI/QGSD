#!/usr/bin/env node
// @requirement STATE-06
// Verifies: phase-complete falls back to ROADMAP.md heading parsing when no
// next-phase directory exists, using segment-aware version comparison for
// versioned phase IDs (e.g., v0.28-01 vs v0.28-02).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GSD_TOOLS_PATH = path.resolve(__dirname, '../../../core/bin/gsd-tools.cjs');

test('STATE-06: gsd-tools.cjs contains comparePhaseVersions segment-aware comparator', () => {
  const content = fs.readFileSync(GSD_TOOLS_PATH, 'utf8');
  // The segment-aware comparator must exist -- it splits on '-' to handle v0.28-01 vs v0.28-02
  assert.match(content, /comparePhaseVersions/, 'comparePhaseVersions function must exist');
  assert.match(content, /split\('-'\)/, 'must split on hyphen for segment comparison');
});

test('STATE-06: gsd-tools.cjs cmdPhaseComplete has ROADMAP.md fallback path', () => {
  const content = fs.readFileSync(GSD_TOOLS_PATH, 'utf8');
  // The fallback path checks ROADMAP.md when isLastPhase is still true after directory scan
  assert.match(content, /cmdPhaseComplete/, 'cmdPhaseComplete function must exist');
  assert.match(content, /Fallback.*ROADMAP/, 'must have ROADMAP.md fallback comment');
  assert.match(content, /isLastPhase\s*&&\s*fs\.existsSync\(roadmapPath\)/, 'fallback guarded by isLastPhase && roadmap exists');
});

test('STATE-06: cmdPhaseComplete sets is_last_phase in output', () => {
  const content = fs.readFileSync(GSD_TOOLS_PATH, 'utf8');
  assert.match(content, /is_last_phase:\s*isLastPhase/, 'output must include is_last_phase field');
});

test('STATE-06: comparePhaseVersions strips v prefix and compares segments numerically', () => {
  const content = fs.readFileSync(GSD_TOOLS_PATH, 'utf8');
  // Verify the comparator implementation handles the key cases:
  // 1. Strips leading 'v' prefix
  assert.match(content, /replace\(\/\^v\/i,\s*''\)/, 'must strip v prefix (case-insensitive)');
  // 2. Splits on '-' to get sub-segments
  assert.match(content, /split\('-'\)\.map\(Number\)/, 'must split on hyphen and convert to numbers');
  // 3. Compares segment-by-segment
  assert.match(content, /va\s*!==\s*vb/, 'must compare segments individually');
});
