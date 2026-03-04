/**
 * Debt ledger write-through for /qgsd:observe
 * Upserts observations to .formal/debt.json by fingerprint using v0.27-01 functions
 *
 * CRITICAL: Never compute fingerprints inline — always use imported v0.27-01 functions
 */

const crypto = require('node:crypto');
const path = require('node:path');
const { readDebtLedger, writeDebtLedger } = require('./debt-ledger.cjs');
const { fingerprintIssue } = require('./fingerprint-issue.cjs');
const { fingerprintDrift } = require('./fingerprint-drift.cjs');
const { validateDebtEntry } = require('./validate-debt-entry.cjs');

/**
 * Write observations from observe command to debt ledger
 * Upserts by fingerprint: new entries are created, existing entries get occurrences++ and last_seen updated
 *
 * @param {object[]} observations - Array of issue/drift objects from handlers (standard schema)
 * @param {string} [ledgerPath] - Path to debt.json (default: .formal/debt.json)
 * @returns {object} { written: number, updated: number, errors: number }
 */
function writeObservationsToDebt(observations, ledgerPath) {
  const resolvedPath = ledgerPath || path.resolve(process.cwd(), '.formal/debt.json');
  const ledger = readDebtLedger(resolvedPath);
  const now = new Date().toISOString();

  let written = 0;
  let updated = 0;
  let errors = 0;

  for (const obs of observations) {
    try {
      // Compute fingerprint using v0.27-01 functions (NEVER inline)
      let fp;
      if (obs.issue_type === 'drift') {
        fp = fingerprintDrift({
          formal_parameter_key: obs.formal_parameter_key || obs.title
        });
      } else {
        fp = fingerprintIssue({
          exception_type: obs.exception_type || obs.source_type || 'unknown',
          function_name: obs.function_name || 'unknown',
          message: obs.title || ''
        });
      }

      // Search for existing entry by fingerprint
      const existingIdx = ledger.debt_entries.findIndex(e => e.fingerprint === fp);

      if (existingIdx >= 0) {
        // Update existing entry
        const existing = ledger.debt_entries[existingIdx];
        existing.occurrences = (existing.occurrences || 1) + 1;
        existing.last_seen = now;
        existing.source_entries.push({
          source_type: obs.source_type || 'unknown',
          source_id: obs.id || `obs-${Date.now()}`,
          observed_at: obs.created_at || now
        });
        updated++;
      } else {
        // Create new debt entry
        const entry = {
          id: crypto.randomUUID(),
          fingerprint: fp,
          title: (obs.title || 'Unknown observation').slice(0, 256),
          occurrences: 1,
          first_seen: now,
          last_seen: now,
          environments: ['production'],
          status: 'open',
          formal_ref: obs.formal_parameter_key || null,
          source_entries: [{
            source_type: obs.source_type || 'unknown',
            source_id: obs.id || `obs-${Date.now()}`,
            observed_at: obs.created_at || now
          }]
        };

        // Validate before adding
        const validation = validateDebtEntry(entry);
        if (validation !== true) {
          console.warn(`[observe-debt-writer] Skipping invalid entry: ${validation.join('; ')}`);
          errors++;
          continue;
        }

        ledger.debt_entries.push(entry);
        written++;
      }
    } catch (err) {
      console.warn(`[observe-debt-writer] Error processing observation: ${err.message}`);
      errors++;
    }
  }

  // Write updated ledger
  if (written > 0 || updated > 0) {
    writeDebtLedger(resolvedPath, ledger);
  }

  return { written, updated, errors };
}

module.exports = { writeObservationsToDebt };
