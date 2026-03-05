#!/usr/bin/env node
'use strict';
// bin/analyze-assumptions.test.cjs
// Unit tests for assumption-to-instrumentation analysis CLI
// Requirements: QUICK-172

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  extractTlaAssumptions,
  extractTlaCfgValues,
  extractAlloyAssumptions,
  extractPrismAssumptions,
  scanAllFormalModels,
  crossReference,
  generateGapReport,
  formatMarkdownReport
} = require('./analyze-assumptions.cjs');

const FIXTURES = path.join(__dirname, '..', 'test', 'fixtures');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-assumptions-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── TLA+ extraction tests ───────────────────────────────────────────────────

describe('extractTlaAssumptions', () => {
  it('extracts ASSUME statements from sample.tla', () => {
    const results = extractTlaAssumptions(path.join(FIXTURES, 'sample.tla'));
    const assumes = results.filter(r => r.type === 'assume');
    assert.ok(assumes.length >= 2, `Expected >= 2 ASSUME, got ${assumes.length}`);

    const maxRetries = assumes.find(a => a.name === 'MaxRetries');
    assert.ok(maxRetries, 'Should extract MaxRetries ASSUME');
    assert.strictEqual(maxRetries.source, 'tla');

    const timeout = assumes.find(a => a.name === 'Timeout');
    assert.ok(timeout, 'Should extract Timeout ASSUME');
    assert.strictEqual(timeout.value, 100); // >= 100
  });

  it('extracts CONSTANTS declarations from sample.tla', () => {
    const results = extractTlaAssumptions(path.join(FIXTURES, 'sample.tla'));
    const constants = results.filter(r => r.type === 'constant');
    assert.ok(constants.length >= 2, `Expected >= 2 constants, got ${constants.length}`);

    const names = constants.map(c => c.name);
    assert.ok(names.includes('MaxRetries'), 'Should include MaxRetries constant');
    assert.ok(names.includes('Timeout'), 'Should include Timeout constant');
  });

  it('extracts invariant definitions from sample.tla', () => {
    const results = extractTlaAssumptions(path.join(FIXTURES, 'sample.tla'));
    const invariants = results.filter(r => r.type === 'invariant');
    const names = invariants.map(i => i.name);
    assert.ok(names.includes('SampleInvariant'), 'Should extract SampleInvariant');
    assert.ok(names.includes('TypeOK'), 'Should extract TypeOK');
  });

  it('handles empty file gracefully', () => {
    const emptyFile = path.join(tmpDir, 'empty.tla');
    fs.writeFileSync(emptyFile, '');
    const results = extractTlaAssumptions(emptyFile);
    assert.deepStrictEqual(results, []);
  });

  it('handles non-existent file gracefully', () => {
    const results = extractTlaAssumptions('/nonexistent/path/file.tla');
    assert.deepStrictEqual(results, []);
  });
});

describe('extractTlaCfgValues', () => {
  it('extracts concrete constant values from sample.cfg', () => {
    const results = extractTlaCfgValues(path.join(FIXTURES, 'sample.cfg'));
    const constants = results.filter(r => r.type === 'constant');

    const maxRetries = constants.find(c => c.name === 'MaxRetries');
    assert.ok(maxRetries, 'Should extract MaxRetries from cfg');
    assert.strictEqual(maxRetries.value, 3);

    const timeout = constants.find(c => c.name === 'Timeout');
    assert.ok(timeout, 'Should extract Timeout from cfg');
    assert.strictEqual(timeout.value, 500);
  });

  it('extracts INVARIANT names from sample.cfg', () => {
    const results = extractTlaCfgValues(path.join(FIXTURES, 'sample.cfg'));
    const invariants = results.filter(r => r.type === 'invariant');
    const names = invariants.map(i => i.name);
    assert.ok(names.includes('SampleInvariant'), 'Should extract SampleInvariant invariant');
  });

  it('extracts PROPERTY names from sample.cfg', () => {
    const results = extractTlaCfgValues(path.join(FIXTURES, 'sample.cfg'));
    const invariants = results.filter(r => r.type === 'invariant');
    const names = invariants.map(i => i.name);
    assert.ok(names.includes('AllValid'), 'Should extract AllValid property');
  });

  it('handles empty cfg file gracefully', () => {
    const emptyFile = path.join(tmpDir, 'empty.cfg');
    fs.writeFileSync(emptyFile, '');
    const results = extractTlaCfgValues(emptyFile);
    assert.deepStrictEqual(results, []);
  });
});

