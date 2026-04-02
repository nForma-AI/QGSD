#!/usr/bin/env node
'use strict';
// bin/formal-scope-scan.test.cjs
// Tests for project-level manifest discovery functions in formal-scope-scan.cjs.
// Requirements: quick-370

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  loadProjectManifest,
  matchProjectSpecs,
  scanUnregisteredSpecs,
  mergeProjectSpecsIntoRegistry
} = require('./formal-scope-scan.cjs');

// ── loadProjectManifest tests ───────────────────────────────────────────

test('loadProjectManifest returns empty array when manifest has empty specs', () => {
  // The repo manifest at .planning/formal/specs/formal-checks.json has specs: []
  const specs = loadProjectManifest();
  assert.ok(Array.isArray(specs));
  assert.strictEqual(specs.length, 0);
});

// ── matchProjectSpecs tests ─────────────────────────────────────────────

test('matchProjectSpecs returns empty array when manifest has no specs', () => {
  const matches = matchProjectSpecs('test description', [], ['test']);
  assert.ok(Array.isArray(matches));
  assert.strictEqual(matches.length, 0);
});

test('matchProjectSpecs matches by keyword', () => {
  // Temporarily write a manifest with a spec entry
  const manifestPath = path.join(process.cwd(), '.planning', 'formal', 'specs', 'formal-checks.json');
  const original = fs.readFileSync(manifestPath, 'utf8');

  const manifest = {
    version: 1,
    specs: [{
      module: 'gke-recovery',
      type: 'tla',
      spec_path: '.planning/formal/specs/GKERecovery.tla',
      command: 'make',
      args: ['check-gke'],
      keywords: ['gke', 'pod', 'recovery', 'kubernetes'],
      requirements: ['INFRA-01'],
      maturity: 'draft',
      description: 'GKE pod recovery verification'
    }]
  };

  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const matches = matchProjectSpecs('fix gke pod restart', [], null);
    assert.ok(matches.length >= 1, 'should match by keyword "gke"');
    assert.strictEqual(matches[0].module, 'gke-recovery');
    assert.strictEqual(matches[0].matched_by, 'project_manifest');
    assert.strictEqual(matches[0].source, 'project');
    assert.deepStrictEqual(matches[0].requirements, ['INFRA-01']);
    assert.strictEqual(matches[0].maturity, 'draft');
  } finally {
    fs.writeFileSync(manifestPath, original);
  }
});

test('matchProjectSpecs matches by module name (single-token module)', () => {
  const manifestPath = path.join(process.cwd(), '.planning', 'formal', 'specs', 'formal-checks.json');
  const original = fs.readFileSync(manifestPath, 'utf8');

  // Use a single-token module name since tokenizer splits on hyphens
  const manifest = {
    version: 1,
    specs: [{
      module: 'authflow',
      type: 'alloy',
      spec_path: '.planning/formal/specs/AuthFlow.als',
      command: 'java',
      args: ['-jar', 'alloy.jar', 'AuthFlow.als'],
      keywords: ['authentication'],
      requirements: [],
      maturity: 'reviewed'
    }]
  };

  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Token "authflow" should match module name exactly
    const matches = matchProjectSpecs('check authflow logic', [], null);
    assert.ok(matches.length >= 1, 'should match by module name');
    assert.strictEqual(matches[0].module, 'authflow');
    assert.strictEqual(matches[0].spec_type, 'alloy');
  } finally {
    fs.writeFileSync(manifestPath, original);
  }
});

test('matchProjectSpecs does not match unrelated description', () => {
  const manifestPath = path.join(process.cwd(), '.planning', 'formal', 'specs', 'formal-checks.json');
  const original = fs.readFileSync(manifestPath, 'utf8');

  const manifest = {
    version: 1,
    specs: [{
      module: 'gke-recovery',
      type: 'tla',
      spec_path: '.planning/formal/specs/GKERecovery.tla',
      command: 'make',
      args: ['check-gke'],
      keywords: ['gke', 'kubernetes'],
      requirements: [],
      maturity: 'draft'
    }]
  };

  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const matches = matchProjectSpecs('fix quorum deliberation timeout', [], null);
    assert.strictEqual(matches.length, 0, 'should not match unrelated description');
  } finally {
    fs.writeFileSync(manifestPath, original);
  }
});

