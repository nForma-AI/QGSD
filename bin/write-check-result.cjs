'use strict';

const fs   = require('fs');
const path = require('path');

const VALID_RESULTS    = ['pass', 'fail', 'warn', 'inconclusive'];
const VALID_FORMALISMS = ['tla', 'alloy', 'prism', 'trace', 'redaction'];

/**
 * Path to the NDJSON output file.
 * Use CHECK_RESULTS_PATH env var to redirect in tests (avoids polluting real output).
 */
const NDJSON_PATH = process.env.CHECK_RESULTS_PATH ||
  path.join(__dirname, '..', 'formal', 'check-results.ndjson');

/**
 * Append one normalized check result line to formal/check-results.ndjson.
 *
 * @param {Object} entry
 * @param {string} entry.tool       - Name of the tool/runner (e.g. 'run-tlc')
 * @param {string} entry.formalism  - One of VALID_FORMALISMS
 * @param {string} entry.result     - One of VALID_RESULTS
 * @param {Object} [entry.metadata] - Optional extra fields (spec, config, etc.)
 * @throws {Error} On validation failure
 */
function writeCheckResult(entry) {
  if (!entry || typeof entry.tool !== 'string' || entry.tool.length === 0) {
    throw new Error('[write-check-result] tool is required and must be a non-empty string');
  }
  if (!VALID_FORMALISMS.includes(entry.formalism)) {
    throw new Error(
      '[write-check-result] formalism must be one of: ' + VALID_FORMALISMS.join(', ') +
      ' (got: ' + entry.formalism + ')'
    );
  }
  if (!VALID_RESULTS.includes(entry.result)) {
    throw new Error(
      '[write-check-result] result must be one of: ' + VALID_RESULTS.join(', ') +
      ' (got: ' + entry.result + ')'
    );
  }

  const record = {
    tool:      entry.tool,
    formalism: entry.formalism,
    result:    entry.result,
    timestamp: new Date().toISOString(),
    metadata:  entry.metadata || {},
  };

  fs.appendFileSync(NDJSON_PATH, JSON.stringify(record) + '\n', 'utf8');
}

module.exports = { writeCheckResult, NDJSON_PATH, VALID_RESULTS, VALID_FORMALISMS };
