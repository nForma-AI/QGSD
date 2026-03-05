'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { sweepPtoF } = require('./sweepPtoF.cjs');
const { autoClosePtoF } = require('./autoClosePtoF.cjs');
const { canTransition } = require('./debt-state-machine.cjs');

describe('P->F Integration Tests', () => {
  let tmpDir;

  function seedLedger(entries) {
    const formalDir = path.join(tmpDir, '.planning', 'formal');
    fs.mkdirSync(formalDir, { recursive: true });
    const ledgerPath = path.join(formalDir, 'debt.json');
    fs.writeFileSync(ledgerPath, JSON.stringify({
      schema_version: '1',
      created_at: '2026-01-01T00:00:00.000Z',
      last_updated: '2026-01-01T00:00:00.000Z',
      debt_entries: entries,
    }));
    return ledgerPath;
  }

  function seedSpec(relPath, content) {
    const specDir = path.join(tmpDir, '.planning', 'formal', 'spec');
    const filePath = path.join(specDir, relPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
    return specDir;
  }

  function readLedgerEntries(ledgerPath) {
    return JSON.parse(fs.readFileSync(ledgerPath, 'utf8')).debt_entries;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptof-integ-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Test 1: sweepPtoF produces correct residual from mixed entries', () => {
    const specDir = seedSpec('safety/MCsafety.cfg', 'MaxDeliberation = 5\nTimeout = 30\n');
    const ledgerPath = seedLedger([
      // Entry A: acknowledged drift, divergent (measured=10, expected=5)
      { id: 'A', status: 'acknowledged', issue_type: 'drift', formal_ref: 'spec:safety/MCsafety.cfg:MaxDeliberation', meta: { measured_value: 10 }, title: 'MaxDeliberation drift' },
      // Entry B: acknowledged issue, requirement ref (returns null from extractFormalExpected)
      { id: 'B', status: 'acknowledged', issue_type: 'issue', formal_ref: 'requirement:REL-01', meta: { measured_value: 'failing' }, title: 'Reliability failure' },
      // Entry C: open, should be excluded (PF-03)
      { id: 'C', status: 'open', issue_type: 'drift', formal_ref: 'spec:safety/MCsafety.cfg:Timeout', meta: { measured_value: 60 }, title: 'Timeout drift' },
      // Entry D: acknowledged, unlinked (no formal_ref)
      { id: 'D', status: 'acknowledged', issue_type: 'drift', formal_ref: null, meta: { measured_value: 42 }, title: 'Unlinked entry' },
    ]);

    // Seed a requirements file for the linker (won't affect much here)
    fs.writeFileSync(path.join(tmpDir, '.planning', 'formal', 'requirements.json'), JSON.stringify([]));

    const result = sweepPtoF({ root: tmpDir });

    // Entry A diverges (10 != 5) -> residual=1
    assert.strictEqual(result.residual, 1);
    assert.strictEqual(result.detail.divergent_entries.length, 1);
    assert.strictEqual(result.detail.divergent_entries[0].id, 'A');

    // Entry C (open) should NOT appear
    const ids = result.detail.divergent_entries.map(e => e.id);
    assert.ok(!ids.includes('C'), 'Open entries should not be in divergent list');

    // Entry D (unlinked) should be in skipped
    assert.strictEqual(result.detail.skipped_unlinked, 1);
    assert.deepStrictEqual(result.detail.skipped_unlinked_ids, ['D']);

    // Entry B has requirement ref which returns null from extractFormalExpected
    // compareDrift returns false when expected is null -> not divergent
    assert.ok(!ids.includes('B'), 'Requirement ref entries should not diverge (expected=null)');
  });

  it('Test 2: autoClosePtoF dispatches parameter update and resolves entry', () => {
    const specDir = seedSpec('safety/MCsafety.cfg', 'MaxDeliberation = 5\n');
    const ledgerPath = seedLedger([
      { id: 'A', status: 'acknowledged', issue_type: 'drift', formal_ref: 'spec:safety/MCsafety.cfg:MaxDeliberation', meta: { measured_value: 10 }, title: 'MaxDeliberation drift' },
    ]);

    const residual = sweepPtoF({ root: tmpDir });
    assert.strictEqual(residual.residual, 1);

    let spawnArgs = null;
    const mockSpawn = (script, args) => {
      spawnArgs = { script, args };
      return { ok: true };
    };

    const closeResult = autoClosePtoF(residual, {
      spawnTool: mockSpawn,
      ledgerPath,
      specDir,
    });

    assert.strictEqual(closeResult.entries_processed, 1);
    assert.ok(closeResult.actions_taken[0].includes('Dispatched parameter update for A'));

    // Verify spawn was called with correct context
    assert.ok(spawnArgs);
    assert.ok(spawnArgs.args.some(a => a.includes('MaxDeliberation')));
    assert.ok(spawnArgs.args.some(a => a.includes('10')));

    // Verify entry transitioned to resolved in persisted ledger
    const entries = readLedgerEntries(ledgerPath);
    assert.strictEqual(entries[0].status, 'resolved');
    assert.ok(entries[0].resolved_at); // State machine adds resolved_at
  });

  it('Test 3: investigation track flags issue entries without dispatch', () => {
    // Create a spec file so isNumericThreshold can be tested
    const specDir = seedSpec('safety/thresholds.json', JSON.stringify({ threshold: 100 }));
    const ledgerPath = seedLedger([
      { id: 'B', status: 'acknowledged', issue_type: 'issue', formal_ref: 'spec:safety/thresholds.json:threshold', meta: { measured_value: 200 }, title: 'Threshold violation' },
    ]);

    const residual = sweepPtoF({ root: tmpDir });
    assert.strictEqual(residual.residual, 1);

    let spawnCalled = false;
    const mockSpawn = () => { spawnCalled = true; return { ok: true }; };

    const closeResult = autoClosePtoF(residual, {
      spawnTool: mockSpawn,
      ledgerPath,
      specDir,
    });

    // issue_type='issue' -> investigation track, no dispatch
    assert.strictEqual(spawnCalled, false);
    assert.ok(closeResult.actions_taken[0].includes('Flagged B for investigation'));

    const entries = readLedgerEntries(ledgerPath);
    assert.strictEqual(entries[0].status, 'resolving'); // Frozen for investigation
    assert.ok(entries[0].meta.investigation_notes.includes('manual review'));
  });

  it('Test 4: freeze semantics - resolving entries cannot revert to open', () => {
    const specDir = seedSpec('safety/MCsafety.cfg', 'MaxDeliberation = 5\n');
    const ledgerPath = seedLedger([
      { id: 'X', status: 'acknowledged', issue_type: 'drift', formal_ref: 'spec:safety/MCsafety.cfg:MaxDeliberation', meta: { measured_value: 10 }, title: 'test' },
    ]);

    const residual = sweepPtoF({ root: tmpDir });
    autoClosePtoF(residual, {
      spawnTool: () => ({ ok: false }), // Fail dispatch -> entry stays in resolving
      ledgerPath,
      specDir,
    });

    const entries = readLedgerEntries(ledgerPath);
    assert.strictEqual(entries[0].status, 'resolving');

    // Verify resolving cannot transition back to open
    assert.strictEqual(canTransition('resolving', 'open'), false);
    // Verify resolving cannot transition to acknowledged
    assert.strictEqual(canTransition('resolving', 'acknowledged'), false);
    // Only valid transition from resolving is resolved
    assert.strictEqual(canTransition('resolving', 'resolved'), true);
  });

  it('Test 5: full pipeline smoke - sweep -> autoClose -> verify final state', () => {
    const specDir = seedSpec('safety/MCsafety.cfg', 'MaxDeliberation = 5\nMaxSize = 3\n');
    const ledgerPath = seedLedger([
      // A: acknowledged drift, divergent -> will be dispatched and resolved
      { id: 'A', status: 'acknowledged', issue_type: 'drift', formal_ref: 'spec:safety/MCsafety.cfg:MaxDeliberation', meta: { measured_value: 10 }, title: 'test' },
      // B: acknowledged issue -> will be flagged for investigation
      { id: 'B', status: 'acknowledged', issue_type: 'issue', formal_ref: 'requirement:REL-01', meta: { measured_value: 'fail' }, title: 'test' },
      // C: open -> untouched
      { id: 'C', status: 'open', issue_type: 'drift', formal_ref: 'spec:safety/MCsafety.cfg:MaxSize', meta: { measured_value: 99 }, title: 'test' },
      // D: acknowledged, unlinked -> untouched (skipped)
      { id: 'D', status: 'acknowledged', issue_type: 'drift', formal_ref: null, meta: { measured_value: 42 }, title: 'test' },
    ]);

    // 1. Sweep
    const residual = sweepPtoF({ root: tmpDir });
    assert.strictEqual(residual.residual, 1); // Only A diverges

    // 2. Auto-close
    const closeResult = autoClosePtoF(residual, {
      spawnTool: () => ({ ok: true }),
      ledgerPath,
      specDir,
    });
    assert.strictEqual(closeResult.entries_processed, 1);

    // 3. Verify final ledger state
    const entries = readLedgerEntries(ledgerPath);
    const byId = Object.fromEntries(entries.map(e => [e.id, e]));

    assert.strictEqual(byId['A'].status, 'resolved');           // Dispatched and resolved
    assert.strictEqual(byId['B'].status, 'acknowledged');       // Not processed (requirement ref -> null -> not divergent)
    assert.strictEqual(byId['C'].status, 'open');               // Untouched (not acknowledged)
    assert.strictEqual(byId['D'].status, 'acknowledged');       // Untouched (unlinked)
  });
});