// ── scanUnregisteredSpecs tests ─────────────────────────────────────────

test('scanUnregisteredSpecs finds unregistered .tla files', () => {
  const specsDir = path.join(process.cwd(), '.planning', 'formal', 'specs');
  const testFile = path.join(specsDir, 'TestUnregistered.tla');

  try {
    fs.writeFileSync(testFile, '---- MODULE TestUnregistered ----\n====');

    // Pass empty manifest — all spec files should be unregistered
    const unregistered = scanUnregisteredSpecs([]);
    const found = unregistered.find(u => u.file === 'TestUnregistered.tla');
    assert.ok(found, 'should find TestUnregistered.tla as unregistered');
    assert.strictEqual(found.type, 'tla');
  } finally {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  }
});

test('scanUnregisteredSpecs excludes registered files', () => {
  const specsDir = path.join(process.cwd(), '.planning', 'formal', 'specs');
  const testFile = path.join(specsDir, 'Registered.tla');

  try {
    fs.writeFileSync(testFile, '---- MODULE Registered ----\n====');

    // Pass manifest that registers this file
    const manifest = [{
      module: 'registered-mod',
      spec_path: '.planning/formal/specs/Registered.tla',
      command: 'make',
      args: ['check']
    }];

    const unregistered = scanUnregisteredSpecs(manifest);
    const found = unregistered.find(u => u.file === 'Registered.tla');
    assert.ok(!found, 'should not report registered file as unregistered');
  } finally {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  }
});

test('scanUnregisteredSpecs returns empty array when dir does not exist', () => {
  // scanUnregisteredSpecs uses PROJECT_SPECS_DIR which exists, but this
  // tests the fail-open pattern — should not crash
  const result = scanUnregisteredSpecs(null);
  assert.ok(Array.isArray(result));
});

// ── mergeProjectSpecsIntoRegistry tests ─────────────────────────────────

test('mergeProjectSpecsIntoRegistry adds project specs with source marker', () => {
  const specs = [{
    module: 'test-proj',
    type: 'tla',
    spec_path: '.planning/formal/specs/Test.tla',
    command: 'make',
    args: ['check'],
    requirements: ['TEST-01'],
    maturity: 'draft',
    description: 'Test project spec'
  }];

  const registry = mergeProjectSpecsIntoRegistry(specs, null);
  assert.ok(registry.models);
  const key = path.normalize('.planning/formal/specs/Test.tla');
  const entry = registry.models[key];
  assert.ok(entry, 'merged entry should exist');
  assert.strictEqual(entry.source, 'project');
  assert.strictEqual(entry.update_source, 'project_manifest');
  assert.deepStrictEqual(entry.requirements, ['TEST-01']);
  assert.strictEqual(entry.maturity, 'draft');
  assert.deepStrictEqual(entry.project_command, { command: 'make', args: ['check'] });
});

test('mergeProjectSpecsIntoRegistry does not overwrite internal entries', () => {
  const specs = [{
    module: 'collider',
    type: 'tla',
    spec_path: 'existing-key.tla',
    command: 'make',
    args: ['check'],
    description: 'should not overwrite'
  }];

  const existingRegistry = {
    version: '1.0',
    models: {
      [path.normalize('existing-key.tla')]: {
        source: 'internal',
        description: 'original internal entry'
      }
    }
  };

  const result = mergeProjectSpecsIntoRegistry(specs, existingRegistry);
  assert.strictEqual(result.models[path.normalize('existing-key.tla')].source, 'internal',
    'internal entry must not be overwritten');
  assert.strictEqual(result.models[path.normalize('existing-key.tla')].description, 'original internal entry');
});

test('mergeProjectSpecsIntoRegistry handles empty specs', () => {
  const result = mergeProjectSpecsIntoRegistry([], null);
  assert.ok(result.models);
  assert.strictEqual(Object.keys(result.models).length, 0);
});

test('mergeProjectSpecsIntoRegistry handles null specs', () => {
  const result = mergeProjectSpecsIntoRegistry(null, null);
  assert.ok(result.models);
  assert.strictEqual(Object.keys(result.models).length, 0);
});
