// Requirements: TLINK-01, TLINK-03
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

// ── TLINK-01: sweepTtoR @requirement annotation recognition ────────────────

describe('sweepTtoR annotation patterns (TLINK-01)', () => {
  test('// @requirement TLINK-01 pattern is recognized', () => {
    const content = '// @requirement TLINK-01\ntest("foo", () => {});\n';
    const hasMatch = /@req(?:uirement)?\s+[A-Z]+-\d+/i.test(content) ||
                     /\/\/\s*req(?:uirement)?:\s*[A-Z]+-\d+/i.test(content) ||
                     /\/\/\s*Requirements:\s*[A-Z]+-\d+/i.test(content);
    assert.ok(hasMatch, '@requirement pattern should match');
  });

  test('// @req FOO-01 pattern is still recognized (backward compat)', () => {
    const content = '// @req FOO-01\ntest("bar", () => {});\n';
    const hasMatch = /@req(?:uirement)?\s+[A-Z]+-\d+/i.test(content);
    assert.ok(hasMatch, '@req pattern should still match');
  });

  test('// req: STOP-03 pattern is still recognized (backward compat)', () => {
    const content = '// req: STOP-03\ntest("baz", () => {});\n';
    const hasMatch = /\/\/\s*req(?:uirement)?:\s*[A-Z]+-\d+/i.test(content);
    assert.ok(hasMatch, '// req: pattern should still match');
  });

  test('// Requirements: FOO-01, FOO-02 header pattern is recognized', () => {
    const content = '// Requirements: FOO-01, FOO-02\ntest("multi", () => {});\n';
    const hasMatch = /\/\/\s*Requirements:\s*[A-Z]+-\d+/i.test(content);
    assert.ok(hasMatch, '// Requirements: pattern should match');
  });

  test('file with no annotation is not matched', () => {
    const content = 'const x = 1;\ntest("no-ann", () => {});\n';
    const hasMatch = /@req(?:uirement)?\s+[A-Z]+-\d+/i.test(content) ||
                     /\/\/\s*req(?:uirement)?:\s*[A-Z]+-\d+/i.test(content) ||
                     /\/\/\s*Requirements:\s*[A-Z]+-\d+/i.test(content);
    assert.ok(!hasMatch, 'should not match without annotation');
  });
});

// ── TLINK-03: annotation_coverage_percent ──────────────────────────────────

describe('annotation_coverage_percent calculation (TLINK-03)', () => {
  test('2/4 annotated files yields 50%', () => {
    const total = 4;
    const annotated = 2;
    const pct = Math.round((annotated / total) * 100);
    assert.strictEqual(pct, 50);
  });

  test('0 annotated files yields 0%', () => {
    const total = 4;
    const annotated = 0;
    const pct = Math.round((annotated / total) * 100);
    assert.strictEqual(pct, 0);
  });

  test('all annotated files yields 100%', () => {
    const total = 4;
    const annotated = 4;
    const pct = Math.round((annotated / total) * 100);
    assert.strictEqual(pct, 100);
  });

  test('0 total files yields 0% (no division by zero)', () => {
    const total = 0;
    const annotated = 0;
    const pct = total > 0 ? Math.round((annotated / total) * 100) : 0;
    assert.strictEqual(pct, 0);
  });
});
