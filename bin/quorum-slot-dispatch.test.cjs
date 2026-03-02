#!/usr/bin/env node
'use strict';
// bin/quorum-slot-dispatch.test.cjs
// TDD tests for v0.24-05: Prompt construction (DISP-04) and output parsing (DISP-05)
// Requirements: DISP-04, DISP-05
//
// STRUCTURAL tests are RED until Plan 02 creates bin/quorum-slot-dispatch.cjs.
// BEHAVIORAL tests are RED until Plan 02 implements the exported functions.
// Pattern: quorum-slot-dispatch\.cjs|buildModeAPrompt|buildModeBPrompt|parseVerdict|parseReasoning|parseCitations|parseImprovements|emitResultBlock

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// ── Load module with fail-open guard ────────────────────────────────────────
// Wraps require() in try/catch so the runner does not crash when quorum-slot-dispatch.cjs
// does not exist yet. Each test must check `assert.ok(mod, ...)` before calling exports.
let mod;
try {
  mod = require(path.resolve(__dirname, './quorum-slot-dispatch.cjs'));
} catch (e) {
  mod = null;
}

// ── STRUCTURAL TESTS (RED until Plan 02 complete) ────────────────────────────

test('module exists: bin/quorum-slot-dispatch.cjs can be required without error', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
});

test('prompt construction exports: buildModeAPrompt is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.buildModeAPrompt, 'function',
    'buildModeAPrompt must be exported from bin/quorum-slot-dispatch.cjs');
});

test('prompt construction exports: buildModeBPrompt is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.buildModeBPrompt, 'function',
    'buildModeBPrompt must be exported from bin/quorum-slot-dispatch.cjs');
});

test('output parsing exports: parseVerdict is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.parseVerdict, 'function',
    'parseVerdict must be exported from bin/quorum-slot-dispatch.cjs');
});

test('output parsing exports: parseReasoning is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.parseReasoning, 'function',
    'parseReasoning must be exported from bin/quorum-slot-dispatch.cjs');
});

test('output parsing exports: parseCitations is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.parseCitations, 'function',
    'parseCitations must be exported from bin/quorum-slot-dispatch.cjs');
});

test('result emission export: emitResultBlock is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.emitResultBlock, 'function',
    'emitResultBlock must be exported from bin/quorum-slot-dispatch.cjs');
});

test('parseImprovements exported: parseImprovements is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.parseImprovements, 'function',
    'parseImprovements must be exported from bin/quorum-slot-dispatch.cjs — migration from gsd-quorum-slot-worker-improvements.test.cjs');
});

// ── BEHAVIORAL TESTS — buildModeAPrompt ─────────────────────────────────────

test('buildModeAPrompt Round 1 basic: contains required header, repository, question, and Round 1 instructions', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({ round: 1, repoDir: '/tmp/repo', question: 'Is this good?' });
  assert.ok(result.includes('QGSD Quorum — Round 1'),
    'Expected "QGSD Quorum — Round 1" in output');
  assert.ok(result.includes('Repository: /tmp/repo'),
    'Expected "Repository: /tmp/repo" in output');
  assert.ok(result.includes('Question: Is this good?'),
    'Expected "Question: Is this good?" in output');
  assert.ok(result.includes('IMPORTANT: Before answering'),
    'Expected Round 1 instruction "IMPORTANT: Before answering" in output');
});

test('buildModeAPrompt Round 1: does NOT include Prior positions (no cross-pollination in R1)', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({ round: 1, repoDir: '/tmp/repo', question: 'Is this good?' });
  assert.ok(!result.includes('Prior positions'),
    'Round 1 prompt must NOT contain "Prior positions" (cross-pollination only in R2+)');
});

test('buildModeAPrompt Round 2 with prior_positions: contains prior positions and revision question', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({
    round: 2,
    repoDir: '/tmp/repo',
    question: 'Is this good?',
    priorPositions: 'Model A: APPROVE — looks fine.'
  });
  assert.ok(result.includes('Prior positions'),
    'Expected "Prior positions" in Round 2 prompt');
  assert.ok(result.includes('do you maintain your answer or revise it'),
    'Expected revision prompt in Round 2 output');
});

test('buildModeAPrompt Round 2: does NOT contain IMPORTANT: Before answering (Round 1 only)', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({
    round: 2,
    repoDir: '/tmp/repo',
    question: 'Is this good?',
    priorPositions: 'Model A: APPROVE — looks fine.'
  });
  assert.ok(!result.includes('IMPORTANT: Before answering'),
    '"IMPORTANT: Before answering" must NOT appear in Round 2 prompts');
});

test('buildModeAPrompt with artifact and review_context: contains artifact section and review context', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({
    round: 1,
    repoDir: '/tmp/repo',
    question: 'Does the plan look right?',
    artifactPath: '.planning/foo.md',
    reviewContext: 'This is a plan.'
  });
  assert.ok(result.includes('=== Artifact ==='),
    'Expected "=== Artifact ===" in output when artifactPath provided');
  assert.ok(result.includes('Path: .planning/foo.md'),
    'Expected "Path: .planning/foo.md" in output');
  assert.ok(result.includes('REVIEW CONTEXT: This is a plan.'),
    'Expected "REVIEW CONTEXT: This is a plan." in output when reviewContext provided');
});

test('buildModeAPrompt with request_improvements: contains improvements instruction block', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({
    round: 1,
    repoDir: '/tmp/repo',
    question: 'Is this good?',
    requestImprovements: true
  });
  assert.ok(result.includes('If you APPROVE and have specific, actionable improvements'),
    'Expected improvements instruction when requestImprovements=true');
  assert.ok(result.includes('Improvements:'),
    'Expected "Improvements:" section header in improvements instruction');
});

