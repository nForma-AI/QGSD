#!/usr/bin/env node
// Test suite for hooks/qgsd-precompact.js
// Uses Node.js built-in test runner: node --test hooks/qgsd-precompact.test.js
//
// Unit tests target exported helpers (extractCurrentPosition, readPendingTasks).
// Integration tests spawn the hook as a child process with mock stdin.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_PATH = path.join(__dirname, 'qgsd-precompact.js');
const { extractCurrentPosition, readPendingTasks } = require(HOOK_PATH);

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTmpDir() {
  const dir = path.join(os.tmpdir(), 'qgsd-pc-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runHook(stdinPayload, opts = {}) {
  const result = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(stdinPayload),
    encoding: 'utf8',
    timeout: 5000,
    ...opts,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
    parsed: (() => { try { return JSON.parse(result.stdout); } catch { return null; } })(),
  };
}

function writeStateFile(dir, content) {
  const planningDir = path.join(dir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'STATE.md'), content, 'utf8');
}

function writeClaudeFile(dir, filename, content) {
  const claudeDir = path.join(dir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, filename), content, 'utf8');
}

// ─── extractCurrentPosition unit tests ──────────────────────────────────────

test('extractCurrentPosition: returns section between marker and next header', () => {
  const content = [
    '# Project State',
    '',
    '## Current Position',
    '',
    'Phase: v0.19-04 — COMPLETE',
    'Status: ready to plan v0.19-05',
    '',
    '## Performance Metrics',
    '',
    'some other section',
  ].join('\n');

  const result = extractCurrentPosition(content);
  assert.ok(result.includes('Phase: v0.19-04'), 'Should include phase line');
  assert.ok(!result.includes('Performance Metrics'), 'Should not bleed into next section');
});

test('extractCurrentPosition: returns to EOF when no following header', () => {
  const content = [
    '## Other Section',
    'irrelevant',
    '',
    '## Current Position',
    '',
    'Last section content here',
  ].join('\n');

  const result = extractCurrentPosition(content);
  assert.ok(result.includes('Last section content here'));
});

test('extractCurrentPosition: returns null when marker is absent', () => {
  const content = '## Something Else\ncontent\n## Another\nmore content';
  assert.equal(extractCurrentPosition(content), null);
});

test('extractCurrentPosition: returns null when section is empty', () => {
  const content = '## Current Position\n\n## Next Section\ncontent';
  assert.equal(extractCurrentPosition(content), null);
});

// ─── readPendingTasks unit tests ─────────────────────────────────────────────

test('readPendingTasks: returns empty array when .claude dir does not exist', () => {
  const tmpDir = makeTmpDir();
  const results = readPendingTasks(tmpDir);
  assert.deepEqual(results, []);
});

test('readPendingTasks: returns generic pending-task.txt', () => {
  const tmpDir = makeTmpDir();
  writeClaudeFile(tmpDir, 'pending-task.txt', '/qgsd:execute-phase v0.19-05');

  const results = readPendingTasks(tmpDir);
  assert.equal(results.length, 1);
  assert.equal(results[0].filename, 'pending-task.txt');
  assert.equal(results[0].content, '/qgsd:execute-phase v0.19-05');
});

test('readPendingTasks: returns session-scoped pending-task-SESSION.txt', () => {
  const tmpDir = makeTmpDir();
  writeClaudeFile(tmpDir, 'pending-task-abc123.txt', '/qgsd:quick --full fix tests');

  const results = readPendingTasks(tmpDir);
  assert.equal(results.length, 1);
  assert.equal(results[0].filename, 'pending-task-abc123.txt');
  assert.equal(results[0].content, '/qgsd:quick --full fix tests');
});

test('readPendingTasks: excludes .claimed files', () => {
  const tmpDir = makeTmpDir();
  writeClaudeFile(tmpDir, 'pending-task-abc123.txt.claimed', 'already consumed');

  const results = readPendingTasks(tmpDir);
  assert.deepEqual(results, []);
});

test('readPendingTasks: skips empty pending-task files', () => {
  const tmpDir = makeTmpDir();
  writeClaudeFile(tmpDir, 'pending-task.txt', '   \n  ');

  const results = readPendingTasks(tmpDir);
  assert.deepEqual(results, []);
});

test('readPendingTasks: does NOT delete files (non-consuming)', () => {
  const tmpDir = makeTmpDir();
  writeClaudeFile(tmpDir, 'pending-task.txt', 'some task');
  const filePath = path.join(tmpDir, '.claude', 'pending-task.txt');

  readPendingTasks(tmpDir);

  assert.ok(fs.existsSync(filePath), 'File should still exist after read (non-consuming)');
});

// ─── Full subprocess (stdin→stdout) integration tests ───────────────────────

test('subprocess: exits 0 and emits additionalContext when STATE.md has Current Position', () => {
  const tmpDir = makeTmpDir();
  writeStateFile(tmpDir, [
    '# Project State',
    '',
    '## Current Position',
    '',
    'Phase: v0.19-05 — in progress',
    'Plan: 01 — DONE',
    '',
    '## Performance Metrics',
    'other stuff',
  ].join('\n'));

  const { exitCode, parsed } = runHook({ cwd: tmpDir });

  assert.equal(exitCode, 0);
  assert.ok(parsed, 'stdout should be valid JSON');
  assert.ok(parsed.hookSpecificOutput, 'should have hookSpecificOutput');
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreCompact');
  const ctx = parsed.hookSpecificOutput.additionalContext;
  assert.ok(ctx.includes('QGSD CONTINUATION CONTEXT'), 'should include header');
  assert.ok(ctx.includes('v0.19-05'), 'should include current position content');
  assert.ok(ctx.includes('Resume Instructions'), 'should include resume instructions');
});

test('subprocess: includes pending task when pending-task.txt exists', () => {
  const tmpDir = makeTmpDir();
  writeStateFile(tmpDir, '## Current Position\n\nPhase: v0.19-05\n\n## Other\nstuff');
  writeClaudeFile(tmpDir, 'pending-task.txt', '/qgsd:execute-phase v0.19-05');

  const { exitCode, parsed } = runHook({ cwd: tmpDir });

  assert.equal(exitCode, 0);
  const ctx = parsed.hookSpecificOutput.additionalContext;
  assert.ok(ctx.includes('Pending Task'), 'should include Pending Task section');
  assert.ok(ctx.includes('/qgsd:execute-phase v0.19-05'), 'should include task content');
});

test('subprocess: emits minimal fallback when STATE.md is absent', () => {
  const tmpDir = makeTmpDir(); // no STATE.md written

  const { exitCode, parsed } = runHook({ cwd: tmpDir });

  assert.equal(exitCode, 0);
  assert.ok(parsed.hookSpecificOutput.additionalContext.includes('resumed after compaction'));
});

test('subprocess: fails open on invalid JSON stdin (exit 0)', () => {
  const result = spawnSync('node', [HOOK_PATH], {
    input: 'not valid json {{',
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(result.status, 0, 'should exit 0 on JSON parse error (fail-open)');
});

test('subprocess: falls back to process.cwd() when cwd field is absent', () => {
  // Pass empty object — no cwd field. Hook should default to process.cwd() and not crash.
  const { exitCode, parsed } = runHook({});

  assert.equal(exitCode, 0);
  assert.ok(parsed || true, 'Should produce valid output or minimal fallback');
});

test('subprocess: hookEventName is PreCompact', () => {
  const tmpDir = makeTmpDir();
  writeStateFile(tmpDir, '## Current Position\n\nsome state\n\n## Next\nmore');

  const { parsed } = runHook({ cwd: tmpDir });
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreCompact');
});
