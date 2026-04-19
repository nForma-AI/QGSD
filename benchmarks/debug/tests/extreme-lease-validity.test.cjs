'use strict';
var { isLeaseValid } = require('../../../bin/bench-buggy-extreme-lease-validity.cjs');
var failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}

// Formal invariant: isLeaseValid(clock, expiry, skew) iff clock < expiry - skew.
var maxSkew = 5;

// Clearly valid: clock well before safe boundary
assert('clearly valid: clock=80 expiry=100 skew=5', isLeaseValid(80, 100, maxSkew) === true, 'got false');

// Clearly expired: clock well past expiry
assert('clearly expired: clock=105 expiry=100 skew=5', isLeaseValid(105, 100, maxSkew) === false, 'got true');

// BOUNDARY: safe cutoff is at expiry - skew = 95.
// At clock=95: 95 < 95 = false → lease has expired the safe window. Must return false.
assert('boundary clock=95 expiry=100 skew=5: invalid', isLeaseValid(95, 100, maxSkew) === false,
  'isLeaseValid(95,100,5) returned true — dual leadership possible with clock skew');

// At clock=94: 94 < 95 = true → still valid
assert('boundary clock=94 expiry=100 skew=5: valid', isLeaseValid(94, 100, maxSkew) === true, 'got false');

// Dual-leadership scenario:
// Old server A: clock=98, lease expiry=100. With bug: 98<100=true (thinks still leader).
// With correct: 98 < 100-5=95 → false (correctly relinquished).
// New server B can safely take over after expiry=100.
assert('old server must have relinquished at clock=98', isLeaseValid(98, 100, maxSkew) === false,
  'isLeaseValid(98,100,5) returned true — dual leadership: new leader starts while old still active');

// Enumerate the safety window region [expiry-skew .. expiry+1]
var expiry = 100;
for (var clock = expiry - maxSkew - 1; clock <= expiry + 1; clock++) {
  var expected = clock < expiry - maxSkew;
  var got = isLeaseValid(clock, expiry, maxSkew);
  assert(
    'isLeaseValid(clock=' + clock + ',expiry=' + expiry + ',skew=' + maxSkew + ')',
    got === expected,
    'expected ' + expected + ' got ' + got
  );
}

// Zero skew: reduces to simple clock < expiry
assert('zero skew: valid', isLeaseValid(9, 10, 0) === true, 'got false');
assert('zero skew: expired', isLeaseValid(10, 10, 0) === false, 'got true');

process.exit(failed > 0 ? 1 : 0);
