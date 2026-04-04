#!/usr/bin/env node
// bin/nf-solve-baseline-check.test.cjs
// TDD test suite for baseline advisory check (QUICK-373)

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper: create temp directory for test files
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nf-baseline-test-'));
}

// Helper: clean up temp directory
function cleanupTempDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Helper: checkBaselinePresence implementation (extracted for testing)
function checkBaselinePresence(rootPath) {
  try {
    const reqPath = path.join(rootPath, '.planning', 'formal', 'requirements.json');

    // First check: file existence
    if (!fs.existsSync(reqPath)) {
      return { has_baselines: false, baseline_count: 0, total_count: 0, file_missing: true };
    }

    // Second check: parse JSON
    const data = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
    const reqs = data.requirements || [];

    // Count baseline-sourced requirements
    const baselineCount = reqs.filter(r =>
      r.provenance && r.provenance.source_file === 'nf-baseline'
    ).length;

    return {
      has_baselines: baselineCount > 0,
      baseline_count: baselineCount,
      total_count: reqs.length,
      file_missing: false
    };
  } catch (e) {
    // Fail-open: JSON parse or other errors
    return {
      has_baselines: false,
      baseline_count: 0,
      total_count: 0,
      file_missing: false,
      error: e.message
    };
  }
}

// Test 1: Empty requirements array returns has_baselines: false, file_missing: false
test('Empty requirements array returns has_baselines: false, file_missing: false', function() {
  const tempDir = createTempDir();
  try {
    fs.mkdirSync(path.join(tempDir, '.planning', 'formal'), { recursive: true });
    const reqPath = path.join(tempDir, '.planning', 'formal', 'requirements.json');
    fs.writeFileSync(reqPath, JSON.stringify({ requirements: [] }));

    const result = checkBaselinePresence(tempDir);

    assert.strictEqual(result.has_baselines, false, 'Should indicate no baselines');
    assert.strictEqual(result.file_missing, false, 'File should exist');
    assert.strictEqual(result.baseline_count, 0, 'No baseline requirements');
    assert.strictEqual(result.total_count, 0, 'Total should be 0');
  } finally {
    cleanupTempDir(tempDir);
  }
});

// Test 2: All requirements have provenance.source_file === 'nf-baseline' returns has_baselines: true
test('All requirements have provenance.source_file === nf-baseline returns has_baselines: true', function() {
  const tempDir = createTempDir();
  try {
    fs.mkdirSync(path.join(tempDir, '.planning', 'formal'), { recursive: true });
    const reqPath = path.join(tempDir, '.planning', 'formal', 'requirements.json');
    const data = {
      requirements: [
        { id: 'REQ-01', text: 'First', provenance: { source_file: 'nf-baseline' } },
        { id: 'REQ-02', text: 'Second', provenance: { source_file: 'nf-baseline' } },
      ]
    };
    fs.writeFileSync(reqPath, JSON.stringify(data));

    const result = checkBaselinePresence(tempDir);

    assert.strictEqual(result.has_baselines, true, 'Should indicate baselines present');
    assert.strictEqual(result.baseline_count, 2, 'Should count 2 baseline requirements');
    assert.strictEqual(result.total_count, 2, 'Total should be 2');
  } finally {
    cleanupTempDir(tempDir);
  }
});

// Test 3: Mix of baseline and milestone requirements returns has_baselines: true with correct count
test('Mix of baseline and milestone requirements returns has_baselines: true with correct count', function() {
  const tempDir = createTempDir();
  try {
    fs.mkdirSync(path.join(tempDir, '.planning', 'formal'), { recursive: true });
    const reqPath = path.join(tempDir, '.planning', 'formal', 'requirements.json');
    const data = {
      requirements: [
        { id: 'REQ-01', text: 'Baseline 1', provenance: { source_file: 'nf-baseline' } },
        { id: 'REQ-02', text: 'Milestone 1', provenance: { source_file: '.planning/milestones/v0.41-REQUIREMENTS.md' } },
        { id: 'REQ-03', text: 'Baseline 2', provenance: { source_file: 'nf-baseline' } },
      ]
    };
    fs.writeFileSync(reqPath, JSON.stringify(data));

    const result = checkBaselinePresence(tempDir);

    assert.strictEqual(result.has_baselines, true, 'Should indicate baselines present');
    assert.strictEqual(result.baseline_count, 2, 'Should count 2 baseline requirements');
    assert.strictEqual(result.total_count, 3, 'Total should be 3');
  } finally {
    cleanupTempDir(tempDir);
  }
});

// Test 4: Missing requirements.json file returns has_baselines: false, file_missing: true
test('Missing requirements.json file returns has_baselines: false, file_missing: true', function() {
  const tempDir = createTempDir();
  try {
    // Create directory but no requirements.json
    fs.mkdirSync(path.join(tempDir, '.planning', 'formal'), { recursive: true });

    const result = checkBaselinePresence(tempDir);

    assert.strictEqual(result.has_baselines, false, 'Should indicate no baselines');
    assert.strictEqual(result.file_missing, true, 'File should be missing');
    assert.strictEqual(result.baseline_count, 0, 'No baseline requirements');
    assert.strictEqual(result.total_count, 0, 'Total should be 0');
  } finally {
    cleanupTempDir(tempDir);
  }
});

// Test 5: Requirements without provenance field returns has_baselines: false
test('Requirements without provenance field returns has_baselines: false', function() {
  const tempDir = createTempDir();
  try {
    fs.mkdirSync(path.join(tempDir, '.planning', 'formal'), { recursive: true });
    const reqPath = path.join(tempDir, '.planning', 'formal', 'requirements.json');
    const data = {
      requirements: [
        { id: 'REQ-01', text: 'No provenance' },
        { id: 'REQ-02', text: 'Also no provenance' },
      ]
    };
    fs.writeFileSync(reqPath, JSON.stringify(data));

    const result = checkBaselinePresence(tempDir);

    assert.strictEqual(result.has_baselines, false, 'Should indicate no baselines (no provenance)');
    assert.strictEqual(result.baseline_count, 0, 'No baseline requirements');
    assert.strictEqual(result.total_count, 2, 'Total should be 2');
  } finally {
    cleanupTempDir(tempDir);
  }
});

// Test 6: Malformed JSON file returns fail-open with error field set
test('Malformed JSON file returns fail-open with error field set', function() {
  const tempDir = createTempDir();
  try {
    fs.mkdirSync(path.join(tempDir, '.planning', 'formal'), { recursive: true });
    const reqPath = path.join(tempDir, '.planning', 'formal', 'requirements.json');
    fs.writeFileSync(reqPath, 'not valid json { broken');

    const result = checkBaselinePresence(tempDir);

    assert.strictEqual(result.has_baselines, false, 'Should indicate no baselines (fail-open)');
    assert.strictEqual(result.file_missing, false, 'File exists (parse error, not missing)');
    assert.strictEqual(result.baseline_count, 0, 'No baseline requirements');
    assert.ok(result.error, 'Should have error field set');
    assert.match(result.error, /Unexpected token|JSON|malformed/i, 'Error should mention JSON parsing');
  } finally {
    cleanupTempDir(tempDir);
  }
});

console.log('All baseline check tests completed');
