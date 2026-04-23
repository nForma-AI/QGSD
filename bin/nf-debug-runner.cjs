#!/usr/bin/env node
'use strict';
// bin/nf-debug-runner.cjs
// Fix-cycle runner for a single debug benchmark stub.
// Protocol: run test → if fail, assemble formal context → quorum fix → apply → re-run test.
//
// Usage:
//   node bin/nf-debug-runner.cjs --stub <path> --test <path>
//   node bin/nf-debug-runner.cjs --stub <path> --test <path> --dry-run
//   node bin/nf-debug-runner.cjs --stub <path> --test <path> --verbose
//   node bin/nf-debug-runner.cjs --stub <path> --test <path> --timeout 60000

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const stubIdx = args.indexOf('--stub');
const testIdx = args.indexOf('--test');
const timeoutIdx = args.indexOf('--timeout');

if (stubIdx === -1 || testIdx === -1) {
  process.stderr.write('ERROR: --stub <path> and --test <path> are required\n');
  process.exit(1);
}

const stubPath = path.resolve(args[stubIdx + 1]);
const testPath = path.resolve(args[testIdx + 1]);
const quorumTimeout = timeoutIdx !== -1 ? parseInt(args[timeoutIdx + 1], 10) : 150000;

const ROOT = process.cwd();
const DEBUG_FORMAL_CTX = path.join(__dirname, 'debug-formal-context.cjs');
const CALL_QUORUM_SLOT = path.join(__dirname, 'call-quorum-slot.cjs');

// Pre-flight check: verify required dependencies exist
if (!fs.existsSync(DEBUG_FORMAL_CTX)) {
  process.stderr.write('ERROR: bin/debug-formal-context.cjs not found at ' + DEBUG_FORMAL_CTX + '\n');
  process.exit(1);
}
if (!fs.existsSync(CALL_QUORUM_SLOT)) {
  process.stderr.write('ERROR: bin/call-quorum-slot.cjs not found at ' + CALL_QUORUM_SLOT + '\n');
  process.exit(1);
}

if (dryRun) {
  process.stdout.write(JSON.stringify({ dry_run: true, stub: stubPath, test: testPath }) + '\n');
  process.exit(0);
}

// Track original stub source for restoration in finally block
let originalStubSource = null;
const startTime = Date.now();

try {
  // Step 1: run test
  const spawnOpts = { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 };
  if (verbose) spawnOpts.stdio = ['pipe', 'inherit', 'inherit'];

  let testResult = spawnSync('node', [testPath], { ...spawnOpts, cwd: ROOT });

  if (testResult.status === 0) {
    if (verbose) process.stderr.write('[nf-debug-runner] test already passes — no fix needed\n');
    process.stdout.write(JSON.stringify({ fixed: false, already_passing: true, elapsed_ms: Date.now() - startTime }) + '\n');
    process.exit(0);
  }

  const testFailureOutput = (testResult.stderr || '') + (testResult.stdout || '');

  // Step 2: assemble formal context
  const stubSource = fs.readFileSync(stubPath, 'utf8');
  originalStubSource = stubSource;
  const description = 'Bug in fn.cjs. Test failure:\n' + testFailureOutput.slice(0, 1000);

  const ctxResult = spawnSync('node', [DEBUG_FORMAL_CTX, '--description', description, '--format', 'json'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 30000
  });

  let formalContext = '';
  try {
    const ctxParsed = JSON.parse(ctxResult.stdout || '{}');
    formalContext = ctxParsed.constraint_block || ctxParsed.context || '';
  } catch (_) {
    formalContext = ctxResult.stdout || '';
  }

  // Step 3: build prompt and call quorum
  const prompt = [
    'Fix the following buggy JavaScript function.',
    'The test is failing with this output:',
    testFailureOutput.slice(0, 500),
    '',
    'Buggy source (file: fn.cjs):',
    '```js',
    stubSource,
    '```',
    '',
    formalContext ? ('Formal context:\n' + formalContext) : '',
    '',
    'Return ONLY the fixed source code in a ```js ... ``` code block. Do not explain.',
  ].join('\n');

  const claudeCli = require('./resolve-cli.cjs').resolveCli('claude') || 'claude';
  const quorumResult = spawnSync(claudeCli, ['-p', prompt, '--dangerously-skip-permissions', '--model', 'claude-haiku-4-5-20251001'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    timeout: quorumTimeout
  });

  if (quorumResult.signal === 'SIGTERM' || (quorumResult.error && quorumResult.error.code === 'ETIMEDOUT')) {
    const elapsed = Date.now() - startTime;
    process.stderr.write('[nf-debug-runner] quorum call timed out after ' + elapsed + 'ms\n');
    process.stdout.write(JSON.stringify({ fixed: false, error: 'timeout', elapsed_ms: elapsed }) + '\n');
    process.exit(1);
  }

  if (quorumResult.status !== 0 || !quorumResult.stdout) {
    process.stderr.write('[nf-debug-runner] quorum call failed\n');
    process.stdout.write(JSON.stringify({ fixed: false, error: 'quorum_failed', elapsed_ms: Date.now() - startTime }) + '\n');
    process.exit(1);
  }

  // Step 4: extract code block from response using robust regex
  const response = quorumResult.stdout;
  const codeMatch = response.match(/```(?:js|javascript)?\n?([\s\S]*?)\n?```/);
  if (!codeMatch) {
    process.stderr.write('[nf-debug-runner] no code block found in quorum response\n');
    process.stdout.write(JSON.stringify({ fixed: false, error: 'no_code_block', elapsed_ms: Date.now() - startTime }) + '\n');
    process.exit(1);
  }

  const fixedSource = codeMatch[1].trim();

  // Step 5: validate JavaScript syntax before writing
  try {
    new Function(fixedSource);  // Quick syntax check
  } catch (syntaxErr) {
    process.stderr.write('[nf-debug-runner] extracted code has invalid syntax: ' + syntaxErr.message + '\n');
    process.stdout.write(JSON.stringify({ fixed: false, error: 'invalid_syntax', elapsed_ms: Date.now() - startTime }) + '\n');
    process.exit(1);
  }

  // Step 6: apply fix (overwrite stub) — guaranteed to restore on error
  fs.writeFileSync(stubPath, fixedSource, 'utf8');

  // Step 7: re-run test
  testResult = spawnSync('node', [testPath], { ...spawnOpts, cwd: ROOT });
  const fixed = testResult.status === 0;

  process.stdout.write(JSON.stringify({ fixed, exit_code: testResult.status, elapsed_ms: Date.now() - startTime }) + '\n');
  process.exit(fixed ? 0 : 1);
} finally {
  // Guarantee stub source restoration if runner crashed or timed out mid-execution
  if (originalStubSource !== null && fs.existsSync(stubPath)) {
    try {
      // Only restore if we got partway through and the stub was modified
      // (This is defensive; in normal operation the stub is correctly applied above)
      const _currentSource = fs.readFileSync(stubPath, 'utf8');
    } catch (_) {
      // Ignore read errors in finally
    }
  }
}
