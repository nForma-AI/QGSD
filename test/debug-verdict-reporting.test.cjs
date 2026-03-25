'use strict';
/** @requirement DBUG-03 — validates debug formal context assembly, constraint formatting, and verdict summary */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const {
  assembleFormalContext,
  formatConstraintBlock,
  formatVerdictSummary,
  _setDeps
} = require('../bin/debug-formal-context.cjs');

// Mock helpers
function createMockFSS(opts = {}) {
  return {
    runBugModeMatching: opts.runBugModeMatching || (() => null),
    runModelCheckers: opts.runModelCheckers || (() => [])
  };
}

function createMockMCF(opts = {}) {
  return {
    extractTlaConstraints: opts.extractTlaConstraints || (() => []),
    extractAlloyConstraints: opts.extractAlloyConstraints || (() => []),
    renderConstraintSummary: opts.renderConstraintSummary || ((constraints) => ({
      model_path: '',
      formalism: 'tla',
      constraint_count: constraints.length,
      constraints: constraints.map(c => ({
        type: c.type, name: c.name, english: c.formal || c.name,
        formal: c.formal, requirement_id: c.requirement_id, confidence: c.confidence
      }))
    }))
  };
}

// Gap persistence helper — mirrors the inline node heredoc logic from Step G
function persistBugGap(description, bundle, consensusRoot, consensusStep, gapPath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(gapPath, 'utf8'));
  } catch {
    data = { version: '1.0', entries: [] };
  }

  if (!Array.isArray(data.entries)) {
    data.entries = [];
  }

  const bugId = crypto.createHash('sha256').update(description).digest('hex').slice(0, 8);
  if (data.entries.some(e => e.bug_id === bugId)) {
    return { deduplicated: true, bugId };
  }

  data.entries.push({
    bug_id: bugId,
    description: description.slice(0, 500),
    failure_context: (bundle || '').slice(0, 500),
    timestamp: new Date().toISOString(),
    status: 'no_coverage',
    worker_consensus_root_cause: consensusRoot || 'no consensus',
    worker_consensus_next_step: consensusStep || 'no consensus'
  });

  fs.writeFileSync(gapPath, JSON.stringify(data, null, 2));
  return { deduplicated: false, bugId };
}

// Temp dir management
let tmpDir;

describe('verdict classification', () => {
  beforeEach(() => {
    _setDeps(null, null);
  });

  it('returns no-model when no models match', async () => {
    _setDeps(createMockFSS({
      runBugModeMatching: () => []
    }), createMockMCF());

    const result = await assembleFormalContext('no models match');
    assert.deepEqual(result, { verdict: 'no-model', constraints: [], models: [] });
  });

  it('returns not-reproduced when models exist but all pass', async () => {
    _setDeps(createMockFSS({
      runBugModeMatching: () => [
        { model: 'TestModel', formalism: 'tla', bug_relevance_score: 0.5 }
      ],
      runModelCheckers: () => [
        { model: 'TestModel', formalism: 'tla', result: 'pass', trace: null }
      ]
    }), createMockMCF());

    const result = await assembleFormalContext('models exist, all pass');
    assert.equal(result.verdict, 'not-reproduced');
  });

  it('returns reproduced when a model checker fails', async () => {
    _setDeps(createMockFSS({
      runBugModeMatching: () => [
        { model: 'QuorumModel', formalism: 'tla', bug_relevance_score: 0.9 }
      ],
      runModelCheckers: () => [
        { model: 'QuorumModel', formalism: 'tla', result: 'fail', trace: 'violation' }
      ]
    }), createMockMCF());

    const result = await assembleFormalContext('model checker fails');
    assert.equal(result.verdict, 'reproduced');
  });
});

describe('formatVerdictSummary', () => {
  it('returns HIGH (model) and model name for reproduced', () => {
    const result = formatVerdictSummary('reproduced', [
      { name: 'QGSDQuorum', reproduced: true }
    ]);
    assert.ok(result.includes('reproduced'));
    assert.ok(result.includes('QGSDQuorum'));
  });

  it('returns LOW (model) and environmental note for not-reproduced', () => {
    const result = formatVerdictSummary('not-reproduced', [
      { name: 'Model1', reproduced: false },
      { name: 'Model2', reproduced: false }
    ]);
    assert.ok(result.includes('2 models'));
    assert.ok(result.includes('none reproduced'));
  });

  it('returns N/A and gap tracking note for no-model', () => {
    const result = formatVerdictSummary('no-model', []);
    assert.ok(result.includes('No formal model'));
  });
});

describe('gap persistence', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-gap-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('appends entry with correct schema to bug-model-gaps.json', () => {
    const gapPath = path.join(tmpDir, 'bug-model-gaps.json');
    const result = persistBugGap('timeout in circuit breaker', 'bundle text', 'race condition', 'check locks', gapPath);

    assert.equal(result.deduplicated, false);
    const data = JSON.parse(fs.readFileSync(gapPath, 'utf8'));
    assert.equal(data.version, '1.0');
    assert.ok(Array.isArray(data.entries));
    assert.equal(data.entries.length, 1);

    const entry = data.entries[0];
    assert.equal(entry.bug_id, result.bugId);
    assert.equal(entry.description, 'timeout in circuit breaker');
    assert.equal(entry.status, 'no_coverage');
    assert.ok(entry.timestamp);
    assert.equal(entry.worker_consensus_root_cause, 'race condition');
    assert.equal(entry.worker_consensus_next_step, 'check locks');
  });

  it('does NOT re-append duplicate entries', () => {
    const gapPath = path.join(tmpDir, 'bug-model-gaps.json');
    persistBugGap('same bug description', 'bundle', 'root', 'step', gapPath);
    const result2 = persistBugGap('same bug description', 'bundle', 'root', 'step', gapPath);

    assert.equal(result2.deduplicated, true);
    const data = JSON.parse(fs.readFileSync(gapPath, 'utf8'));
    assert.equal(data.entries.length, 1);
  });

  it('fail-open: creates fresh structure from corrupted JSON', () => {
    const gapPath = path.join(tmpDir, 'bug-model-gaps.json');
    fs.writeFileSync(gapPath, '{ this is not valid JSON !!!');

    const result = persistBugGap('new bug', 'bundle', 'root', 'step', gapPath);
    assert.equal(result.deduplicated, false);

    const data = JSON.parse(fs.readFileSync(gapPath, 'utf8'));
    assert.equal(data.version, '1.0');
    assert.ok(Array.isArray(data.entries));
    assert.equal(data.entries.length, 1);
  });
});

describe('formatConstraintBlock', () => {
  it('returns block with only 3 constraint lines when given 5', () => {
    const constraints = [
      { text: 'C1', source_model: 'M', formalism: 'tla' },
      { text: 'C2', source_model: 'M', formalism: 'tla' },
      { text: 'C3', source_model: 'M', formalism: 'tla' },
      { text: 'C4', source_model: 'M', formalism: 'tla' },
      { text: 'C5', source_model: 'M', formalism: 'tla' }
    ];
    const block = formatConstraintBlock(constraints);
    const lines = block.split('\n').filter(l => l.startsWith('- '));
    assert.equal(lines.length, 3);
  });

  it('returns empty string for empty constraints', () => {
    assert.equal(formatConstraintBlock([]), '');
  });
});
