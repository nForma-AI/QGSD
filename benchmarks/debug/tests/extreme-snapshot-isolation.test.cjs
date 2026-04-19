'use strict';
var { f } = require('../../../bin/bench-buggy-extreme-snapshot-isolation.cjs');
var failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var a = [
  {value: 'v1', commitTs: 1},
  {value: 'v2', commitTs: 3},
  {value: 'v3', commitTs: 5}
];

// Invariant: read at exactly commitTs must return that version.
assert('reads version at exact timestamp 1', f(a, 1) === 'v1',
  'got ' + f(a, 1));
assert('reads version at exact timestamp 3', f(a, 3) === 'v2',
  'got ' + f(a, 3));
assert('reads version at exact timestamp 5', f(a, 5) === 'v3',
  'got ' + f(a, 5));

// In-between timestamps:
assert('reads latest before ts=4', f(a, 4) === 'v2',
  'got ' + f(a, 4));
assert('reads latest before ts=2', f(a, 2) === 'v1',
  'got ' + f(a, 2));

// Before any version:
assert('reads nothing before ts=0', f(a, 0) === null,
  'got ' + f(a, 0));

// Enumerate all integer timestamps 0..6 and verify expected values
var expected = {0: null, 1: 'v1', 2: 'v1', 3: 'v2', 4: 'v2', 5: 'v3', 6: 'v3'};
for (var t = 0; t <= 6; t++) {
  var got = f(a, t);
  assert('read at ts=' + t, got === expected[t], 'expected ' + expected[t] + ' got ' + got);
}

// Single-version case: must be visible at its own commitTs
var single = [{value: 'only', commitTs: 7}];
assert('single version visible at commitTs', f(single, 7) === 'only',
  'got ' + f(single, 7));
assert('single version invisible before commitTs', f(single, 6) === null,
  'got ' + f(single, 6));

process.exit(failed > 0 ? 1 : 0);