test('buildModeAPrompt Round 2 with review_context: includes review context reminder', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({
    round: 2,
    repoDir: '/tmp/repo',
    question: 'Is this good?',
    priorPositions: 'Model A: APPROVE.',
    reviewContext: 'This is a plan.'
  });
  assert.ok(result.includes('REVIEW CONTEXT REMINDER: This is a plan.'),
    'Expected "REVIEW CONTEXT REMINDER: This is a plan." in Round 2 prompt with reviewContext');
});

// ── BEHAVIORAL TESTS — buildModeBPrompt ─────────────────────────────────────

test('buildModeBPrompt Round 1: contains execution review header, traces section, and verdict format', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeBPrompt({
    round: 1,
    repoDir: '/tmp/repo',
    question: 'Does it pass?',
    traces: '=== Command: node --test === exit 0'
  });
  assert.ok(result.includes('QGSD Quorum — Execution Review (Round 1)'),
    'Expected "QGSD Quorum — Execution Review (Round 1)" in Mode B prompt');
  assert.ok(result.includes('=== EXECUTION TRACES ==='),
    'Expected "=== EXECUTION TRACES ===" section in Mode B prompt');
  assert.ok(result.includes('verdict: APPROVE | REJECT | FLAG'),
    'Expected verdict format "verdict: APPROVE | REJECT | FLAG" in Mode B prompt');
});

test('buildModeBPrompt Round 2 with prior_positions: contains prior positions section', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeBPrompt({
    round: 2,
    repoDir: '/tmp/repo',
    question: 'Does it pass?',
    traces: '=== Command: node --test === exit 0',
    priorPositions: 'Model A: APPROVE — tests pass.'
  });
  assert.ok(result.includes('Prior positions'),
    'Expected "Prior positions" in Mode B Round 2 prompt');
});

// ── BEHAVIORAL TESTS — parseVerdict ─────────────────────────────────────────

test('parseVerdict Mode B — APPROVE: extracts APPROVE from verdict line', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseVerdict('verdict: APPROVE\nreasoning: Tests pass.');
  assert.strictEqual(result, 'APPROVE',
    'Expected parseVerdict to return "APPROVE" when verdict: APPROVE in output');
});

test('parseVerdict Mode B — REJECT: extracts REJECT from verdict line', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseVerdict('verdict: REJECT\nreasoning: Tests fail.');
  assert.strictEqual(result, 'REJECT',
    'Expected parseVerdict to return "REJECT" when verdict: REJECT in output');
});

test('parseVerdict Mode B — FLAG: extracts FLAG from verdict line', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseVerdict('verdict: FLAG\nreasoning: Ambiguous result.');
  assert.strictEqual(result, 'FLAG',
    'Expected parseVerdict to return "FLAG" when verdict: FLAG in output');
});

test('parseVerdict Mode B — no match defaults to FLAG', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseVerdict('Some random output without verdict');
  assert.strictEqual(result, 'FLAG',
    'Expected parseVerdict to return "FLAG" when no verdict: line found (fail-open default)');
});

// ── BEHAVIORAL TESTS — parseReasoning ───────────────────────────────────────

test('parseReasoning — extracts reasoning from reasoning: line', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseReasoning('verdict: APPROVE\nreasoning: All checks pass and tests are green.');
  assert.ok(result && result.includes('All checks pass'),
    'Expected parseReasoning to extract text after "reasoning:" line');
});

test('parseReasoning — returns null when no reasoning line present', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseReasoning('verdict: APPROVE\nsome other text');
  // Either null or empty — must not throw
  assert.ok(result === null || result === '' || result === undefined,
    'Expected parseReasoning to return null/empty when no reasoning: line present');
});

// ── BEHAVIORAL TESTS — parseCitations ───────────────────────────────────────

test('parseCitations — extracts citation block from citations: | section', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const input = 'citations: |\n  bin/foo.cjs line 42\n  bin/bar.cjs line 10';
  const result = mod.parseCitations(input);
  assert.ok(result && result.includes('bin/foo.cjs line 42'),
    'Expected parseCitations to extract "bin/foo.cjs line 42" from citations block');
});

test('parseCitations — handles mixed indentation (tab vs space)', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const input = 'citations: |\n\tbin/foo.cjs line 42\n\tbin/bar.cjs line 10';
  const result = mod.parseCitations(input);
  // Tab-indented citations must still be extracted
  assert.ok(result && result.includes('bin/foo.cjs line 42'),
    'Expected parseCitations to handle tab-indented citations');
});

test('parseCitations — returns null when no citations section present', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseCitations('verdict: APPROVE\nreasoning: No issues.');
  assert.ok(result === null || result === '' || result === undefined,
    'Expected parseCitations to return null when no citations: section in output');
});

// ── BEHAVIORAL TESTS — emitResultBlock ──────────────────────────────────────

test('emitResultBlock — produces correct YAML format with required fields', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.emitResultBlock({
    slot: 'gemini-1',
    round: 1,
    verdict: 'APPROVE',
    reasoning: 'OK',
    rawOutput: 'test output'
  });
  assert.ok(result.includes('slot: gemini-1'),
    'Expected "slot: gemini-1" in emitResultBlock output');
  assert.ok(result.includes('round: 1'),
    'Expected "round: 1" in emitResultBlock output');
  assert.ok(result.includes('verdict: APPROVE'),
    'Expected "verdict: APPROVE" in emitResultBlock output');
});
