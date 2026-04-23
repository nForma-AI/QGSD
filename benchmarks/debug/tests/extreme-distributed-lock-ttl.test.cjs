'use strict';
var { f } = require('../../../bin/bench-buggy-extreme-distributed-lock-ttl.cjs');
var failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Lock acquired at t=0 with ttl=10 → expires at t=10.
var lock = {holder: 'A', acquiredAt: 0, ttl: 10};

// No lock: always acquirable
assert('no lock: can acquire', f(5, null) === true, 'got false');

// Clearly active lock: cannot acquire
assert('active lock at t=9', f(9, lock) === false, 'got ' + f(9, lock));

// Clearly expired lock: can acquire
assert('expired lock at t=11', f(11, lock) === true, 'got ' + f(11, lock));

// BOUNDARY: at exact expiry t=10, the lock must NOT yet be acquirable.
// (If it were, two concurrent clients at t=10 could both acquire — dual hold violation.)
assert('boundary t=expiry: NOT acquirable', f(10, lock) === false,
  'f(10, lock) returned true — dual acquire possible at boundary');

// Enumerate boundary region t=8..12
var expected = {8: false, 9: false, 10: false, 11: true, 12: true};
for (var t = 8; t <= 12; t++) {
  var got = f(t, lock);
  assert('boundary t=' + t, got === expected[t], 'expected ' + expected[t] + ' got ' + got);
}

// Verify the dual-acquire scenario explicitly:
// Two concurrent clients, both check at t=10.
var c1 = f(10, lock);
var c2 = f(10, lock);
assert('no dual acquire at boundary', !(c1 && c2),
  'both clients acquired lock at exact expiry boundary');

// Different TTLs
var shortLock = {holder: 'B', acquiredAt: 5, ttl: 3}; // expires at 8
assert('short lock boundary t=8 not acquirable', f(8, shortLock) === false,
  'got ' + f(8, shortLock));
assert('short lock expired at t=9', f(9, shortLock) === true,
  'got ' + f(9, shortLock));

process.exit(failed > 0 ? 1 : 0);
