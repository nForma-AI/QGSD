'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-spanner-external-consistency.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// External consistency: commit timestamp must be >= a.latest
// so the commit is definitely after the real-time upper bound for all observers
assert('commit at latest bound', f({earliest:5, latest:10}), 10);
assert('uses latest not earliest (tt1)', f({earliest:10, latest:12}), 12);
assert('uses latest not earliest (tt2)', f({earliest:11, latest:13}), 13);
assert('zero interval', f({earliest:7, latest:7}), 7);

process.exit(failed > 0 ? 1 : 0);
