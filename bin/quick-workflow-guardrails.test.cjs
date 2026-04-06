#!/usr/bin/env node
'use strict';
// bin/quick-workflow-guardrails.test.cjs
// Structural tests for GUARD-01: formal-skip prevention guardrails in quick.md
// Requirements: GUARD-01, quick-375

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW_PATH = path.join(__dirname, '..', 'core', 'workflows', 'quick.md');
const INSTALLED_PATH = path.join(
  process.env.HOME, '.claude', 'nf', 'workflows', 'quick.md'
);

let content;

test('quick.md workflow file exists', () => {
  assert.ok(fs.existsSync(WORKFLOW_PATH), `${WORKFLOW_PATH} must exist`);
  content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
});

// ── MUST_NOT_SKIP annotations ─────────────────────────────────────────

test('GUARD-01: MUST_NOT_SKIP annotations present on all guarded steps', () => {
  const matches = content.match(/MUST_NOT_SKIP/g);
  assert.ok(matches, 'MUST_NOT_SKIP annotation must exist in workflow');
  assert.ok(
    matches.length >= 10,
    `Expected >= 10 MUST_NOT_SKIP annotations (orchestrator: 2.7, 5, 5.5, 5.7, 5.8 + executor: 4.5, 5.9, 6.1, 6.3, 6.5), found ${matches.length}`
  );
});

test('GUARD-01: MUST_NOT_SKIP on Step 4.5 (formal scope scan)', () => {
  // Find MUST_NOT_SKIP near Step 4.5
  const step45Idx = content.indexOf('Step 4.5');
  assert.ok(step45Idx !== -1, 'Step 4.5 must exist');
  const nextChunk = content.slice(step45Idx, step45Idx + 500);
  assert.ok(
    nextChunk.includes('MUST_NOT_SKIP'),
    'Step 4.5 must have MUST_NOT_SKIP annotation'
  );
});

test('GUARD-01: MUST_NOT_SKIP on Step 6.3 (post-execution formal check)', () => {
  const step63Idx = content.indexOf('Step 6.3');
  assert.ok(step63Idx !== -1, 'Step 6.3 must exist');
  const nextChunk = content.slice(step63Idx, step63Idx + 500);
  assert.ok(
    nextChunk.includes('MUST_NOT_SKIP'),
    'Step 6.3 must have MUST_NOT_SKIP annotation'
  );
});

test('GUARD-01: MUST_NOT_SKIP on Step 6.5 (verification)', () => {
  // Find the Step 6.5 header (not earlier references to "Step 6.5")
  const step65Idx = content.indexOf('**Step 6.5: Verification');
  assert.ok(step65Idx !== -1, 'Step 6.5 header must exist');
  const nextChunk = content.slice(step65Idx, step65Idx + 500);
  assert.ok(
    nextChunk.includes('MUST_NOT_SKIP'),
    'Step 6.5 must have MUST_NOT_SKIP annotation'
  );
});

// ── Orchestrator-level MUST_NOT_SKIP ──────────────────────────────────

test('GUARD-01: MUST_NOT_SKIP on Step 2.7 (Haiku classification)', () => {
  const idx = content.indexOf('**Step 2.7: Derive approach');
  assert.ok(idx !== -1, 'Step 2.7 header must exist');
  const nextChunk = content.slice(idx, idx + 500);
  assert.ok(
    nextChunk.includes('MUST_NOT_SKIP'),
    'Step 2.7 must have MUST_NOT_SKIP annotation'
  );
});

test('GUARD-01: MUST_NOT_SKIP on Step 5 (planner spawn)', () => {
  const idx = content.indexOf('**Step 5: Spawn planner');
  assert.ok(idx !== -1, 'Step 5 header must exist');
  const nextChunk = content.slice(idx, idx + 500);
  assert.ok(
    nextChunk.includes('MUST_NOT_SKIP'),
    'Step 5 must have MUST_NOT_SKIP annotation'
  );
});

test('GUARD-01: MUST_NOT_SKIP on Step 5.5 (plan checker)', () => {
  const idx = content.indexOf('**Step 5.5: Plan-checker');
  assert.ok(idx !== -1, 'Step 5.5 header must exist');
  const nextChunk = content.slice(idx, idx + 500);
  assert.ok(
    nextChunk.includes('MUST_NOT_SKIP'),
    'Step 5.5 must have MUST_NOT_SKIP annotation'
  );
});

