'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');

// Wave 0 RED stubs for LOOP-02: hooks/qgsd-spec-regen.js
// These tests define the contract. They will fail until Plan 03 implements the hook.

function runHook(inputPayload) {
  const hookPath = path.join(__dirname, 'qgsd-spec-regen.js');
  const result = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify(inputPayload),
    encoding: 'utf8',
    timeout: 15000,
  });
  return result;
}

test('LOOP-02: qgsd-spec-regen.js exits 0 and is a no-op for non-Write tool events', () => {
  const result = runHook({
    tool_name: 'Read',
    tool_input: { file_path: '/some/file.ts' },
    tool_response: {},
    cwd: process.cwd(),
    context_window: {}
  });
  // RED: script does not exist yet
  assert.strictEqual(result.status, 0, 'LOOP-02: hook must exit 0 for non-Write tools. Not yet implemented.');
});

test('LOOP-02: qgsd-spec-regen.js exits 0 and is a no-op for Write to non-machine file', () => {
  const result = runHook({
    tool_name: 'Write',
    tool_input: { file_path: '/some/other-file.ts' },
    tool_response: {},
    cwd: process.cwd(),
    context_window: {}
  });
  assert.strictEqual(result.status, 0, 'LOOP-02: hook must exit 0 for Write to non-machine file. Not yet implemented.');
  // Should produce no output or empty additionalContext for non-matching files
});

test('LOOP-02: qgsd-spec-regen.js exits 0 for Write to qgsd-workflow.machine.ts and returns additionalContext', () => {
  const result = runHook({
    tool_name: 'Write',
    tool_input: { file_path: '/Users/jonathanborduas/code/QGSD/src/machines/qgsd-workflow.machine.ts' },
    tool_response: {},
    cwd: '/Users/jonathanborduas/code/QGSD',
    context_window: {}
  });
  assert.strictEqual(result.status, 0, 'LOOP-02: hook must exit 0 for machine file write. Not yet implemented.');
  // Output must be valid JSON with additionalContext field
  if (result.stdout && result.stdout.trim()) {
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(result.stdout); },
      'LOOP-02: stdout must be valid JSON when hook fires. Not yet implemented.');
    assert.ok(
      parsed && parsed.hookSpecificOutput && parsed.hookSpecificOutput.additionalContext,
      'LOOP-02: output must contain hookSpecificOutput.additionalContext. Not yet implemented.'
    );
  }
});

test('LOOP-02: qgsd-spec-regen.js exits 0 (fail-open) on malformed stdin JSON', () => {
  const hookPath = path.join(__dirname, 'qgsd-spec-regen.js');
  const result = spawnSync(process.execPath, [hookPath], {
    input: 'not-valid-json',
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(result.status, 0, 'LOOP-02: hook must exit 0 on malformed JSON (fail-open). Not yet implemented.');
});
