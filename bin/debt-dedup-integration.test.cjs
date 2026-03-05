/**
 * End-to-end integration test for complete dedup pipeline
 * Exercises: observations -> fingerprint dedup -> Levenshtein dedup -> formal-ref link -> ledger write
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { writeObservationsToDebt } = require('./observe-debt-writer.cjs');
const { readDebtLedger } = require('./debt-ledger.cjs');
const { fingerprintIssue } = require('./fingerprint-issue.cjs');

function makeTmpEnv(seedEntries = [], requirements = []) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dedup-int-'));
  const formalDir = path.join(tmpDir, '.planning', 'formal');
  fs.mkdirSync(formalDir, { recursive: true });

  // Seed ledger
  const ledgerPath = path.join(formalDir, 'debt.json');
  const now = new Date().toISOString();
  fs.writeFileSync(ledgerPath, JSON.stringify({
    schema_version: '1',
    created_at: now,
    last_updated: now,
    debt_entries: seedEntries
  }, null, 2));

  // Requirements
  const reqPath = path.join(formalDir, 'requirements.json');
  fs.writeFileSync(reqPath, JSON.stringify(requirements), 'utf8');

  // Spec dir (empty)
  const specDir = path.join(formalDir, 'spec');
  fs.mkdirSync(specDir, { recursive: true });

  return { tmpDir, ledgerPath, reqPath, specDir };
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

test('Integration: cross-source fingerprint dedup', async (t) => {
  await t.test('observations from github + sentry with same fingerprint merge into 1 entry', () => {
    const { tmpDir, ledgerPath, reqPath, specDir } = makeTmpEnv();
    try {
      // obs1 and obs2 have same exception_type + function_name + message = same fingerprint
      // obs3 is different
      const obs = [
        {
          id: 'gh-1', title: 'TypeError in parseConfig',
          source_type: 'github', issue_type: 'issue',
          exception_type: 'TypeError', function_name: 'parseConfig',
          created_at: '2026-03-01T12:00:00Z'
        },
        {
          id: 'sn-1', title: 'TypeError in parseConfig',
          source_type: 'sentry', issue_type: 'issue',
          exception_type: 'TypeError', function_name: 'parseConfig',
          created_at: '2026-03-02T12:00:00Z'
        },
        {
          id: 'bs-1', title: 'SyntaxError in template engine validation module',
          source_type: 'bash', issue_type: 'issue',
          exception_type: 'SyntaxError', function_name: 'templateEngine',
          created_at: '2026-03-03T12:00:00Z'
        }
      ];

      const result = writeObservationsToDebt(obs, ledgerPath, { requirementsPath: reqPath, specDir });
      const ledger = readDebtLedger(ledgerPath);

      // obs1+obs2 share fingerprint, so write loop creates 1 entry (written=1, updated=1)
      // obs3 is different (written=2 total)
      assert.strictEqual(ledger.debt_entries.length, 2);
      // The merged entry should have occurrences: 2 and both source_entries
      const mergedEntry = ledger.debt_entries.find(e => e.title === 'TypeError in parseConfig');
      assert.ok(mergedEntry, 'Merged entry should exist');
      assert.strictEqual(mergedEntry.occurrences, 2);
      assert.strictEqual(mergedEntry.source_entries.length, 2);
      assert.ok(mergedEntry.source_entries.some(se => se.source_type === 'github'));
      assert.ok(mergedEntry.source_entries.some(se => se.source_type === 'sentry'));
    } finally { cleanup(tmpDir); }
  });
});

test('Integration: Levenshtein near-duplicate merge', async (t) => {
  await t.test('similar titles from different sources merge', () => {
    const { tmpDir, ledgerPath, reqPath, specDir } = makeTmpEnv();
    try {
      const obs = [
        {
          id: 'gh-1', title: 'TypeError in authentication handler module',
          source_type: 'github', issue_type: 'issue',
          exception_type: 'TypeError', function_name: 'authHandlerModule',
          created_at: '2026-03-01T12:00:00Z'
        },
        {
          id: 'sn-1', title: 'TypeError in authentication handler service',
          source_type: 'sentry', issue_type: 'issue',
          exception_type: 'TypeError', function_name: 'authHandlerService',
          created_at: '2026-03-02T12:00:00Z'
        }
      ];

      const result = writeObservationsToDebt(obs, ledgerPath, { requirementsPath: reqPath, specDir });
      const ledger = readDebtLedger(ledgerPath);

      assert.strictEqual(ledger.debt_entries.length, 1);
      assert.strictEqual(result.merged, 1);
      // Both source_entries preserved after merge
      assert.strictEqual(ledger.debt_entries[0].source_entries.length, 2);
    } finally { cleanup(tmpDir); }
  });
});

test('Integration: formal reference auto-linking', async (t) => {
  await t.test('observation title matching requirement gets formal_ref', () => {
    const reqs = [
      { id: 'DEBT-01', text: 'Schema validation for debt entries' },
      { id: 'FP-01', text: 'Fingerprint generation algorithm' },
      { id: 'DEBT-02', text: 'Deduplication of debt entries' }
    ];
    const { tmpDir, ledgerPath, reqPath, specDir } = makeTmpEnv([], reqs);
    try {
      const obs = [{
        id: 'gh-1', title: 'Schema validation fails on empty entries',
        source_type: 'github', issue_type: 'issue',
        created_at: '2026-03-01T12:00:00Z'
      }];

      const result = writeObservationsToDebt(obs, ledgerPath, { requirementsPath: reqPath, specDir });
      const ledger = readDebtLedger(ledgerPath);

      assert.strictEqual(result.linked, 1);
      assert.strictEqual(ledger.debt_entries[0].formal_ref, 'requirement:DEBT-01');
      assert.strictEqual(ledger.debt_entries[0].formal_ref_source, 'auto-detect');
    } finally { cleanup(tmpDir); }
  });
});

test('Integration: full lifecycle (write -> dedup -> link -> verify)', async (t) => {
  await t.test('existing entry gets updated, new entry created, dedup + link run', () => {
    // Seed with an existing entry
    const existingFp = fingerprintIssue({
      exception_type: 'TypeError',
      function_name: 'parseConfig',
      message: 'TypeError in parseConfig'
    });

    const seedEntries = [{
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      fingerprint: existingFp,
      title: 'TypeError in parseConfig',
      occurrences: 3,
      first_seen: '2026-02-28T12:00:00Z',
      last_seen: '2026-03-01T12:00:00Z',
      environments: ['production'],
      status: 'open',
      formal_ref: null,
      source_entries: [
        { source_type: 'github', source_id: 'gh-old-1', observed_at: '2026-02-28T12:00:00Z' },
        { source_type: 'github', source_id: 'gh-old-2', observed_at: '2026-03-01T12:00:00Z' },
        { source_type: 'sentry', source_id: 'sn-old-1', observed_at: '2026-03-01T12:00:00Z' }
      ]
    }];

    const reqs = [{ id: 'FP-01', text: 'Fingerprint generation and configuration parsing' }];
    const { tmpDir, ledgerPath, reqPath, specDir } = makeTmpEnv(seedEntries, reqs);

    try {
      const obs = [
        // Should match existing fingerprint -> update
        {
          id: 'gh-new-1', title: 'TypeError in parseConfig',
          source_type: 'github', issue_type: 'issue',
          exception_type: 'TypeError', function_name: 'parseConfig',
          created_at: '2026-03-04T12:00:00Z'
        },
        // Completely new entry
        {
          id: 'sn-new-1', title: 'SyntaxError in template engine validation module',
          source_type: 'sentry', issue_type: 'issue',
          exception_type: 'SyntaxError', function_name: 'templateEngine',
          created_at: '2026-03-04T12:00:00Z'
        }
      ];

      const result = writeObservationsToDebt(obs, ledgerPath, { requirementsPath: reqPath, specDir });
      const ledger = readDebtLedger(ledgerPath);

      // 2 entries total: 1 updated + 1 new
      assert.strictEqual(ledger.debt_entries.length, 2);
      assert.strictEqual(result.written, 1);
      assert.strictEqual(result.updated, 1);

      // Existing entry got updated: occurrences 3 -> 4
      const updatedEntry = ledger.debt_entries.find(e => e.fingerprint === existingFp);
      assert.ok(updatedEntry);
      assert.strictEqual(updatedEntry.occurrences, 4);
      assert.strictEqual(updatedEntry.source_entries.length, 4); // 3 old + 1 new
    } finally { cleanup(tmpDir); }
  });
});

test('Integration: threshold configuration', async (t) => {
  await t.test('high threshold prevents merge, low threshold allows merge', () => {
    // Write two observations with moderately similar titles
    const obs = [
      {
        id: 'gh-1', title: 'TypeError in authentication handler module',
        source_type: 'github', issue_type: 'issue',
        exception_type: 'TypeError', function_name: 'authHandlerModule',
        created_at: '2026-03-01T12:00:00Z'
      },
      {
        id: 'sn-1', title: 'TypeError in authentication handler service',
        source_type: 'sentry', issue_type: 'issue',
        exception_type: 'TypeError', function_name: 'authHandlerService',
        created_at: '2026-03-02T12:00:00Z'
      }
    ];

    // Test 1: high threshold — should NOT merge
    const { tmpDir: tmpDir1, ledgerPath: lp1, reqPath: rp1, specDir: sd1 } = makeTmpEnv();
    try {
      const r1 = writeObservationsToDebt(obs, lp1, { threshold: 0.99, requirementsPath: rp1, specDir: sd1 });
      const l1 = readDebtLedger(lp1);
      assert.strictEqual(l1.debt_entries.length, 2, 'High threshold: should NOT merge');
    } finally { cleanup(tmpDir1); }

    // Test 2: default threshold (0.85) — should merge
    const { tmpDir: tmpDir2, ledgerPath: lp2, reqPath: rp2, specDir: sd2 } = makeTmpEnv();
    try {
      const r2 = writeObservationsToDebt(obs, lp2, { threshold: 0.85, requirementsPath: rp2, specDir: sd2 });
      const l2 = readDebtLedger(lp2);
      assert.strictEqual(l2.debt_entries.length, 1, 'Default threshold: should merge');
    } finally { cleanup(tmpDir2); }
  });
});
