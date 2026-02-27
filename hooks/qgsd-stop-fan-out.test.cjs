#!/usr/bin/env node
// hooks/qgsd-stop-fan-out.test.cjs — Wave 0 test scaffold for FAN-04
// Integration tests for qgsd-stop.js ceiling verification with adaptive fan-out
// Uses node:test + node:assert/strict with child_process.spawnSync
//
// Purpose: Define test contracts for stop hook ceiling check before implementation.
// Tests verify that qgsd-stop.js reads --n N from transcript and verifies correct ceiling.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Path to the hook
const HOOK_PATH = path.join(__dirname, 'qgsd-stop.js');

// Helper: write a temp JSONL file and return its path
function writeTempTranscript(lines) {
  const tmpFile = path.join(os.tmpdir(), `qgsd-stop-fan-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  fs.writeFileSync(tmpFile, lines.join('\n') + '\n', 'utf8');
  return tmpFile;
}

// Helper: spawn qgsd-stop.js as child process with stdin
function runHook(stdinPayload) {
  const result = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(stdinPayload),
    encoding: 'utf8',
    timeout: 5000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

// JSONL builder helpers (from qgsd-stop.test.js)
function userLine(content, uuid = 'user-1') {
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content },
    timestamp: '2026-02-20T00:00:00Z',
    uuid,
  });
}

function assistantLine(contentBlocks, uuid = 'assistant-1') {
  return JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: contentBlocks,
      stop_reason: contentBlocks.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
    },
    timestamp: '2026-02-20T00:01:00Z',
    uuid,
  });
}

function taskBlock(name, slotName = 'gemini-1') {
  return {
    type: 'tool_use',
    id: `toolu_task_${slotName}`,
    name: 'Task',
    input: {
      subagent_type: 'qgsd-quorum-slot-worker',
      description: `${slotName} quorum R1`,
      prompt: `slot: ${slotName}\nround: 1\n`,
    },
  };
}

// FAN-STOP-TC1: --n 2 in prompt text → ceiling = 1 external model required
test('FAN-STOP-TC1: --n 2 in prompt text → ceiling = 1 external model required', () => {
  const tmpFile = writeTempTranscript([
    userLine('/qgsd:plan-phase --n 2'),
    assistantLine([
      { type: 'text', text: 'Running with --n 2' },
      taskBlock('Task', 'gemini-1'),
    ]),
  ]);
  try {
    const { exitCode, stdout } = runHook({
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
    });
    // With 1 successful external task (ceiling = 1 for --n 2), exit should be 0
    assert.strictEqual(exitCode, 0, 'FAN-STOP-TC1: --n 2 with 1 external task must exit 0');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// FAN-STOP-TC2: --n 3 in prompt text → ceiling = 2 external models required
test('FAN-STOP-TC2: --n 3 in prompt text → ceiling = 2 external models required', () => {
  const tmpFile = writeTempTranscript([
    userLine('/qgsd:plan-phase --n 3'),
    assistantLine([
      { type: 'text', text: 'Running with --n 3' },
      taskBlock('Task', 'gemini-1'),
      taskBlock('Task', 'codex-1'),
    ]),
  ]);
  try {
    const { exitCode, stdout } = runHook({
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
    });
    // With 2 successful external tasks (ceiling = 2 for --n 3), exit should be 0
    assert.strictEqual(exitCode, 0, 'FAN-STOP-TC2: --n 3 with 2 external tasks must exit 0');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// FAN-STOP-TC3: --n 1 solo mode → no external models required (existing behavior preserved)
test('FAN-STOP-TC3: --n 1 solo mode → no external models required (existing behavior)', () => {
  const tmpFile = writeTempTranscript([
    userLine('/qgsd:plan-phase --n 1'),
    assistantLine([
      { type: 'text', text: 'Solo mode: Claude only' },
    ]),
  ]);
  try {
    const { exitCode, stdout } = runHook({
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
    });
    // Solo mode (--n 1) requires no external tasks, exit should be 0
    assert.strictEqual(exitCode, 0, 'FAN-STOP-TC3: --n 1 solo mode must exit 0 with no external tasks');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// FAN-STOP-TC4: no --n flag → ceiling falls back to config.quorum.maxSize (existing behavior)
test('FAN-STOP-TC4: no --n flag → ceiling falls back to config.quorum.maxSize', () => {
  const tmpFile = writeTempTranscript([
    userLine('/qgsd:plan-phase'),
    assistantLine([
      { type: 'text', text: 'Running with default maxSize' },
      taskBlock('Task', 'gemini-1'),
      taskBlock('Task', 'codex-1'),
    ]),
  ]);
  try {
    const { exitCode, stdout } = runHook({
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
    });
    // Default maxSize is typically 3, so ceiling = 2 external models; with 2 tasks, exit should be 0
    assert.strictEqual(exitCode, 0, 'FAN-STOP-TC4: no --n flag with 2 external tasks (default ceiling) must exit 0');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
