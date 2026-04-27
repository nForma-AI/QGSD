#!/usr/bin/env node
'use strict';
// bin/nf-debug-runner.cjs
// Fix-cycle runner for a single debug benchmark stub.
// Protocol:
//   1. Run test → fail
//   2. Loop 1: generate formal model → iterate until model explains the bug
//   3. Loop 2: propose fix → iterate until fix satisfies all gates
//   4. Report result
//
// Usage:
//   node bin/nf-debug-runner.cjs --stub <path> --test <path> [--tier easy] [--verbose] [--no-formal]

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const stubIdx = args.indexOf('--stub');
const testIdx = args.indexOf('--test');
const tierIdx = args.indexOf('--tier');
const noFormalIdx = args.indexOf('--no-formal');
const timeoutIdx = args.indexOf('--timeout');

if (stubIdx === -1 || testIdx === -1) {
  process.stderr.write('ERROR: --stub <path> and --test <path> are required\n');
  process.exit(1);
}

const stubPath = path.resolve(args[stubIdx + 1]);
const testPath = path.resolve(args[testIdx + 1]);
const tier = tierIdx !== -1 ? args[tierIdx + 1] : 'easy';
const useFormal = noFormalIdx === -1;
const quorumTimeout = timeoutIdx !== -1 ? parseInt(args[timeoutIdx + 1], 10) : 300000;

const FORMALISM_MAP = { easy: 'alloy', medium: 'alloy', hard: 'tla', extreme: 'tla', legendary: 'tla' };
const formalism = FORMALISM_MAP[tier] || 'alloy';
const MAX_MODEL_ITERS = 3;
const MAX_FIX_ITERS = 3;

if (dryRun) {
  process.stdout.write(JSON.stringify({ dry_run: true, stub: stubPath, test: testPath, formal: useFormal, tier, formalism }) + '\n');
  process.exit(0);
}

let originalStubSource = null;
const startTime = Date.now();

function log(msg) {
  if (verbose) process.stderr.write('[nf-debug-runner] ' + msg + '\n');
}

function callClaude(prompt, model, timeout) {
  const claudeCli = require('./resolve-cli.cjs').resolveCli('claude') || 'claude';
  return spawnSync(claudeCli, [
    '-p', prompt,
    '--dangerously-skip-permissions',
    '--model', model || 'claude-haiku-4-5-20251001'
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    timeout: timeout || 60000
  });
}

function extractCodeBlock(response) {
  const codeMatch = response.match(/```(?:js|javascript)?\n?([\s\S]*?)\n?```/);
  if (codeMatch) return codeMatch[1].trim();
  const stripped = response.replace(/^[^\n]*\n+/, '').trim();
  if (stripped.length > 0 && stripped.includes('function')) return stripped;
  return null;
}

function extractJson(response) {
  if (!response) return null;
  const start = response.indexOf('{');
  if (start === -1) return null;
  try { return JSON.parse(response.slice(start)); } catch (_) { return null; }
}

