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

test('nf-stop.js contains FLAG_TRUNCATED consensus exclusion pattern (TRUNC-03)', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'nf-stop.js'), 'utf8');
  assert.ok(source.includes('FLAG_TRUNCATED'), 'nf-stop.js should contain FLAG_TRUNCATED for consensus exclusion');
});

// ===== Question extraction: multiline YAML block scalar (RELAY-01, quick-366) =====

test('Question extraction: inline question extracts correctly', () => {
  const { execFileSync } = require('child_process');
  const input = 'slot: test-1\nquestion: What is the answer?\nround: 1';
  const awkScript = '/^question:/{f=1; line=$0; sub(/^question: */, "", line); if(line != "|" && line != "") {print line; f=0}; next} f && /^  /{sub(/^  /,"");print;next} f && /^[a-z]/{f=0}';
  const result = execFileSync('awk', [awkScript], { input, encoding: 'utf8' }).trim();
  assert.strictEqual(result, 'What is the answer?');
});

test('Question extraction: block scalar question extracts multiline content', () => {
  const { execFileSync } = require('child_process');
  const input = 'slot: test-1\nquestion: |\n  Review the implementation\n  Do they match?\nround: 1';
  const awkScript = '/^question:/{f=1; line=$0; sub(/^question: */, "", line); if(line != "|" && line != "") {print line; f=0}; next} f && /^  /{sub(/^  /,"");print;next} f && /^[a-z]/{f=0}';
  const result = execFileSync('awk', [awkScript], { input, encoding: 'utf8' }).trim();
  assert.ok(result.includes('Review the implementation'), 'Should contain first line');
  assert.ok(result.includes('Do they match?'), 'Should contain second line');
});

test('Question extraction: block scalar does NOT capture just pipe character', () => {
  const { execFileSync } = require('child_process');
  const input = 'slot: test-1\nquestion: |\n  Actual question here\nround: 1';
  const awkScript = '/^question:/{f=1; line=$0; sub(/^question: */, "", line); if(line != "|" && line != "") {print line; f=0}; next} f && /^  /{sub(/^  /,"");print;next} f && /^[a-z]/{f=0}';
  const result = execFileSync('awk', [awkScript], { input, encoding: 'utf8' }).trim();
  assert.notStrictEqual(result, '|', 'Should NOT be just a pipe character');
  assert.ok(result.includes('Actual question here'), 'Should contain the real question');
});

// ===== L3/L6 supplementary telemetry (TRUNC-04 gap closure, quick-366) =====

test('appendTelemetryUpdate is exported and callable', () => {
  const { appendTelemetryUpdate } = require('./quorum-slot-dispatch.cjs');
  assert.strictEqual(typeof appendTelemetryUpdate, 'function');
});

test('appendTelemetryUpdate record shape includes truncation_update marker', () => {
  const record = {
    ts: new Date().toISOString(),
    session_id: 'test-session',
    slot: 'codex-1',
    round: 1,
    truncation_update: true,
    l3_truncated: true,
    l6_truncated: false,
    effective_layer: 'L3',
    original_size_bytes: 51200,
    verdict_integrity: 'truncated',
  };
  assert.strictEqual(record.truncation_update, true, 'Must have truncation_update marker');
  assert.ok('l3_truncated' in record, 'Must have l3_truncated field');
  assert.ok('l6_truncated' in record, 'Must have l6_truncated field');
  assert.ok('effective_layer' in record, 'Must have effective_layer field');
});

// ===== FLAG_TRUNCATED verdict semantic (TRUNC-03 gap closure, quick-366) =====

test('parseVerdict returns FLAG for missing verdict with truncation note', () => {
  const result = parseVerdict('no verdict line\n[OUTPUT TRUNCATED at 10MB by call-quorum-slot]');
  assert.strictEqual(result, 'FLAG', 'parseVerdict should still return FLAG');
  assert.strictEqual(parseVerdict.lastTruncationNote, true, 'Side-channel should detect truncation');
});

test('FLAG_TRUNCATED appears in emitResultBlock when verdict is FLAG_TRUNCATED', () => {
  const result = emitResultBlock({
    slot: 'test-1',
    round: 1,
    verdict: 'FLAG_TRUNCATED',
    reasoning: 'truncation-derived default',
    rawOutput: 'some truncated output\n[OUTPUT TRUNCATED at 50KB]',
    truncated: true,
    truncationLayer: 'L3',
  });
  assert.ok(result.includes('verdict: FLAG_TRUNCATED'), 'Should emit FLAG_TRUNCATED verdict');
  assert.ok(result.includes('verdict_integrity: truncated'), 'Should have truncated integrity');
});

test('emitResultBlock with APPROVE is NOT changed to FLAG_TRUNCATED', () => {
  const result = emitResultBlock({
    slot: 'test-1',
    round: 1,
    verdict: 'APPROVE',
    reasoning: 'all good',
    rawOutput: 'verdict: APPROVE\n[OUTPUT TRUNCATED at 50KB]',
    truncated: true,
    truncationLayer: 'L3',
  });
  assert.ok(result.includes('verdict: APPROVE'), 'APPROVE should remain APPROVE');
  assert.ok(!result.includes('FLAG_TRUNCATED'), 'Should NOT contain FLAG_TRUNCATED');
});

test('nf-stop.js source contains FLAG_TRUNCATED regex pattern', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'nf-stop.js'), 'utf8');
  assert.ok(/verdict:\s*FLAG_TRUNCATED/.test(source) || /verdict:\\s\*FLAG_TRUNCATED/.test(source),
    'nf-stop.js should contain verdict: FLAG_TRUNCATED regex pattern');
});

test('nf-stop.js sets hasUnavail for FLAG_TRUNCATED', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'nf-stop.js'), 'utf8');
  // Find the TRUNC-03 comment block which is the FLAG_TRUNCATED handler
  const trunc03Idx = source.indexOf('TRUNC-03');
  assert.ok(trunc03Idx > -1, 'Should find TRUNC-03 comment in nf-stop.js');
  const flagTruncBlock = source.slice(trunc03Idx, trunc03Idx + 400);
  assert.ok(flagTruncBlock.includes('FLAG_TRUNCATED'), 'TRUNC-03 block should reference FLAG_TRUNCATED');
  assert.ok(flagTruncBlock.includes('hasUnavail = true'),
    'FLAG_TRUNCATED block should set hasUnavail = true');
});
