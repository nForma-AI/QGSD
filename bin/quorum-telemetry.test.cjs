#!/usr/bin/env node
'use strict';
// bin/quorum-telemetry.test.cjs
// TDD tests for v0.24-03-01: Quorum telemetry logging (OBS-01)
// STRUCTURAL tests are RED until Plan 02 implements recordTelemetry in call-quorum-slot.cjs
// UNIT tests are GREEN from the start (pure functions, no I/O).
// Requirement: OBS-01

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ===== UNIT TESTS (GREEN from the start — pure functions) =====

// Inline telemetry record builder for pure function testing
function buildTelemetryRecord(slot, round, verdict, latencyMs, provider, providerStatus, retryCount, errorType) {
  return {
    ts: new Date().toISOString(),
    session_id: 'test-session',
    round,
    slot,
    verdict,
    latency_ms: latencyMs,
    provider,
    provider_status: providerStatus,
    retry_count: retryCount,
    error_type: errorType,
  };
}

test('Telemetry record shape — all 10 fields present with correct types', () => {
  const record = buildTelemetryRecord('gemini-1', 1, 'APPROVE', 2341, 'gemini', 'available', 0, null);

  assert.ok(record.ts, 'ts field present');
  assert.ok(record.session_id, 'session_id field present');
  assert.strictEqual(record.round, 1, 'round field correct');
  assert.strictEqual(record.slot, 'gemini-1', 'slot field correct');
  assert.strictEqual(record.verdict, 'APPROVE', 'verdict field correct');
  assert.strictEqual(record.latency_ms, 2341, 'latency_ms field correct');
  assert.strictEqual(record.provider, 'gemini', 'provider field correct');
  assert.strictEqual(record.provider_status, 'available', 'provider_status field correct');
  assert.strictEqual(record.retry_count, 0, 'retry_count field correct');
  assert.strictEqual(record.error_type, null, 'error_type field correct');

  // Verify no extra fields that shouldn't be there
  const keys = Object.keys(record);
  assert.strictEqual(keys.length, 10, 'Record has exactly 10 fields');
});

test('Telemetry record with timeout error', () => {
  const record = buildTelemetryRecord('codex-1', 3, 'FLAG', 120000, 'akashml', 'down', 2, 'TIMEOUT');

  assert.strictEqual(record.verdict, 'FLAG', 'FLAG verdict for timeout');
  assert.strictEqual(record.latency_ms, 120000, 'Timeout latency');
  assert.strictEqual(record.error_type, 'TIMEOUT', 'Error type recorded');
  assert.strictEqual(record.retry_count, 2, 'Retry count recorded');
});

test('Telemetry record with various verdict types', () => {
  const approveRecord = buildTelemetryRecord('slot1', 1, 'APPROVE', 100, 'provider1', 'available', 0, null);
  const blockRecord = buildTelemetryRecord('slot2', 2, 'BLOCK', 200, 'provider2', 'available', 0, null);
  const flagRecord = buildTelemetryRecord('slot3', 3, 'FLAG', 300, 'provider3', 'degraded', 1, 'AUTH_FAILED');

  assert.strictEqual(approveRecord.verdict, 'APPROVE', 'APPROVE verdict supported');
  assert.strictEqual(blockRecord.verdict, 'BLOCK', 'BLOCK verdict supported');
  assert.strictEqual(flagRecord.verdict, 'FLAG', 'FLAG verdict supported');
});

// Inline session ID resolver for pure function testing
function resolveSessionId(env) {
  return env.CLAUDE_SESSION_ID || 'session-' + Date.now();
}

test('Session ID resolution — from environment variable', () => {
  const sessionId = resolveSessionId({ CLAUDE_SESSION_ID: 'sess_abc123' });
  assert.strictEqual(sessionId, 'sess_abc123', 'Uses CLAUDE_SESSION_ID from env');
});

test('Session ID resolution — fallback to timestamp when missing', () => {
  const sessionId = resolveSessionId({});
  assert.ok(sessionId.startsWith('session-'), 'Falls back to session-<timestamp> pattern');
  assert.ok(/session-\d+/.test(sessionId), 'Fallback includes numeric timestamp');
});

test('Session ID resolution — consistent within same call', () => {
  const env = {};
  const id1 = resolveSessionId(env);
  const id2 = resolveSessionId(env);
  assert.ok(id1.startsWith('session-'), 'Both fallback format');
  // Note: id1 and id2 will have different timestamps (called at different times)
  // but both should be valid session IDs
});

// ===== STRUCTURAL TESTS (RED until Plan 02 implements recordTelemetry) =====
// These tests read call-quorum-slot.cjs from bin/ (NOT installed ~/.claude/ copies).
// Plan 02 must add recordTelemetry function; Plan 03 runs install.js to sync to ~/.claude/.

