#!/usr/bin/env node
// Test suite for hooks/qgsd-statusline.js
// Uses Node.js built-in test runner: node --test hooks/qgsd-statusline.test.js
//
// Each test spawns the hook as a child process with mock stdin (JSON payload).
// Captures stdout + exit code. The hook reads JSON from stdin and writes
// formatted statusline text to stdout.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_PATH = path.join(__dirname, 'qgsd-statusline.js');

// Helper: run the hook with a given stdin JSON payload and optional extra env vars
function runHook(stdinPayload, extraEnv) {
  const input = typeof stdinPayload === 'string'
    ? stdinPayload
    : JSON.stringify(stdinPayload);

  const result = spawnSync('node', [HOOK_PATH], {
    input,
    encoding: 'utf8',
    timeout: 5000,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

// Helper: create a temp directory structure, write a file inside it, return tempDir
function makeTempDir(suffix) {
  const dir = path.join(os.tmpdir(), `qgsd-sl-test-${Date.now()}-${suffix}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// --- Test Cases ---

// TC1: Minimal payload — stdout contains model name and directory basename
test('TC1: minimal payload includes model name and directory name', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: '/tmp/myproject' },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.includes('TestModel'), 'stdout must include model name "TestModel"');
  assert.ok(stdout.includes('myproject'), 'stdout must include directory basename "myproject"');
});

// TC2: Context at 100% remaining (0% used) → green bar, 0%
// rawUsed = 100 - 100 = 0; scaled = round(0 / 80 * 100) = 0; filled = 0 → all empty blocks
test('TC2: context at 100% remaining shows all-empty bar at 0%', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'M' },
    context_window: { remaining_percentage: 100 },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.includes('░░░░░░░░░░'), 'stdout must include all-empty bar (0% used)');
  assert.ok(stdout.includes('0%'), 'stdout must include 0%');
});

// TC3: Context at 20% remaining (80% used → scaled 100%) → full bar, 100%
// rawUsed = 80; scaled = round(80/80 * 100) = 100; filled = 10 → full blocks
// At 100% scaled, the hook uses the skull emoji and blink+red ANSI code
test('TC3: context at 20% remaining shows full bar at 100% (skull zone)', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'M' },
    context_window: { remaining_percentage: 20 },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.includes('100%'), 'stdout must include 100%');
  assert.ok(stdout.includes('██████████'), 'stdout must include full bar (10 filled segments)');
});

// TC4: Context at 51% remaining (49% used → scaled 61%) → green zone (scaled < 63)
// rawUsed = 49; scaled = round(49/80 * 100) = round(61.25) = 61; 61 < 63 → green
test('TC4: context at 51% remaining shows 61% in green (below 63% yellow threshold)', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'M' },
    context_window: { remaining_percentage: 51 },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.includes('61%'), 'stdout must include 61%');
  assert.ok(stdout.includes('\x1b[32m'), 'stdout must include green ANSI code \\x1b[32m');
});

// TC5: Context at 36% remaining (64% used → scaled 80%) → yellow zone (63 <= scaled < 81)
// rawUsed = 64; scaled = round(64/80 * 100) = round(80) = 80; 63 <= 80 < 81 → yellow
test('TC5: context at 36% remaining shows 80% in yellow (63–80% yellow zone)', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'M' },
    context_window: { remaining_percentage: 36 },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.includes('80%'), 'stdout must include 80%');
  assert.ok(stdout.includes('\x1b[33m'), 'stdout must include yellow ANSI code \\x1b[33m');
});

// TC6: Malformed JSON input → exits 0, stdout is empty (silent fail)
test('TC6: malformed JSON input exits 0 with empty stdout (silent fail)', () => {
  const { stdout, exitCode } = runHook('this is not valid json');
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.strictEqual(stdout, '', 'stdout must be empty on malformed JSON input');
});

// TC7: Update available — output includes '/nf:update'
test('TC7: update available banner shows /nf:update in output', () => {
  const tempHome = makeTempDir('tc7');
  const cacheDir = path.join(tempHome, '.claude', 'cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const cacheFile = path.join(cacheDir, 'qgsd-update-check.json');
  fs.writeFileSync(cacheFile, JSON.stringify({ update_available: true, latest: '1.0.1' }), 'utf8');

  try {
    const { stdout, exitCode } = runHook(
      { model: { display_name: 'M' } },
      { HOME: tempHome }
    );
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.ok(stdout.includes('/nf:update'), 'stdout must include /nf:update when update is available');
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

// TC8: Task in progress — output includes the task's activeForm text
test('TC8: in-progress task is shown in statusline output', () => {
  const tempHome = makeTempDir('tc8');
  const todosDir = path.join(tempHome, '.claude', 'todos');
  fs.mkdirSync(todosDir, { recursive: true });

  const sessionId = 'sess123';
  const todosFile = path.join(todosDir, `${sessionId}-agent-0.json`);
  fs.writeFileSync(
    todosFile,
    JSON.stringify([{ status: 'in_progress', activeForm: 'Fix the thing' }]),
    'utf8'
  );

  try {
    const { stdout, exitCode } = runHook(
      { model: { display_name: 'M' }, session_id: sessionId },
      { HOME: tempHome }
    );
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.ok(stdout.includes('Fix the thing'), 'stdout must include the in-progress task activeForm text');
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});