// ── Alloy extraction tests ──────────────────────────────────────────────────

describe('extractAlloyAssumptions', () => {
  it('extracts fact AgentCount with value=5', () => {
    const results = extractAlloyAssumptions(path.join(FIXTURES, 'sample.als'));
    const facts = results.filter(r => r.type === 'fact');
    const agentCount = facts.find(f => f.name === 'AgentCount');
    assert.ok(agentCount, 'Should extract fact AgentCount');
    assert.strictEqual(agentCount.value, 5);
    assert.strictEqual(agentCount.source, 'alloy');
  });

  it('extracts assert ThresholdPasses', () => {
    const results = extractAlloyAssumptions(path.join(FIXTURES, 'sample.als'));
    const asserts = results.filter(r => r.type === 'assert');
    const tp = asserts.find(a => a.name === 'ThresholdPasses');
    assert.ok(tp, 'Should extract assert ThresholdPasses');
    assert.strictEqual(tp.type, 'assert');
  });

  it('extracts numeric constraints from predicates', () => {
    const results = extractAlloyAssumptions(path.join(FIXTURES, 'sample.als'));
    const constraints = results.filter(r => r.type === 'constraint');
    assert.ok(constraints.length >= 1, 'Should extract at least one constraint from pred');
  });

  it('handles empty alloy file gracefully', () => {
    const emptyFile = path.join(tmpDir, 'empty.als');
    fs.writeFileSync(emptyFile, '');
    const results = extractAlloyAssumptions(emptyFile);
    assert.deepStrictEqual(results, []);
  });

  it('handles file with no extractable assumptions', () => {
    const noAssumptions = path.join(tmpDir, 'bare.als');
    fs.writeFileSync(noAssumptions, 'module bare\nsig Empty {}\n');
    const results = extractAlloyAssumptions(noAssumptions);
    assert.deepStrictEqual(results, []);
  });
});

// ── PRISM extraction tests ──────────────────────────────────────────────────

describe('extractPrismAssumptions', () => {
  it('extracts const tp_rate (no value)', () => {
    const results = extractPrismAssumptions(path.join(FIXTURES, 'sample.pm'));
    const tpRate = results.find(r => r.name === 'tp_rate' && r.type === 'const');
    assert.ok(tpRate, 'Should extract const tp_rate');
    assert.strictEqual(tpRate.value, null); // no default value
  });

  it('extracts const max_rounds=9', () => {
    const results = extractPrismAssumptions(path.join(FIXTURES, 'sample.pm'));
    const maxRounds = results.find(r => r.name === 'max_rounds' && r.type === 'const');
    assert.ok(maxRounds, 'Should extract const max_rounds');
    assert.strictEqual(maxRounds.value, 9);
  });

  it('extracts bound s : [0..2]', () => {
    const results = extractPrismAssumptions(path.join(FIXTURES, 'sample.pm'));
    const bound = results.find(r => r.name === 's' && r.type === 'bound');
    assert.ok(bound, 'Should extract bound s');
    assert.strictEqual(bound.value, '[0..2]');
  });

  it('extracts property thresholds from .props file', () => {
    const results = extractPrismAssumptions(path.join(FIXTURES, 'sample.pm'));
    const props = results.filter(r => r.type === 'property');
    assert.ok(props.length >= 2, `Expected >= 2 properties, got ${props.length}`);

    const success = props.find(p => p.name === 'success');
    assert.ok(success, 'Should extract success property');
    assert.strictEqual(success.value, 9); // F<=9
  });

  it('handles missing .props file gracefully', () => {
    const pmOnly = path.join(tmpDir, 'noprops.pm');
    fs.writeFileSync(pmOnly, 'dtmc\nconst int x = 5;\nmodule M\n  s : [0..1] init 0;\nendmodule\n');
    const results = extractPrismAssumptions(pmOnly);
    // Should still extract const and bound without crashing
    assert.ok(results.length >= 1);
  });

  it('handles empty prism file gracefully', () => {
    const emptyFile = path.join(tmpDir, 'empty.pm');
    fs.writeFileSync(emptyFile, '');
    const results = extractPrismAssumptions(emptyFile);
    assert.deepStrictEqual(results, []);
  });
});

