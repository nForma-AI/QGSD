#!/usr/bin/env node
'use strict';
// bin/invariant-catalog.test.cjs
// Tests for invariant catalog: .cfg parsing, invariants.md parsing, deduplication, observed mining

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  parseCfgFiles,
  parseSpecInvariants,
  mineObservedInvariants,
  deduplicateInvariants,
} = require('./invariant-catalog.cjs');

// ── Unit tests: .cfg parsing ─────────────────────────────────────────────────

describe('parseCfgFiles', () => {
  it('parses single-line INVARIANT declarations', () => {
    const invs = parseCfgFiles();
    const single = invs.find(i => i.name === 'TypeOK' && i.source === 'tla_cfg');
    assert.ok(single, 'Should find TypeOK from .cfg files');
    assert.equal(single.type, 'declared');
    assert.equal(single.formalism, 'tla');
  });

  it('parses INVARIANTS block format', () => {
    const invs = parseCfgFiles();
    // MCaccount-manager.cfg uses INVARIANTS block format
    const accountInvs = invs.filter(i => i.config === 'MCaccount-manager');
    assert.ok(accountInvs.length >= 4, `Should find 4+ invariants from MCaccount-manager, found ${accountInvs.length}`);
    const names = accountInvs.map(i => i.name);
    assert.ok(names.includes('ActiveIsPoolMember'), 'Should include ActiveIsPoolMember');
  });

  it('parses PROPERTY declarations', () => {
    const invs = parseCfgFiles();
    const props = invs.filter(i => i.name === 'EventualConsensus');
    assert.ok(props.length > 0, 'Should find EventualConsensus property');
  });

  it('all .cfg invariants have source tla_cfg', () => {
    const invs = parseCfgFiles();
    assert.ok(invs.every(i => i.source === 'tla_cfg'), 'All should have source tla_cfg');
  });
});

// ── Unit tests: spec/invariants.md parsing ───────────────────────────────────

describe('parseSpecInvariants', () => {
  it('parses ## section headers as invariant names', () => {
    const invs = parseSpecInvariants();
    assert.ok(invs.length > 0, 'Should find invariants from spec/*/invariants.md');
    const names = invs.map(i => i.name);
    assert.ok(names.includes('MonitoringReachable'), 'Should include MonitoringReachable from breaker');
  });

  it('extracts property_expression from **Property:** lines', () => {
    const invs = parseSpecInvariants();
    const monitoring = invs.find(i => i.name === 'MonitoringReachable');
    assert.ok(monitoring, 'Should find MonitoringReachable');
    assert.ok(monitoring.property_expression, 'Should have property_expression');
    assert.ok(monitoring.property_expression.includes('<>'), 'Should contain temporal operator');
  });

  it('classifies liveness vs safety based on property expression', () => {
    const invs = parseSpecInvariants();
    const monitoring = invs.find(i => i.name === 'MonitoringReachable');
    assert.equal(monitoring.formalism, 'liveness', 'MonitoringReachable should be liveness');
  });

  it('all spec invariants have source spec_invariants_md', () => {
    const invs = parseSpecInvariants();
    assert.ok(invs.every(i => i.source === 'spec_invariants_md'), 'All should have source spec_invariants_md');
  });
});

// ── Unit tests: deduplication ────────────────────────────────────────────────

describe('deduplicateInvariants', () => {
  it('deduplicates same name + same model to one entry with check_references', () => {
    const raw = [
      { name: 'TypeOK', source: 'tla_cfg', source_file: 'tla/MCfoo.cfg', config: 'MCfoo', type: 'declared' },
      { name: 'TypeOK', source: 'tla_cfg', source_file: 'tla/MCfoo.cfg', config: 'MCfoo', type: 'declared' },
    ];
    const deduped = deduplicateInvariants(raw);
    assert.equal(deduped.length, 1, 'Should deduplicate to 1');
    assert.ok(deduped[0].check_references, 'Should have check_references array');
    assert.equal(deduped[0].check_references.length, 2);
  });

  it('keeps same name across different models as separate entries', () => {
    const raw = [
      { name: 'TypeOK', source: 'tla_cfg', source_file: 'tla/MCfoo.cfg', config: 'MCfoo', type: 'declared' },
      { name: 'TypeOK', source: 'tla_cfg', source_file: 'tla/MCbar.cfg', config: 'MCbar', type: 'declared' },
    ];
    const deduped = deduplicateInvariants(raw);
    assert.equal(deduped.length, 2, 'Should keep both -- different models');
  });
});

// ── Unit tests: observed invariants ──────────────────────────────────────────

describe('mineObservedInvariants', () => {
  it('produces at least 1 observed invariant', () => {
    const invs = mineObservedInvariants();
    assert.ok(invs.length >= 1, `Should produce at least 1 observed invariant, got ${invs.length}`);
  });

  it('all observed invariants have confidence "curated"', () => {
    const invs = mineObservedInvariants();
    for (const inv of invs) {
      assert.equal(inv.confidence, 'curated', `${inv.name} should have confidence "curated", got "${inv.confidence}"`);
    }
  });

  it('all observed invariants have type "observed"', () => {
    const invs = mineObservedInvariants();
    for (const inv of invs) {
      assert.equal(inv.type, 'observed', `${inv.name} should have type "observed"`);
    }
  });

  it('observed invariants have evidence_sessions count', () => {
    const invs = mineObservedInvariants();
    for (const inv of invs) {
      assert.ok(typeof inv.evidence_sessions === 'number' && inv.evidence_sessions > 0,
        `${inv.name} should have positive evidence_sessions`);
    }
  });
});

// ── Integration test ─────────────────────────────────────────────────────────

describe('integration', () => {
  it('reads real .cfg files and invariants.md, total_deduplicated in range 50-200', () => {
    const cfgInvs = parseCfgFiles();
    const specInvs = parseSpecInvariants();
    const observedInvs = mineObservedInvariants();
    const all = [...cfgInvs, ...specInvs, ...observedInvs];
    const deduped = deduplicateInvariants(all);

    assert.ok(deduped.length >= 50, `Expected >= 50 deduplicated, got ${deduped.length}`);
    assert.ok(deduped.length <= 200, `Expected <= 200 deduplicated, got ${deduped.length}`);
  });

  it('no invariant has source "unclassified"', () => {
    const cfgInvs = parseCfgFiles();
    const specInvs = parseSpecInvariants();
    const observedInvs = mineObservedInvariants();
    const all = [...cfgInvs, ...specInvs, ...observedInvs];
    const deduped = deduplicateInvariants(all);

    for (const inv of deduped) {
      assert.notEqual(inv.source, 'unclassified', `${inv.name} should not have source "unclassified"`);
    }
  });

  it('generated catalog JSON is valid and has expected structure', () => {
    const catPath = path.join(__dirname, '..', '.planning', 'formal', 'semantics', 'invariant-catalog.json');
    assert.ok(fs.existsSync(catPath), 'invariant-catalog.json should exist');
    const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));
    assert.equal(cat.schema_version, '1');
    assert.ok(cat.generated);
    assert.ok(Array.isArray(cat.invariants));
    assert.ok(cat.summary.total_deduplicated > 0);
    assert.ok(cat.summary.by_type.declared > 0);
    assert.ok(cat.summary.by_source.tla_cfg > 0);
  });
});
