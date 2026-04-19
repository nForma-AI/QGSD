'use strict';
var { readSnapshot } = require('../../../bin/bench-buggy-extreme-snapshot-isolation.cjs');
var failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}

var versions = [
  {value: 'v1', commitTs: 1},
  {value: 'v2', commitTs: 3},
  {value: 'v3', commitTs: 5}
];

// Invariant: read at exactly commitTs must return that version.
assert('reads version at exact timestamp 1', readSnapshot(versions, 1) === 'v1',
  'got ' + readSnapshot(versions, 1));
assert('reads version at exact timestamp 3', readSnapshot(versions, 3) === 'v2',
  'got ' + readSnapshot(versions, 3));
assert('reads version at exact timestamp 5', readSnapshot(versions, 5) === 'v3',
  'got ' + readSnapshot(versions, 5));

// In-between timestamps:
assert('reads latest before ts=4', readSnapshot(versions, 4) === 'v2',
  'got ' + readSnapshot(versions, 4));
assert('reads latest before ts=2', readSnapshot(versions, 2) === 'v1',
  'got ' + readSnapshot(versions, 2));

// Before any version:
assert('reads nothing before ts=0', readSnapshot(versions, 0) === null,
  'got ' + readSnapshot(versions, 0));

// Enumerate all integer timestamps 0..6 and verify expected values
var expected = {0: null, 1: 'v1', 2: 'v1', 3: 'v2', 4: 'v2', 5: 'v3', 6: 'v3'};
for (var t = 0; t <= 6; t++) {
  var got = readSnapshot(versions, t);
  assert('read at ts=' + t, got === expected[t], 'expected ' + expected[t] + ' got ' + got);
}

// Single-version case: must be visible at its own commitTs
var single = [{value: 'only', commitTs: 7}];
assert('single version visible at commitTs', readSnapshot(single, 7) === 'only',
  'got ' + readSnapshot(single, 7));
assert('single version invisible before commitTs', readSnapshot(single, 6) === null,
  'got ' + readSnapshot(single, 6));

process.exit(failed > 0 ? 1 : 0);