function exitError(error, details) {
  const output = { fixed: false, error, elapsed_ms: Date.now() - startTime };
  if (details) Object.assign(output, details);
  process.stdout.write(JSON.stringify(output) + '\n');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOOP 1: Formal Model Refinement
// Iterate until the model explains why the test fails.
// ═══════════════════════════════════════════════════════════════════════════════

function generateModelPrompt(stubSource, testSource, formalismType) {
  const formalismName = formalismType === 'tla' ? 'TLA+' : 'Alloy';
  return [
    'You are a formal methods expert. Given a JavaScript function and its test cases,',
    'generate a ' + formalismName + ' specification that:',
    '1. Defines the CORRECT behavior as a formal invariant',
    '2. Shows why the BUGGY implementation violates that invariant',
    '',
    'Rules:',
    '- The spec must encode the correct function behavior as a universally quantified assertion',
    '- Derive the correct behavior from the test expectations, NOT from the buggy implementation',
    '- The spec should make it clear WHAT the bug is (which operator/logic is wrong)',
    '- Also extract a plain English constraint describing the correct behavior',
    '',
    'Output format (strict):',
    'SPEC_START',
    '```' + (formalismType === 'tla' ? 'tla' : 'alloy'),
    '<your ' + formalismName + ' spec here>',
    '```',
    'SPEC_END',
    'INVARIANT: <mathematical expression of the correct behavior>',
    'ENGLISH: <plain English description of what the function must do>',
    'BUG_EXPLANATION: <one sentence explaining what the bug is and why the invariant is violated>',
  ].join('\n');
}

function validateModelPrompt(spec, invariant, english, bugExplanation, testFailureOutput) {
  return [
    'You are verifying a formal model for a bug diagnosis.',
    '',
    'Formal spec:',
    '```',
    spec,
    '```',
    '',
    'Invariant: ' + invariant,
    'English: ' + english,
    'Bug explanation: ' + bugExplanation,
    '',
    'Test failure output:',
    testFailureOutput.slice(0, 500),
    '',
    'Does this model correctly explain why the test fails?',
    'Answer ONLY: EXPLAINS or INCOMPLETE followed by a one-line reason.',
    'If the invariant correctly describes what the function should do AND the bug explanation',
    'correctly identifies the specific error, answer EXPLAINS.',
  ].join('\n');
}

function refineModelPrompt(stubSource, testSource, prevSpec, prevInvariant, reason, formalismType) {
  const formalismName = formalismType === 'tla' ? 'TLA+' : 'Alloy';
  return [
    'The previous ' + formalismName + ' model was judged INCOMPLETE.',
    'Reason: ' + reason,
    '',
    'Previous spec:',
    '```',
    prevSpec,
    '```',
    '',
    'Previous invariant: ' + prevInvariant,
    '',
    'Improve the model. The spec must:',
    '1. Precisely capture the correct behavior (not just approximate)',
    '2. Identify the EXACT bug in the implementation',
    '',
    'Buggy implementation:',
    '```js',
    stubSource,
    '```',
    '',
    'Test cases:',
    '```js',
    testSource,
    '```',
    '',
    'Output format (same as before):',
    'SPEC_START',
    '```' + (formalismType === 'tla' ? 'tla' : 'alloy'),
    '<improved spec>',
    '```',
    'SPEC_END',
    'INVARIANT: <refined invariant>',
    'ENGLISH: <refined English description>',
    'BUG_EXPLANATION: <refined bug explanation>',
  ].join('\n');
}

function parseModelResponse(response) {
  const specMatch = response.match(/SPEC_START[\s\S]*?```\w*\n([\s\S]*?)\n```[\s\S]*?SPEC_END/);
  const spec = specMatch ? specMatch[1].trim() : null;
  const invMatch = response.match(/INVARIANT:\s*(.+)/);
  const engMatch = response.match(/ENGLISH:\s*(.+)/);
  const bugMatch = response.match(/BUG_EXPLANATION:\s*(.+)/);
  return {
    spec: spec || response.trim(),
    invariant: invMatch ? invMatch[1].trim() : null,
    english: engMatch ? engMatch[1].trim() : null,
    bugExplanation: bugMatch ? bugMatch[1].trim() : null
  };
}

function runLoop1(stubSource, testSource, testFailureOutput) {
  let modelResult = null;
  let validated = false;

  for (let i = 1; i <= MAX_MODEL_ITERS; i++) {
    log('Loop 1 iteration ' + i + '/' + MAX_MODEL_ITERS + ': generating/refining formal model...');

    let prompt;
    if (i === 1) {
      prompt = generateModelPrompt(stubSource, testSource, formalism);
    } else {
      prompt = refineModelPrompt(stubSource, testSource, modelResult.spec, modelResult.invariant, modelResult.validationReason || 'unknown', formalism);
    }

    const result = callClaude(prompt, 'claude-haiku-4-5-20251001', 60000);
    if (result.status !== 0 || !result.stdout) {
      log('model generation call failed (iteration ' + i + ')');
      continue;
    }

    modelResult = parseModelResponse(result.stdout);
    modelResult.validationReason = null;

    if (!modelResult.invariant || !modelResult.english) {
      log('model missing invariant/english, refining...');
      modelResult.validationReason = 'Model output missing INVARIANT or ENGLISH fields';
      continue;
    }

    log('model generated — invariant: ' + modelResult.invariant);
    log('bug explanation: ' + (modelResult.bugExplanation || 'none'));

    // Validate: does the model explain the bug?
    const validPrompt = validateModelPrompt(modelResult.spec, modelResult.invariant, modelResult.english, modelResult.bugExplanation, testFailureOutput);
    const validResult = callClaude(validPrompt, 'claude-haiku-4-5-20251001', 30000);

    if (validResult.status === 0 && validResult.stdout) {
      const validText = validResult.stdout.trim().toUpperCase();
      if (validText.includes('EXPLAINS')) {
        validated = true;
        log('Loop 1 CONVERGED: model explains the bug (' + i + ' iteration(s))');
        break;
      } else {
        modelResult.validationReason = validResult.stdout.trim();
        log('model incomplete: ' + validResult.stdout.trim().slice(0, 100));
      }
    } else {
      log('model validation call failed, accepting as-is');
      validated = true;
      break;
    }
  }

  if (!validated && modelResult) {
    log('Loop 1 max iterations reached, using best model');
  }

  return modelResult;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOOP 2: Fix Refinement
// Iterate until the fix satisfies all gates:
//   Gate 1: Fix satisfies the formal invariant
//   Gate 2: Fix passes the test
//   Gate 3: Fix doesn't regress edge cases
// ═══════════════════════════════════════════════════════════════════════════════

function buildFixPrompt(stubSource, testFailureOutput, constraint, spec, bugExplanation, rejectionReason) {
  const constraintBlock = constraint ? [
    '',
    '[FORMAL CONSTRAINT — HARD REQUIREMENT]',
    'The following invariant was derived from formal analysis:',
    constraint.english,
    constraint.invariant ? ('Formal: ' + constraint.invariant) : '',
    '',
    'Your fix MUST satisfy this constraint. Fixes that violate it will be REJECTED.',
    '[END FORMAL CONSTRAINT]',
  ].join('\n') : '';

  const specBlock = spec ? [
    '',
    '[FORMAL SPECIFICATION]',
    spec,
    '[END SPECIFICATION]',
  ].join('\n') : '';

  const bugBlock = bugExplanation ? [
    '',
    '[BUG ANALYSIS]',
    bugExplanation,
    '[END BUG ANALYSIS]',
  ].join('\n') : '';

  const rejectionBlock = rejectionReason ? [
    '',
    '[PREVIOUS FIX REJECTED]',
    rejectionReason,
    'Address this rejection in your new fix. Do NOT repeat the same mistake.',
    '[END REJECTION]',
  ].join('\n') : '';

  return [
    'Fix the following buggy JavaScript function.',
    'The test is failing with this output:',
    testFailureOutput.slice(0, 500),
    '',
    'Buggy source (file: fn.cjs):',
    '```js',
    stubSource,
    '```',
    constraintBlock,
    specBlock,
    bugBlock,
    rejectionBlock,
    '',
    'Return ONLY the fixed source code in a ```js ... ``` code block. Do not explain.',
  ].join('\n');
}

function validateInvariantPrompt(fixedSource, constraint) {
  return [
    'You are verifying a bug fix against a formal specification.',
    '',
    'Proposed fix:',
    '```js',
    fixedSource,
    '```',
    '',
    'Formal invariant that the fix MUST satisfy:',
    constraint.english,
    constraint.invariant ? ('Formal expression: ' + constraint.invariant) : '',
    '',
    'Does the proposed fix satisfy the invariant?',
    'Answer ONLY: VALID or INVALID followed by a one-line reason.',
  ].join('\n');
}

function validateRegressionPrompt(stubSource, fixedSource, testSource) {
  return [
    'You are checking a bug fix for regressions.',
    '',
    'Original buggy code:',
    '```js',
    stubSource,
    '```',
    '',
    'Proposed fix:',
    '```js',
    fixedSource,
    '```',
    '',
    'Full test file:',
    '```js',
    testSource,
    '```',
    '',
    'Does the fix maintain correct behavior for ALL test cases, including edge cases?',
    'Could the fix break any case that the original code handled correctly?',
    '',
    'Answer ONLY: SAFE or REGRESSION followed by a one-line reason.',
  ].join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

try {
  // ── Step 1: Run test ────────────────────────────────────────────────────────
  let testResult = spawnSync('node', [testPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, cwd: process.cwd() });
  if (verbose && testResult.stderr) process.stderr.write(testResult.stderr);
  if (verbose && testResult.stdout) process.stderr.write(testResult.stdout);

  if (testResult.status === 0) {
    log('test already passes — no fix needed');
    process.stdout.write(JSON.stringify({ fixed: false, already_passing: true, elapsed_ms: Date.now() - startTime }) + '\n');
    process.exit(0);
  }

  const testFailureOutput = (testResult.stderr || '') + (testResult.stdout || '');

  // ── Step 2: Read stub ───────────────────────────────────────────────────────
  const stubSource = fs.readFileSync(stubPath, 'utf8');
  originalStubSource = stubSource;
  const testSource = fs.readFileSync(testPath, 'utf8');

  // ── Step 3: Loop 1 — Formal model refinement ───────────────────────────────
  let formalConstraint = null;
  let formalSpec = null;
  let bugExplanation = null;
  let loop1Iterations = 0;

  if (useFormal) {
    const modelResult = runLoop1(stubSource, testSource, testFailureOutput);
    if (modelResult) {
      formalConstraint = { invariant: modelResult.invariant, english: modelResult.english };
      formalSpec = modelResult.spec;
      bugExplanation = modelResult.bugExplanation;
    }
    loop1Iterations = MAX_MODEL_ITERS;
  } else {
    log('--no-formal: skipping Loop 1');
  }

  // ── Step 4: Loop 2 — Fix refinement with 3-gate validation ──────────────────
  let fixed = false;
  let fixedSource = null;
  let rejectionReason = null;
  let loop2Iterations = 0;
  let gatesPassing = { gate1_invariant: false, gate2_test: false, gate3_regression: false };

  for (let i = 1; i <= MAX_FIX_ITERS; i++) {
    loop2Iterations = i;
    log('Loop 2 iteration ' + i + '/' + MAX_FIX_ITERS + ': proposing fix...');

    const prompt = buildFixPrompt(stubSource, testFailureOutput, formalConstraint, formalSpec, bugExplanation, rejectionReason);
    const fixResult = callClaude(prompt, 'claude-haiku-4-5-20251001', quorumTimeout);

    if (fixResult.signal === 'SIGTERM' || (fixResult.error && fixResult.error.code === 'ETIMEDOUT')) {
      exitError('timeout');
    }
    if (fixResult.status !== 0 || !fixResult.stdout) {
      exitError('quorum_failed');
    }

    const proposed = extractCodeBlock(fixResult.stdout);
    if (!proposed) {
      log('no code block in response');
      rejectionReason = 'Previous attempt returned no code block. Output exactly the fixed source code in a ```js code block.';
      continue;
    }

    try { new Function(proposed); } catch (e) {
      log('proposed fix has invalid syntax: ' + e.message);
      rejectionReason = 'Previous fix had invalid JavaScript syntax: ' + e.message;
      continue;
    }

    // ── Gate 1: Invariant check ─────────────────────────────────────────────
    gatesPassing.gate1_invariant = true; // default pass
    if (formalConstraint && formalConstraint.english) {
      log('Gate 1: checking invariant...');
      const validResult = callClaude(
        validateInvariantPrompt(proposed, formalConstraint),
        'claude-haiku-4-5-20251001', 30000
      );
      if (validResult.status === 0 && validResult.stdout) {
        const validText = validResult.stdout.trim().toUpperCase();
        if (validText.includes('INVALID')) {
          gatesPassing.gate1_invariant = false;
          rejectionReason = 'Gate 1 FAILED (invariant violation): ' + validResult.stdout.trim();
          log(rejectionReason);
          continue;
        }
        log('Gate 1 PASSED: invariant satisfied');
      }
    }

    // ── Gate 2: Test check ──────────────────────────────────────────────────
    log('Gate 2: running test...');
    fs.writeFileSync(stubPath, proposed, 'utf8');
    testResult = spawnSync('node', [testPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, cwd: process.cwd() });
    gatesPassing.gate2_test = testResult.status === 0;

    if (!gatesPassing.gate2_test) {
      const failOutput = (testResult.stderr || '') + (testResult.stdout || '');
      rejectionReason = 'Gate 2 FAILED (test still fails): ' + failOutput.slice(0, 200);
      log(rejectionReason);
      // Restore stub for next iteration
      fs.writeFileSync(stubPath, originalStubSource, 'utf8');
      continue;
    }
    log('Gate 2 PASSED: test passes');

    // ── Gate 3: Regression check ────────────────────────────────────────────
    gatesPassing.gate3_regression = true; // default pass
    if (formalConstraint && formalConstraint.english) {
      log('Gate 3: checking for regressions...');
      const regResult = callClaude(
        validateRegressionPrompt(stubSource, proposed, testSource),
        'claude-haiku-4-5-20251001', 30000
      );
      if (regResult.status === 0 && regResult.stdout) {
        const regText = regResult.stdout.trim().toUpperCase();
        if (regText.includes('REGRESSION')) {
          gatesPassing.gate3_regression = false;
          rejectionReason = 'Gate 3 FAILED (regression risk): ' + regResult.stdout.trim();
          log(rejectionReason);
          fs.writeFileSync(stubPath, originalStubSource, 'utf8');
          continue;
        }
        log('Gate 3 PASSED: no regressions');
      }
    }

    // All gates passed
    fixed = true;
    fixedSource = proposed;
    log('Loop 2 CONVERGED: all gates passed (' + i + ' iteration(s))');
    break;
  }

  if (!fixed && fixedSource === null) {
    // Restore stub if we never got a passing fix
    if (originalStubSource !== null) {
      fs.writeFileSync(stubPath, originalStubSource, 'utf8');
    }
  }

  // ── Step 5: Report ──────────────────────────────────────────────────────────
  const allGates = gatesPassing.gate1_invariant && gatesPassing.gate2_test && gatesPassing.gate3_regression;
  const output = {
    fixed: fixed && allGates,
    exit_code: fixed && allGates ? 0 : 1,
    elapsed_ms: Date.now() - startTime,
    loop1_iterations: loop1Iterations,
    loop2_iterations: loop2Iterations,
    formal: useFormal ? {
      formalism,
      constraint: formalConstraint ? formalConstraint.english : null,
      invariant: formalConstraint ? formalConstraint.invariant : null,
      bug_explanation: bugExplanation,
      gates: gatesPassing
    } : null
  };

  process.stdout.write(JSON.stringify(output) + '\n');
  process.exit(output.fixed ? 0 : 1);
} finally {
  if (originalStubSource !== null && fs.existsSync(stubPath)) {
    try {
      const currentSource = fs.readFileSync(stubPath, 'utf8');
      if (currentSource !== originalStubSource) {
        fs.writeFileSync(stubPath, originalStubSource, 'utf8');
        if (verbose) process.stderr.write('[nf-debug-runner] stub restored\n');
      }
    } catch (_) {}
  }
}
