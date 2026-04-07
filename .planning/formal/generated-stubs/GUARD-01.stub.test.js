#!/usr/bin/env node
// @requirement GUARD-01
// Structural test: quick workflow enforces formal modeling steps in --full mode
// with MUST_NOT_SKIP annotations, anti-urgency guardrails, baseline tooling checks,
// and post-execution audit gates.
// Full test suite: bin/quick-workflow-guardrails.test.cjs

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');
const WORKFLOW = path.join(ROOT, 'core', 'workflows', 'quick.md');

test('GUARD-01: quick.md contains MUST_NOT_SKIP annotations (>= 5)', () => {
  const content = fs.readFileSync(WORKFLOW, 'utf8');
  const matches = content.match(/MUST_NOT_SKIP/g);
  assert.ok(matches && matches.length >= 5,
    `Expected >= 5 MUST_NOT_SKIP annotations, found ${matches ? matches.length : 0}`);
});

test('GUARD-01: quick.md contains ANTI-URGENCY GUARDRAIL', () => {
  const content = fs.readFileSync(WORKFLOW, 'utf8');
  assert.ok(content.includes('ANTI-URGENCY GUARDRAIL'),
    'must contain ANTI-URGENCY GUARDRAIL in executor constraints');
});

test('GUARD-01: no silent skip clauses remain', () => {
  const content = fs.readFileSync(WORKFLOW, 'utf8');
  assert.ok(!content.includes('skip silently (fail-open)'),
    'must not contain "skip silently (fail-open)" — all skips must be logged');
});

test('GUARD-01: Step 5.9 and Step 6.1 exist', () => {
  const content = fs.readFileSync(WORKFLOW, 'utf8');
  assert.ok(content.includes('Step 5.9'), 'Step 5.9 baseline check must exist');
  assert.ok(content.includes('Step 6.1'), 'Step 6.1 audit gate must exist');
});
