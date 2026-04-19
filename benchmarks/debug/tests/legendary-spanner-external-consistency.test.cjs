'use strict';
const { getCommitTimestamp } = require('../../../bin/bench-buggy-legendary-spanner-external-consistency.cjs');
let failed = 0;
function assert(label, actual, expected, info) {
  if (actual !== expected) {
    process.stderr.write('FAIL ' + label + ': expected=' + expected + ' actual=' + actual + (info ? ' ' + info : '') + '\n');
    failed++;
  }
}

// External consistency: commit timestamp must be >= truetime.latest
// so the commit is definitely after the real-time upper bound for all observers
assert('commit at latest bound', getCommitTimestamp({earliest:5, latest:10}), 10);
assert('uses latest not earliest (tt1)', getCommitTimestamp({earliest:10, latest:12}), 12);
assert('uses latest not earliest (tt2)', getCommitTimestamp({earliest:11, latest:13}), 13);
assert('zero interval', getCommitTimestamp({earliest:7, latest:7}), 7);

process.exit(failed > 0 ? 1 : 0);