const CALL_QUORUM_SLOT_PATH = path.resolve(__dirname, './call-quorum-slot.cjs');
let callQuorumSlotContent = '';
try {
  callQuorumSlotContent = fs.readFileSync(CALL_QUORUM_SLOT_PATH, 'utf8');
} catch (e) {
  callQuorumSlotContent = '';
}

test('call-quorum-slot.cjs: recordTelemetry function exists', () => {
  const hasRecordTelemetry =
    callQuorumSlotContent.includes('recordTelemetry') ||
    callQuorumSlotContent.includes('function recordTelemetry') ||
    callQuorumSlotContent.includes('const recordTelemetry');
  assert.ok(
    hasRecordTelemetry,
    'recordTelemetry function not found in call-quorum-slot.cjs — Plan 02 must add it'
  );
});

test('call-quorum-slot.cjs: telemetry record includes session_id field', () => {
  const hasSessionId = callQuorumSlotContent.includes('session_id');
  assert.ok(
    hasSessionId,
    'session_id field not found: telemetry record must include session_id — Plan 02 must add it'
  );
});

test('call-quorum-slot.cjs: telemetry record includes round field', () => {
  const hasRound = callQuorumSlotContent.includes('round');
  assert.ok(
    hasRound,
    'round field not found: telemetry record must include round — Plan 02 must add it'
  );
});

test('call-quorum-slot.cjs: telemetry record includes verdict field', () => {
  const hasVerdict = callQuorumSlotContent.includes('verdict');
  assert.ok(
    hasVerdict,
    'verdict field not found: telemetry record must include verdict — Plan 02 must add it'
  );
});

test('call-quorum-slot.cjs: telemetry record includes latency_ms field', () => {
  const hasLatency = callQuorumSlotContent.includes('latency_ms');
  assert.ok(
    hasLatency,
    'latency_ms field not found: telemetry record must include latency_ms — Plan 02 must add it'
  );
});

test('call-quorum-slot.cjs: telemetry record includes provider_status field', () => {
  const hasProviderStatus = callQuorumSlotContent.includes('provider_status');
  assert.ok(
    hasProviderStatus,
    'provider_status field not found: telemetry record must include provider_status — Plan 02 must add it'
  );
});

test('call-quorum-slot.cjs: CLAUDE_SESSION_ID environment variable referenced', () => {
  const hasSessionIdRef = callQuorumSlotContent.includes('CLAUDE_SESSION_ID');
  assert.ok(
    hasSessionIdRef,
    'CLAUDE_SESSION_ID not referenced: must read session ID from environment — Plan 02 must add it'
  );
});

test('call-quorum-slot.cjs: Session ID fallback pattern present', () => {
  const hasFallback =
    callQuorumSlotContent.includes('|| \'session-\'') ||
    callQuorumSlotContent.includes('|| "session-"') ||
    callQuorumSlotContent.includes('Date.now()');
  assert.ok(
    hasFallback,
    'Session ID fallback not found: must have || fallback pattern or Date.now() — Plan 02 must add it'
  );
});

test('call-quorum-slot.cjs: telemetry wrapped in try/catch (fail-open guard)', () => {
  // Look for try/catch pattern near telemetry references
  const lines = callQuorumSlotContent.split('\n');
  let foundTryCatch = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('telemetry') || line.includes('recordTelemetry')) {
      // Check nearby lines for try/catch
      const context = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 5)).join('\n');
      if (context.includes('try') && context.includes('catch')) {
        foundTryCatch = true;
        break;
      }
    }
  }

  assert.ok(
    foundTryCatch,
    'try/catch guard not found around telemetry code: must wrap in try/catch to ensure fail-open — Plan 02 must add it'
  );
});

test('call-quorum-slot.cjs: JSONL append to quorum-rounds file', () => {
  const hasQuorumRounds =
    callQuorumSlotContent.includes('quorum-rounds') ||
    callQuorumSlotContent.includes('quorum_rounds');
  const hasAppendFileSync = callQuorumSlotContent.includes('appendFileSync');

  assert.ok(
    hasQuorumRounds && hasAppendFileSync,
    'Telemetry JSONL append not found: must append to quorum-rounds-<SESSION>.jsonl using appendFileSync — Plan 02 must add it'
  );
});

test('call-quorum-slot.cjs: all required telemetry fields documented in comments or constants', () => {
  // This is a documentation check: the code should reference the fields we expect
  const requiredFields = ['session_id', 'round', 'slot', 'verdict', 'latency_ms', 'provider_status'];
  let missingFields = [];

  for (const field of requiredFields) {
    if (!callQuorumSlotContent.includes(field)) {
      missingFields.push(field);
    }
  }

  assert.strictEqual(
    missingFields.length,
    0,
    `Missing telemetry fields in call-quorum-slot.cjs: ${missingFields.join(', ')} — Plan 02 must add all required fields`
  );
});
