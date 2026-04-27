#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const stubIdx = args.indexOf('--stub');
const testIdx = args.indexOf('--test');
const tierIdx = args.indexOf('--tier');
const formatIdx = args.indexOf('--format');

if (stubIdx === -1 || testIdx === -1) {
  process.stderr.write('Usage: node bin/bench-formal-spec.cjs --stub <path> --test <path> [--tier <tier>] [--format json|text]\n');
  process.exit(1);
}

const stubPath = path.resolve(args[stubIdx + 1]);
const testPath = path.resolve(args[testIdx + 1]);
const tier = tierIdx !== -1 ? args[tierIdx + 1] : 'easy';
const format = formatIdx !== -1 ? args[formatIdx + 1] : 'json';
const ROOT = process.cwd();

const FORMALISM_MAP = {
  easy: 'alloy',
  medium: 'alloy',
  hard: 'tla',
  extreme: 'tla',
  legendary: 'tla'
};

const formalism = FORMALISM_MAP[tier] || 'alloy';

const stubSource = fs.readFileSync(stubPath, 'utf8');
const testSource = fs.readFileSync(testPath, 'utf8');

function buildAlloyPrompt(stub, test) {
  return [
    'You are a formal methods expert. Given a JavaScript function and its test cases,',
    'generate an Alloy specification that encodes the CORRECT behavior as a formal invariant.',
    '',
    'Rules:',
    '- The spec must define a signature for the function inputs and output',
    '- The spec must include a FACT that captures the correct function behavior',
    '- The fact should be expressed as a universally quantified assertion',
    '- Derive the correct behavior from the test expectations, NOT from the buggy implementation',
    '- Output ONLY the Alloy spec in a code block. No explanation.',
    '',
    'Buggy implementation (DO NOT copy its logic — it has a bug):',
    '```js',
    stub,
    '```',
    '',
    'Test cases (these define the CORRECT behavior):',
    '```js',
    test,
    '```',
  ].join('\n');
}

function buildTlaPrompt(stub, test) {
  return [
    'You are a formal methods expert. Given a JavaScript function and its test cases,',
    'generate a TLA+ specification that encodes the CORRECT behavior as a formal invariant.',
    '',
    'Rules:',
    '- Define variables and a type invariant',
    '- Include an operator that captures the correct function behavior',
    '- The invariant should be derivable from the test expectations',
    '- Output ONLY the TLA+ spec in a code block. No explanation.',
    '',
    'Buggy implementation (DO NOT copy its logic — it has a bug):',
    '```js',
    stub,
    '```',
    '',
    'Test cases (these define the CORRECT behavior):',
    '```js',
    test,
    '```',
  ].join('\n');
}

function buildConstraintPrompt(stub, test) {
  return [
    'Given the following JavaScript function and its test cases, extract the SINGLE',
    'most important behavioral constraint that the correct implementation must satisfy.',
    '',
    'Express it as:',
    '1. A formal invariant (mathematical notation)',
    '2. A plain English description',
    '',
    'Buggy implementation (has a bug):',
    '```js',
    stub,
    '```',
    '',
    'Test cases:',
    '```js',
    test,
    '```',
    '',
    'Output format (strict):',
    'INVARIANT: <mathematical expression of the correct behavior>',
    'ENGLISH: <plain English description of what the function must do>',
  ].join('\n');
}

function callLlm(prompt, model, timeout) {
  const resolveCli = require('./resolve-cli.cjs').resolveCli;
  const claudeCli = resolveCli('claude') || 'claude';
  const result = spawnSync(claudeCli, [
    '-p', prompt,
    '--dangerously-skip-permissions',
    '--model', model || 'claude-haiku-4-5-20251001'
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    timeout: timeout || 60000
  });

  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    signal: result.signal
  };
}

function extractSpec(response) {
  const codeMatch = response.match(/```(?:alloy|tla|tla\+)?\n?([\s\S]*?)\n?```/);
  if (codeMatch) return codeMatch[1].trim();
  return response.trim();
}

function extractConstraint(response) {
  const invMatch = response.match(/INVARIANT:\s*(.+)/);
  const engMatch = response.match(/ENGLISH:\s*(.+)/);
  return {
    invariant: invMatch ? invMatch[1].trim() : null,
    english: engMatch ? engMatch[1].trim() : null,
    raw: response
  };
}

async function main() {
  const startTime = Date.now();

  const specPrompt = formalism === 'tla'
    ? buildTlaPrompt(stubSource, testSource)
    : buildAlloyPrompt(stubSource, testSource);

  const specResult = callLlm(specPrompt, 'claude-haiku-4-5-20251001', 60000);
  if (specResult.status !== 0 || !specResult.stdout) {
    const output = {
      status: 'error',
      error: 'spec_generation_failed',
      formalism,
      elapsed_ms: Date.now() - startTime
    };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    process.exit(1);
  }

  const formalSpec = extractSpec(specResult.stdout);

  const constraintPrompt = buildConstraintPrompt(stubSource, testSource);
  const constraintResult = callLlm(constraintPrompt, 'claude-haiku-4-5-20251001', 60000);

  let constraint = { invariant: null, english: null, raw: '' };
  if (constraintResult.status === 0 && constraintResult.stdout) {
    constraint = extractConstraint(constraintResult.stdout);
  }

  const output = {
    status: 'ok',
    formalism,
    spec: formalSpec,
    constraint,
    elapsed_ms: Date.now() - startTime
  };

  if (format === 'text') {
    process.stdout.write('Formal spec (' + formalism + '):\n');
    process.stdout.write(formalSpec + '\n\n');
    if (constraint.english) {
      process.stdout.write('Constraint: ' + constraint.english + '\n');
    }
    if (constraint.invariant) {
      process.stdout.write('Invariant: ' + constraint.invariant + '\n');
    }
  } else {
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  }

  process.exit(0);
}

main().catch(function(err) {
  process.stderr.write('Fatal: ' + err.message + '\n');
  process.exit(1);
});
