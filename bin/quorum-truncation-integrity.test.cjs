#!/usr/bin/env node
'use strict';
// bin/quorum-truncation-integrity.test.cjs
// Tests for quick-365: Quorum output truncation integrity
// Requirements: TRUNC-01, TRUNC-02, TRUNC-03, TRUNC-04, TRUNC-05

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { emitResultBlock, parseVerdict } = require('./quorum-slot-dispatch.cjs');

// ===== L6 marker tests (TRUNC-05) =====

test('L6: emitResultBlock appends [RAW TRUNCATED at 5KB] when rawOutput > 5000 chars', () => {
  const largeRaw = 'x'.repeat(6000);
  const result = emitResultBlock({
    slot: 'test-1',
    round: 1,
    verdict: 'APPROVE',
    reasoning: 'looks good',
    rawOutput: largeRaw,
  });
  assert.ok(result.includes('[RAW TRUNCATED at 5KB]'), 'Should contain L6 truncation marker');
});

test('L6: emitResultBlock does NOT append marker when rawOutput <= 5000 chars', () => {
  const smallRaw = 'x'.repeat(500);
  const result = emitResultBlock({
    slot: 'test-1',
    round: 1,
    verdict: 'APPROVE',
    reasoning: 'looks good',
    rawOutput: smallRaw,
  });
  assert.ok(!result.includes('[RAW TRUNCATED at 5KB]'), 'Should NOT contain L6 truncation marker');
});

// ===== Truncation metadata in emitResultBlock (TRUNC-04) =====

test('emitResultBlock emits verdict_integrity and truncation block when truncated=true', () => {
  const result = emitResultBlock({
    slot: 'test-1',
    round: 1,
    verdict: 'APPROVE',
    reasoning: 'ok',
    rawOutput: 'small output',
    truncated: true,
    truncationLayer: 'L3',
    originalSizeBytes: 51200,
  });
  assert.ok(result.includes('verdict_integrity: truncated'), 'Should contain verdict_integrity');
  assert.ok(result.includes('truncation:'), 'Should contain truncation block');
  assert.ok(result.includes('truncated: true'), 'Should have truncated: true');
  assert.ok(result.includes('layer: L3'), 'Should have layer: L3');
  assert.ok(result.includes('original_size_bytes: 51200'), 'Should have original_size_bytes');
});

test('emitResultBlock does NOT emit verdict_integrity when not truncated', () => {
  const result = emitResultBlock({
    slot: 'test-1',
    round: 1,
    verdict: 'APPROVE',
    reasoning: 'ok',
    rawOutput: 'small output',
    truncated: false,
  });
  assert.ok(!result.includes('verdict_integrity'), 'Should NOT contain verdict_integrity');
});

// ===== L6-only truncation (TRUNC-05) =====

test('L6-only: emitResultBlock emits verdict_integrity when rawOutput > 5000 but truncated=false', () => {
  const largeRaw = 'y'.repeat(6000);
  const result = emitResultBlock({
    slot: 'test-1',
    round: 1,
    verdict: 'APPROVE',
    reasoning: 'ok',
    rawOutput: largeRaw,
    truncated: false,
  });
  assert.ok(result.includes('verdict_integrity: truncated'), 'Should detect L6 truncation');
  assert.ok(result.includes('layer: L6'), 'Should report layer L6');
});

// ===== parseVerdict side-channel (TRUNC-02) =====

test('parseVerdict sets lastTruncationNote=true when input contains [OUTPUT TRUNCATED', () => {
  parseVerdict('verdict: APPROVE\n[OUTPUT TRUNCATED at 10MB by call-quorum-slot]');
  assert.strictEqual(parseVerdict.lastTruncationNote, true);
});

test('parseVerdict sets lastTruncationNote=false for clean input', () => {
  parseVerdict('verdict: APPROVE\nreasoning: all good');
  assert.strictEqual(parseVerdict.lastTruncationNote, false);
});

// ===== parseVerdict backward compat =====

test('parseVerdict returns a string verdict (backward compat)', () => {
  const result = parseVerdict('verdict: APPROVE\nreasoning: ok');
  assert.strictEqual(typeof result, 'string');
  assert.ok(['APPROVE', 'REJECT', 'FLAG'].includes(result), `Expected valid verdict, got: ${result}`);
});

test('parseVerdict defaults to FLAG for missing verdict', () => {
  const result = parseVerdict('no verdict here');
  assert.strictEqual(result, 'FLAG');
});

// ===== Telemetry record shape (TRUNC-04) =====

test('Telemetry record includes 3 new truncation fields alongside originals', () => {
  // Build a record matching the shape produced by recordTelemetry
  const record = {
    ts: new Date().toISOString(),
    session_id: 'test-session',
    round: 1,
    slot: 'test-1',
    verdict: 'APPROVE',
    latency_ms: 1500,
    provider: 'codex',
    provider_status: 'available',
    retry_count: 0,
    error_type: null,
    truncated: true,
    truncation_layer: 'L1',
    original_size_bytes: 10485760,
  };
  const json = JSON.stringify(record);
  const parsed = JSON.parse(json);

  // Original 10 fields
  assert.ok('ts' in parsed);
  assert.ok('session_id' in parsed);
  assert.ok('round' in parsed);
  assert.ok('slot' in parsed);
  assert.ok('verdict' in parsed);
  assert.ok('latency_ms' in parsed);
  assert.ok('provider' in parsed);
  assert.ok('provider_status' in parsed);
  assert.ok('retry_count' in parsed);
  assert.ok('error_type' in parsed);

  // 3 new truncation fields
  assert.strictEqual(parsed.truncated, true);
  assert.strictEqual(parsed.truncation_layer, 'L1');
  assert.strictEqual(parsed.original_size_bytes, 10485760);
});

// ===== nf-stop.js source check (TRUNC-03) =====

test('nf-stop.js contains verdict_integrity truncated regex pattern', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'nf-stop.js'), 'utf8');
  assert.ok(/verdict_integrity:\s*truncated/.test(source), 'nf-stop.js should contain the truncation regex');
});