// ── Scanner edge case tests ─────────────────────────────────────────────────

describe('scanAllFormalModels', () => {
  it('returns empty array for nonexistent path', () => {
    const results = scanAllFormalModels('/nonexistent/path/that/does/not/exist');
    assert.deepStrictEqual(results, []);
  });

  it('returns empty array for directory without .formal/ subdir', () => {
    const results = scanAllFormalModels(tmpDir);
    assert.deepStrictEqual(results, []);
  });

  it('returns empty array for .formal/ with no model subdirs', () => {
    fs.mkdirSync(path.join(tmpDir, '.formal'), { recursive: true });
    const results = scanAllFormalModels(tmpDir);
    assert.deepStrictEqual(results, []);
  });

  it('scans real .formal/ directory and finds assumptions', () => {
    const results = scanAllFormalModels(process.cwd());
    assert.ok(results.length > 0, `Expected > 0 assumptions from real .formal/, got ${results.length}`);
  });
});

// ── Cross-reference tests ───────────────────────────────────────────────────

describe('crossReference', () => {
  it('marks assumption as covered when debt entry has matching formal_ref', () => {
    // Set up mock debt ledger
    const debtDir = path.join(tmpDir, '.formal');
    fs.mkdirSync(debtDir, { recursive: true });
    fs.writeFileSync(path.join(debtDir, 'debt.json'), JSON.stringify({
      schema_version: '1',
      created_at: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z',
      debt_entries: [{
        id: 'test-debt-1',
        fingerprint: 'abc123',
        title: 'Test debt entry',
        formal_ref: 'spec:sample.tla:MaxRetries',
        occurrences: 1,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        environments: ['test'],
        status: 'open',
        source_entries: [{ source_type: 'bash', source_id: 'test', observed_at: '2026-01-01T00:00:00Z' }]
      }]
    }));

    const assumptions = [
      { source: 'tla', file: 'sample.tla', name: 'MaxRetries', type: 'assume', value: 0 }
    ];

    const results = crossReference(assumptions, { root: tmpDir });
    assert.strictEqual(results[0].coverage, 'covered');
    assert.ok(results[0].matchSource.startsWith('debt:'), 'Should match via debt entry');
  });

  it('marks assumption as covered via fuzzy match when formal_ref is null', () => {
    const debtDir = path.join(tmpDir, '.formal');
    fs.mkdirSync(debtDir, { recursive: true });
    fs.writeFileSync(path.join(debtDir, 'debt.json'), JSON.stringify({
      schema_version: '1',
      created_at: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z',
      debt_entries: [{
        id: 'debt-maxretries-config',
        fingerprint: 'abc123',
        title: 'MaxRetries configuration drift detected',
        formal_ref: null,
        occurrences: 1,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        environments: ['test'],
        status: 'open',
        source_entries: [{ source_type: 'bash', source_id: 'test', observed_at: '2026-01-01T00:00:00Z' }]
      }]
    }));

    const assumptions = [
      { source: 'tla', file: 'sample.tla', name: 'MaxRetries', type: 'assume', value: 0 }
    ];

    const results = crossReference(assumptions, { root: tmpDir });
    assert.strictEqual(results[0].coverage, 'covered');
    assert.ok(results[0].matchSource.includes('fuzzy'), 'Should match via fuzzy');
  });

  it('marks assumption as uncovered with empty debt ledger and no handlers', () => {
    const debtDir = path.join(tmpDir, '.formal');
    fs.mkdirSync(debtDir, { recursive: true });
    fs.writeFileSync(path.join(debtDir, 'debt.json'), JSON.stringify({
      schema_version: '1',
      created_at: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z',
      debt_entries: []
    }));

    const assumptions = [
      { source: 'tla', file: 'sample.tla', name: 'MaxRetries', type: 'assume', value: 0 }
    ];

    const results = crossReference(assumptions, { root: tmpDir });
    assert.strictEqual(results[0].coverage, 'uncovered');
    assert.strictEqual(results[0].matchSource, null);
  });

  it('handles missing debt.json gracefully', () => {
    const assumptions = [
      { source: 'tla', file: 'sample.tla', name: 'MaxRetries', type: 'assume', value: 0 }
    ];

    // Use tmpDir which has no .formal/debt.json
    const results = crossReference(assumptions, { root: tmpDir });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].coverage, 'uncovered');
  });
});