test('GUARD-01: MUST_NOT_SKIP on Step 5.7 (quorum review)', () => {
  const idx = content.indexOf('**Step 5.7: Quorum review');
  assert.ok(idx !== -1, 'Step 5.7 header must exist');
  const nextChunk = content.slice(idx, idx + 500);
  assert.ok(
    nextChunk.includes('MUST_NOT_SKIP'),
    'Step 5.7 must have MUST_NOT_SKIP annotation'
  );
});

test('GUARD-01: MUST_NOT_SKIP on Step 5.8 (debug routing)', () => {
  const idx = content.indexOf('**Step 5.8: Debug routing');
  assert.ok(idx !== -1, 'Step 5.8 header must exist');
  const nextChunk = content.slice(idx, idx + 500);
  assert.ok(
    nextChunk.includes('MUST_NOT_SKIP'),
    'Step 5.8 must have MUST_NOT_SKIP annotation'
  );
});

// ── Orchestrator skip anti-patterns ───────────────────────────────────

test('GUARD-01: orchestrator skip anti-patterns documented', () => {
  assert.ok(
    content.includes('Orchestrator skip -- do NOT'),
    'Anti-patterns section must document orchestrator-level skip prevention'
  );
});

// ── Anti-urgency guardrail ────────────────────────────────────────────

test('GUARD-01: anti-urgency guardrail present in executor constraints', () => {
  assert.ok(
    content.includes('ANTI-URGENCY GUARDRAIL'),
    'ANTI-URGENCY GUARDRAIL must be present in executor prompt'
  );
});

test('GUARD-01: anti-urgency guardrail is FIRST constraint in executor', () => {
  // The anti-urgency guardrail must appear before "Execute all tasks in the plan"
  const guardrailIdx = content.indexOf('ANTI-URGENCY GUARDRAIL');
  const executeIdx = content.indexOf('Execute all tasks in the plan');
  assert.ok(guardrailIdx !== -1, 'ANTI-URGENCY GUARDRAIL must exist');
  assert.ok(executeIdx !== -1, '"Execute all tasks in the plan" must exist');
  assert.ok(
    guardrailIdx < executeIdx,
    'ANTI-URGENCY GUARDRAIL must appear before "Execute all tasks in the plan"'
  );
});

// ── No silent skips ───────────────────────────────────────────────────

test('GUARD-01: no "skip silently (fail-open)" clauses in executor constraints', () => {
  // The executor constraints section is between <constraints> tags in Step 6
  const constraintsStart = content.indexOf('<constraints>\n- **ANTI-URGENCY');
  if (constraintsStart === -1) {
    // Fallback: just check the whole file for the problematic pattern
    const matches = content.match(/skip silently \(fail-open\)/g);
    assert.ok(
      !matches,
      `Found ${matches ? matches.length : 0} "skip silently (fail-open)" clauses — all should be replaced with logged warnings`
    );
    return;
  }
  const constraintsEnd = content.indexOf('</constraints>', constraintsStart);
  const constraintsSection = content.slice(constraintsStart, constraintsEnd);
  assert.ok(
    !constraintsSection.includes('skip silently (fail-open)'),
    'Executor constraints must not contain "skip silently (fail-open)" — use logged WARNING instead'
  );
});

// ── Step 5.9: Baseline presence check ─────────────────────────────────

test('GUARD-01: Step 5.9 (formal tooling baseline check) exists', () => {
  assert.ok(
    content.includes('Step 5.9'),
    'Step 5.9 must exist in the workflow'
  );
  assert.ok(
    /formal.tooling.baseline/i.test(content),
    'Step 5.9 must reference formal tooling baseline'
  );
});

test('GUARD-01: Step 5.9 checks required tool scripts', () => {
  const step59Idx = content.indexOf('Step 5.9');
  const nextSection = content.slice(step59Idx, step59Idx + 1500);
  assert.ok(
    nextSection.includes('formal-coverage-intersect.cjs'),
    'Step 5.9 must check for formal-coverage-intersect.cjs'
  );
  assert.ok(
    nextSection.includes('run-formal-verify.cjs'),
    'Step 5.9 must check for run-formal-verify.cjs'
  );
  assert.ok(
    nextSection.includes('run-formal-check.cjs'),
    'Step 5.9 must check for run-formal-check.cjs'
  );
});

