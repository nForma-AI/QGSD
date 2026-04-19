'use strict';
var { f } = require('../../../bin/bench-buggy-extreme-monotonic-reads.cjs');
var failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Formal invariant: f(prev, new) === (new >= prev).
// Enumerate all (prev, new) pairs in [0..6]:
for (var prev = 0; prev <= 6; prev++) {
  for (var newer = 0; newer <= 6; newer++) {
    var expected = newer >= prev;
    var got = f(prev, newer);
    assert(
      'f(prev=' + prev + ',new=' + newer + ')',
      got === expected,
      'expected ' + expected + ' got ' + got
    );
  }
}

// Key invariant: stale reads must be rejected
for (var p = 1; p <= 5; p++) {
  for (var n = 0; n < p; n++) {
    assert(
      'stale read rejected: prev=' + p + ' new=' + n,
      f(p, n) === false,
      'allowed stale read: newTs=' + n + ' < prevTs=' + p
    );
  }
}

// Equal timestamps are valid (same snapshot, not going backwards)
assert('equal timestamps valid', f(5, 5) === true, 'got false');

// Advancing timestamps valid
assert('advancing valid', f(3, 7) === true, 'got false');

// b=0 with prev=0: valid (equal)
assert('zero to zero valid', f(0, 0) === true, 'got false');

// b=0 with prev=1: INVALID (stale) — but bug returns false for 0>0=false, so this passes by accident.
// The bug is exposed by prev=2,new=1: 1>0=true → bug returns true (stale allowed).
assert('stale: prev=2 new=1 invalid', f(2, 1) === false,
  'f(2,1) returned true — stale read incorrectly allowed');

process.exit(failed > 0 ? 1 : 0);