// ── Gap report tests ────────────────────────────────────────────────────────

describe('generateGapReport', () => {
  it('generates metric_name with qgsd_ prefix', () => {
    const input = [
      { source: 'tla', file: 'test.tla', name: 'MaxRetries', type: 'assume', value: 3, coverage: 'uncovered', matchSource: null }
    ];
    const report = generateGapReport(input);
    assert.ok(report.gaps[0].metric_name.startsWith('qgsd_'), 'Metric name should start with qgsd_');
    assert.strictEqual(report.gaps[0].metric_name, 'qgsd_maxretries');
  });

  it('generates correct metric_type for different assumption types', () => {
    const input = [
      { source: 'tla', file: 'a.tla', name: 'SomeInvariant', type: 'invariant', value: null, coverage: 'uncovered', matchSource: null },
      { source: 'tla', file: 'a.tla', name: 'MaxVal', type: 'constant', value: 5, coverage: 'uncovered', matchSource: null }
    ];
    const report = generateGapReport(input);
    const invGap = report.gaps.find(g => g.name === 'SomeInvariant');
    assert.strictEqual(invGap.metric_type, 'counter');
    const constGap = report.gaps.find(g => g.name === 'MaxVal');
    assert.strictEqual(constGap.metric_type, 'gauge');
  });

  it('handles collision with source suffix', () => {
    const input = [
      { source: 'tla', file: 'a.tla', name: 'MaxSize', type: 'constant', value: 3, coverage: 'uncovered', matchSource: null },
      { source: 'alloy', file: 'b.als', name: 'MaxSize', type: 'fact', value: 5, coverage: 'uncovered', matchSource: null }
    ];
    const report = generateGapReport(input);
    const names = report.gaps.map(g => g.metric_name);
    assert.ok(names.includes('qgsd_maxsize__tla'), `Expected qgsd_maxsize__tla, got ${names}`);
    assert.ok(names.includes('qgsd_maxsize__alloy'), `Expected qgsd_maxsize__alloy, got ${names}`);
  });

  it('generates instrumentation_snippet for each gap', () => {
    const input = [
      { source: 'tla', file: 'a.tla', name: 'MaxRetries', type: 'assume', value: 3, coverage: 'uncovered', matchSource: null }
    ];
    const report = generateGapReport(input);
    assert.ok(report.gaps[0].instrumentation_snippet, 'Should have instrumentation snippet');
    assert.ok(report.gaps[0].instrumentation_snippet.includes('observe'), 'Snippet should reference observe handler');
  });

  it('excludes covered assumptions from gaps', () => {
    const input = [
      { source: 'tla', file: 'a.tla', name: 'Covered', type: 'assume', value: 1, coverage: 'covered', matchSource: 'debt:test' },
      { source: 'tla', file: 'a.tla', name: 'Uncovered', type: 'assume', value: 2, coverage: 'uncovered', matchSource: null }
    ];
    const report = generateGapReport(input);
    assert.strictEqual(report.total_assumptions, 2);
    assert.strictEqual(report.covered, 1);
    assert.strictEqual(report.uncovered, 1);
    assert.strictEqual(report.gaps.length, 1);
    assert.strictEqual(report.gaps[0].name, 'Uncovered');
  });

  it('includes partial assumptions in gaps', () => {
    const input = [
      { source: 'tla', file: 'a.tla', name: 'Partial', type: 'constant', value: 5, coverage: 'partial', matchSource: 'handler:bash(generic)' }
    ];
    const report = generateGapReport(input);
    assert.strictEqual(report.partial, 1);
    assert.strictEqual(report.gaps.length, 1);
  });

  it('report JSON has correct counts', () => {
    const input = [
      { source: 'tla', file: 'a.tla', name: 'A', type: 'assume', value: 1, coverage: 'covered', matchSource: 'debt:1' },
      { source: 'tla', file: 'a.tla', name: 'B', type: 'constant', value: 2, coverage: 'partial', matchSource: 'handler:bash' },
      { source: 'tla', file: 'a.tla', name: 'C', type: 'invariant', value: null, coverage: 'uncovered', matchSource: null },
      { source: 'tla', file: 'a.tla', name: 'D', type: 'assume', value: 3, coverage: 'uncovered', matchSource: null }
    ];
    const report = generateGapReport(input);
    assert.strictEqual(report.total_assumptions, 4);
    assert.strictEqual(report.covered, 1);
    assert.strictEqual(report.partial, 1);
    assert.strictEqual(report.uncovered, 2);
    assert.strictEqual(report.gaps.length, 3); // partial + 2 uncovered
  });
});