// ── Step 6.1: Post-execution audit gate ───────────────────────────────

test('GUARD-01: Step 6.1 (post-execution formal loop audit) exists', () => {
  assert.ok(
    content.includes('Step 6.1'),
    'Step 6.1 must exist in the workflow'
  );
});

test('GUARD-01: Step 6.1 checks for Loop 2 evidence', () => {
  const step61Idx = content.indexOf('Step 6.1');
  const nextSection = content.slice(step61Idx, step61Idx + 1500);
  assert.ok(
    nextSection.includes('Loop 2') || nextSection.includes('LOOP2'),
    'Step 6.1 must check for Loop 2 execution evidence'
  );
});

// ── FORMAL_TOOLS_MISSING interpolation ────────────────────────────────

test('GUARD-01: FORMAL_TOOLS_MISSING interpolated into executor prompt', () => {
  assert.ok(
    content.includes('formal_tooling_notice'),
    'formal_tooling_notice block must exist for FORMAL_TOOLS_MISSING interpolation'
  );
});

test('GUARD-01: FORMAL_TOOLS_MISSING referenced in at least 3 places', () => {
  const matches = content.match(/FORMAL_TOOLS_MISSING/g);
  assert.ok(matches, 'FORMAL_TOOLS_MISSING must be referenced');
  assert.ok(
    matches.length >= 3,
    `FORMAL_TOOLS_MISSING must appear >= 3 times (Step 5.9 store, executor interpolation, Step 6.1 check), found ${matches.length}`
  );
});

// ── Loop 2 mandatory reporting ────────────────────────────────────────

test('GUARD-01: Loop 2 SUMMARY.md reporting constraint exists', () => {
  assert.ok(
    content.includes('Loop 2 SUMMARY.md reporting'),
    'Mandatory Loop 2 SUMMARY.md reporting constraint must exist'
  );
});

test('GUARD-01: Loop 2 reporting covers all 4 outcomes', () => {
  // All 4 outcome strings must be documented
  const reportingIdx = content.indexOf('Loop 2 SUMMARY.md reporting');
  assert.ok(reportingIdx !== -1);
  const section = content.slice(reportingIdx, reportingIdx + 2000);
  assert.ok(section.includes('Converged'), 'Must cover Converged outcome');
  assert.ok(
    section.includes('Non-converged') || section.includes('non-converged'),
    'Must cover Non-converged outcome'
  );
  assert.ok(
    section.includes('Skipped') || section.includes('skipped'),
    'Must cover Skipped outcome'
  );
  assert.ok(
    section.includes('Not applicable') || section.includes('not applicable'),
    'Must cover Not applicable outcome'
  );
});

// ── Anti-patterns section ─────────────────────────────────────────────

test('GUARD-01: formal modeling skip anti-patterns documented', () => {
  assert.ok(
    /Formal modeling skip/i.test(content),
    'Anti-patterns section must document formal modeling skip prevention'
  );
});

// ── Install sync ──────────────────────────────────────────────────────

test('GUARD-01: installed workflow contains same guardrails as repo source', () => {
  if (!fs.existsSync(INSTALLED_PATH)) {
    // Skip if not installed (CI environments)
    return;
  }
  const installed = fs.readFileSync(INSTALLED_PATH, 'utf8');
  // The installed copy may have path normalization differences (~/ vs absolute),
  // so check that all guardrail markers are present rather than exact equality
  assert.ok(
    installed.includes('MUST_NOT_SKIP'),
    'Installed workflow must contain MUST_NOT_SKIP annotations'
  );
  assert.ok(
    installed.includes('ANTI-URGENCY GUARDRAIL'),
    'Installed workflow must contain ANTI-URGENCY GUARDRAIL'
  );
  assert.ok(
    installed.includes('formal_tooling_notice'),
    'Installed workflow must contain formal_tooling_notice block'
  );
  assert.ok(
    installed.includes('Step 5.9'),
    'Installed workflow must contain Step 5.9'
  );
  assert.ok(
    installed.includes('Step 6.1'),
    'Installed workflow must contain Step 6.1'
  );
});
