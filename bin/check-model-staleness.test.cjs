'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { checkStaleness } = require('./check-model-staleness.cjs');

test('missing registry returns skipped result', async () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'model-stale-'));
  try {
    const result = checkStaleness(tmpDir);
    assert.strictEqual(result.skipped, true);
    assert.deepStrictEqual(result.stale, []);
    assert.strictEqual(result.total_checked, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('hash computation for mock model file with -- Source: header', async () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'model-stale-'));
  try {
    // Create formal directory structure
    fs.mkdirSync(path.join(tmpDir, '.planning', 'formal'), { recursive: true });

    // Create a mock model file with Source header
    const modelContent = '-- Model: test-model\n-- Source: bin/test-source.cjs\nmod test {}\n';
    const modelPath = path.join(tmpDir, '.planning', 'formal', 'test-model.als');
    fs.writeFileSync(modelPath, modelContent, 'utf8');

    // Create a mock source file
    const sourceContent = 'function test() { return 42; }\n';
    const sourcePath = path.join(tmpDir, 'bin', 'test-source.cjs');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, sourceContent, 'utf8');

    // Create registry with model entry but no hashes
    const registry = {
      version: '1.0',
      last_sync: new Date().toISOString(),
      models: {
        '.planning/formal/test-model.als': {
          version: 1,
          description: 'test model',
        },
      },
    };
    const registryPath = path.join(tmpDir, '.planning', 'formal', 'model-registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');

    // Run check (read-only, no update)
    const result = checkStaleness(tmpDir, { updateHashes: false });

    assert.strictEqual(result.skipped, undefined);
    assert.strictEqual(result.total_checked, 1);
    assert.strictEqual(result.total_stale, 0);
    assert.strictEqual(result.first_hash_count, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('first run (no content_hashes) returns first_hash_count > 0 and zero stale', async () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'model-stale-'));
  try {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'formal'), { recursive: true });

    const modelContent = '-- Model: test1\nmod test1 {}\n';
    const modelPath = path.join(tmpDir, '.planning', 'formal', 'model1.als');
    fs.writeFileSync(modelPath, modelContent, 'utf8');

    const registry = {
      version: '1.0',
      models: {
        '.planning/formal/model1.als': { version: 1 },
      },
    };
    const registryPath = path.join(tmpDir, '.planning', 'formal', 'model-registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    const result = checkStaleness(tmpDir, { updateHashes: false });

    assert.strictEqual(result.total_checked, 1);
    assert.strictEqual(result.total_stale, 0);
    assert.strictEqual(result.first_hash_count, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('changed model content is detected as stale', async () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'model-stale-'));
  try {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'formal'), { recursive: true });

    const modelContent = 'mod changed {}\n';
    const modelPath = path.join(tmpDir, '.planning', 'formal', 'model1.als');
    fs.writeFileSync(modelPath, modelContent, 'utf8');

    const oldHash = crypto.createHash('sha256').update('mod old {}\n').digest('hex');

    const registry = {
      version: '1.0',
      models: {
        '.planning/formal/model1.als': {
          version: 1,
          content_hashes: {
            model_hash: oldHash,
            source_hashes: {},
          },
        },
      },
    };
    const registryPath = path.join(tmpDir, '.planning', 'formal', 'model-registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    const result = checkStaleness(tmpDir, { updateHashes: false });

    assert.strictEqual(result.total_checked, 1);
    assert.strictEqual(result.total_stale, 1);
    assert.strictEqual(result.stale[0].reason, 'model_changed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('changed source content is detected as stale', async () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'model-stale-'));
  try {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'formal'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'bin'), { recursive: true });

    const modelContent = '-- Source: bin/src.cjs\nmod test {}\n';
    const modelPath = path.join(tmpDir, '.planning', 'formal', 'model1.als');
    fs.writeFileSync(modelPath, modelContent, 'utf8');

    const newSourceContent = 'new code\n';
    const sourcePath = path.join(tmpDir, 'bin', 'src.cjs');
    fs.writeFileSync(sourcePath, newSourceContent, 'utf8');

    const oldSourceHash = crypto.createHash('sha256').update('old code\n').digest('hex');
    const modelHash = crypto.createHash('sha256').update(modelContent).digest('hex');

    const registry = {
      version: '1.0',
      models: {
        '.planning/formal/model1.als': {
          version: 1,
          content_hashes: {
            model_hash: modelHash,
            source_hashes: { 'bin/src.cjs': oldSourceHash },
          },
        },
      },
    };
    const registryPath = path.join(tmpDir, '.planning', 'formal', 'model-registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    const result = checkStaleness(tmpDir, { updateHashes: false });

    assert.strictEqual(result.total_stale, 1);
    assert.strictEqual(result.stale[0].reason, 'source_changed');
    assert(result.stale[0].changed_sources.includes('bin/src.cjs'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('graceful degradation when source file is missing', async () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'model-stale-'));
  try {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'formal'), { recursive: true });

    const modelContent = '-- Source: bin/missing.cjs\nmod test {}\n';
    const modelPath = path.join(tmpDir, '.planning', 'formal', 'model1.als');
    fs.writeFileSync(modelPath, modelContent, 'utf8');

    const registry = {
      version: '1.0',
      models: {
        '.planning/formal/model1.als': {
          version: 1,
          content_hashes: {
            model_hash: crypto.createHash('sha256').update(modelContent).digest('hex'),
            source_hashes: {},
          },
        },
      },
    };
    const registryPath = path.join(tmpDir, '.planning', 'formal', 'model-registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    const result = checkStaleness(tmpDir, { updateHashes: false });

    // Should not flag as stale just because source is missing
    assert.strictEqual(result.total_stale, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('default mode (no --update-hashes) does NOT write to registry (read-only verification)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'model-stale-'));
  try {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'formal'), { recursive: true });

    const modelContent = 'mod test {}\n';
    const modelPath = path.join(tmpDir, '.planning', 'formal', 'model1.als');
    fs.writeFileSync(modelPath, modelContent, 'utf8');

    const registry = {
      version: '1.0',
      models: {
        '.planning/formal/model1.als': { version: 1 },
      },
    };
    const registryPath = path.join(tmpDir, '.planning', 'formal', 'model-registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    const beforeHash = crypto.createHash('sha256').update(JSON.stringify(registry)).digest('hex');

    // Run in read-only mode (default)
    checkStaleness(tmpDir, { updateHashes: false });

    const afterContent = fs.readFileSync(registryPath, 'utf8');
    const afterRegistry = JSON.parse(afterContent);
    const afterHash = crypto.createHash('sha256').update(JSON.stringify(afterRegistry)).digest('hex');

    // Registry should be unchanged (or structure-equivalent)
    assert.strictEqual(beforeHash, afterHash);
    assert.strictEqual(afterRegistry.models['.planning/formal/model1.als'].content_hashes, undefined);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('--update-hashes mode DOES write content_hashes to registry', async () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'model-stale-'));
  try {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'formal'), { recursive: true });

    const modelContent = 'mod test {}\n';
    const modelPath = path.join(tmpDir, '.planning', 'formal', 'model1.als');
    fs.writeFileSync(modelPath, modelContent, 'utf8');

    const registry = {
      version: '1.0',
      models: {
        '.planning/formal/model1.als': { version: 1 },
      },
    };
    const registryPath = path.join(tmpDir, '.planning', 'formal', 'model-registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

    // Run with updateHashes = true
    const result = checkStaleness(tmpDir, { updateHashes: true });

    assert.strictEqual(result.first_hash_count, 1);

    const afterRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const entry = afterRegistry.models['.planning/formal/model1.als'];
    assert(entry.content_hashes);
    assert(entry.content_hashes.model_hash);
    assert(typeof entry.content_hashes.source_hashes === 'object');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});
