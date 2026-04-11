#!/usr/bin/env node
'use strict';
// bin/repowise/inject-cochange-debug.test.cjs
// Tests for bin/repowise/inject-cochange-debug.cjs — Co-change debug injection

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { injectCoChangeDebug } = require('./inject-cochange-debug.cjs');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// injectCoChangeDebug
// ---------------------------------------------------------------------------

describe('injectCoChangeDebug', () => {
  it('returns null for file with no co-change partners', () => {
    const result = injectCoChangeDebug('nonexistent/file.xyz', PROJECT_ROOT);
    assert.equal(result, null);
  });

  it('returns formatted string when partners exist', () => {
    // Use a file we know has co-change pairs
    const { computeCoChange } = require('./cochange.cjs');
    const cochange = computeCoChange(PROJECT_ROOT, { minSharedCommits: 2, minCouplingDegree: 0.1 });
    if (cochange.pairs.length > 0) {
      const file = cochange.pairs[0].file1;
      const result = injectCoChangeDebug(file, PROJECT_ROOT);
      assert.ok(result !== null, 'should return a string for a file with partners');
      assert.ok(result.includes('CO-CHANGE PARTNERS'), 'should include header');
      assert.ok(result.includes(file), 'should mention the file');
    }
  });

  it('output mentions partner files', () => {
    const { computeCoChange } = require('./cochange.cjs');
    const cochange = computeCoChange(PROJECT_ROOT, { minSharedCommits: 2, minCouplingDegree: 0.1 });
    if (cochange.pairs.length > 0) {
      const { file1, file2 } = cochange.pairs[0];
      const result = injectCoChangeDebug(file1, PROJECT_ROOT);
      if (result) {
        assert.ok(result.includes(file2), 'should mention partner file');
        assert.ok(result.includes('shared commits'), 'should include shared commits');
      }
    }
  });
});