// ── Markdown report test ────────────────────────────────────────────────────

describe('formatMarkdownReport', () => {
  it('generates valid markdown', () => {
    const report = {
      total_assumptions: 5, covered: 2, partial: 1, uncovered: 2,
      gaps: [
        { source: 'tla', name: 'X', type: 'assume', coverage: 'uncovered', metric_name: 'qgsd_x', metric_type: 'gauge', instrumentation_snippet: '// snippet' }
      ]
    };
    const md = formatMarkdownReport(report);
    assert.ok(md.includes('# Assumption-to-Instrumentation Gap Report'), 'Should have title');
    assert.ok(md.includes('Total assumptions'), 'Should have summary');
    assert.ok(md.includes('qgsd_x'), 'Should include metric name');
  });

  it('generates empty-gaps message when all covered', () => {
    const report = { total_assumptions: 3, covered: 3, partial: 0, uncovered: 0, gaps: [] };
    const md = formatMarkdownReport(report);
    assert.ok(md.includes('All assumptions are covered'), 'Should indicate full coverage');
  });
});

// ── Integration test ────────────────────────────────────────────────────────

describe('integration', () => {
  it('full scan of real .formal/ directory produces non-zero results', () => {
    const assumptions = scanAllFormalModels(process.cwd());
    assert.ok(assumptions.length > 0, `Expected > 0 assumptions, got ${assumptions.length}`);

    // Verify no crashes on cross-reference
    const crossRefed = crossReference(assumptions, { root: process.cwd() });
    assert.strictEqual(crossRefed.length, assumptions.length);

    // Verify gap report generation
    const report = generateGapReport(crossRefed);
    assert.ok(report.total_assumptions > 0);
    assert.strictEqual(report.total_assumptions, report.covered + report.partial + report.uncovered);
  });

  it('all sources represented in real scan', () => {
    const assumptions = scanAllFormalModels(process.cwd());
    const sources = new Set(assumptions.map(a => a.source));
    assert.ok(sources.has('tla'), 'Should find TLA+ assumptions');
    assert.ok(sources.has('alloy'), 'Should find Alloy assumptions');
    assert.ok(sources.has('prism'), 'Should find PRISM assumptions');
  });
});
