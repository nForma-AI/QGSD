'use strict';
// scripts/check-benchmark-gate.cjs
// Compares a solve benchmark JSON output against the stored baseline.
// Exits 1 if the score is below the floor; exits 0 if it passes.
//
// Usage:
//   node scripts/check-benchmark-gate.cjs <bench-output.json> [baseline.json]

const fs = require('fs');
const path = require('path');

const outputPath = process.argv[2];
const baselinePath = process.argv[3] || path.join(__dirname, '..', 'benchmarks', 'solve-baseline.json');

if (!outputPath) {
  console.error('Usage: node scripts/check-benchmark-gate.cjs <bench-output.json> [baseline.json]');
  process.exit(1);
}

let output, baseline;

try {
  output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
} catch (e) {
  console.error('ERROR: could not read/parse benchmark output: ' + e.message);
  process.exit(1);
}

try {
  baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
} catch (e) {
  console.error('ERROR: could not read/parse baseline file: ' + e.message);
  process.exit(1);
}

const score = output.pass_rate;
const floor = baseline.pass_rate;

console.log('Benchmark result : pass_rate=' + score + '%  (' + output.passed + '/' + output.total + ' passed)');
console.log('Baseline floor   : pass_rate=' + floor + '%  (updated ' + baseline.updated_at + ')');

if (typeof score !== 'number') {
  console.error('ERROR: benchmark output did not contain a numeric pass_rate');
  process.exit(1);
}

if (score < floor) {
  console.error('\nFAIL: score ' + score + '% is below baseline ' + floor + '% — release blocked.');
  console.error('Fix the regression or advance the baseline with: bash scripts/update-benchmark-baseline.sh ' + score);
  process.exit(1);
}

console.log('\nPASS: score ' + score + '% >= baseline ' + floor + '%');
