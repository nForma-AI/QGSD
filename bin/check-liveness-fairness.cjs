#!/usr/bin/env node
'use strict';
// bin/check-liveness-fairness.cjs
// CI step: scan all TLA+ MC*.cfg files for liveness properties lacking fairness declarations.
// Emits result='pass' if all fairness declarations found; result='inconclusive' if any missing.
// Always exits 0 (inconclusive is not a build failure).
// Requirements: LIVE-01, LIVE-02

const fs   = require('fs');
const path = require('path');
const { detectLivenessProperties } = require('./run-tlc.cjs');
const { writeCheckResult }         = require('./write-check-result.cjs');
const { getRequirementIds }        = require('./requirement-map.cjs');

const TAG = '[check-liveness-fairness]';

// Allow env var overrides for testing (injected by test scaffold)
const FORMAL_TLA_DIR  = process.env.FORMAL_TLA_DIR  || path.join(__dirname, '..', '.formal', 'tla');
const FORMAL_SPEC_DIR = process.env.FORMAL_SPEC_DIR || path.join(__dirname, '..', '.formal', 'spec');

const startMs = Date.now();

// 1. Discover all MC*.cfg files dynamically
let cfgFiles;
try {
  cfgFiles = fs.readdirSync(FORMAL_TLA_DIR)
    .filter(f => /^MC.*\.cfg$/.test(f))
    .map(f => ({ name: f.replace(/\.cfg$/, ''), path: path.join(FORMAL_TLA_DIR, f) }));
} catch (e) {
  process.stderr.write(TAG + ' Warning: cannot read .formal/tla dir: ' + e.message + '\n');
  cfgFiles = [];
}

// 2. For each config, detect liveness properties without fairness declarations
const allMissing = [];      // { config, properties: string[] }
let configsChecked = 0;

for (const { name, path: cfgPath } of cfgFiles) {
  const missing = detectLivenessProperties(name, cfgPath, FORMAL_SPEC_DIR);
  configsChecked++;
  if (missing.length > 0) {
    allMissing.push({ config: name, properties: missing });
  }
}

// 3. Aggregate results
const runtimeMs = Date.now() - startMs;
const hasMissing = allMissing.length > 0;
const result = hasMissing ? 'inconclusive' : 'pass';

const missingList = allMissing
  .map(({ config, properties }) => config + ': ' + properties.join(', '))
  .join('; ');

const summaryText = hasMissing
  ? 'inconclusive: fairness declarations missing — ' + missingList
  : 'pass: all liveness properties have fairness declarations (' + configsChecked + ' configs checked)';

// 4. Write v2.1 check result
try {
  writeCheckResult({
    tool: 'check-liveness-fairness',
    formalism: 'tla',
    result,
    check_id:   'ci:liveness-fairness-lint',
    surface:    'ci',
    property:   'Liveness fairness declarations — all TLA+ liveness properties documented with WF/SF rationale',
    runtime_ms: runtimeMs,
    summary:    summaryText,
    triage_tags: hasMissing ? ['needs-fairness'] : [],
    requirement_ids: getRequirementIds('ci:liveness-fairness-lint'),
    metadata: {
      configs_checked: configsChecked,
      configs_missing: allMissing.length,
      missing_detail:  allMissing,
    },
  });
} catch (e) {
  process.stderr.write(TAG + ' Warning: failed to write check result: ' + e.message + '\n');
}

// 5. Print summary
process.stdout.write(TAG + ' Result: ' + result + '\n');
if (hasMissing) {
  process.stdout.write(TAG + ' Missing fairness declarations:\n');
  for (const { config, properties } of allMissing) {
    process.stdout.write('  ' + config + ': ' + properties.join(', ') + '\n');
  }
  process.stdout.write(TAG + ' Add ## <PropertyName> sections to the matching .formal/spec/<spec>/invariants.md\n');
} else {
  process.stdout.write(TAG + ' All ' + configsChecked + ' configs have fairness declarations.\n');
}

// Always exit 0 — inconclusive is not a build failure
process.exit(0);
