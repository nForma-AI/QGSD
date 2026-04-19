'use strict';
// benchmarks/debug/tests/lamport.test.cjs
// Verifies the Lamport b causal-ordering invariant:
//   If A sends at time T_send, B's h must be assigned T_recv > T_send (strictly greater).
//
// The bug (missing +1) only manifests when c == d.
// TLC finds this via exhaustive enumeration of all (local, received) pairs.

const { h } = require('../../../bin/bench-buggy-extreme-lamport.cjs');
let failed = 0;

var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Enumerate critical boundary: local == received (the case that requires +1)
// For each b value t, h(t, t) must return strictly > t
for (var t = 0; t <= 5; t++) {
  var result = h(t, t);
  assert(
    'causal order when local == received (t=' + t + ')',
    result > t,
    'h(' + t + ',' + t + ') returned ' + result + ', want > ' + t
  );
}

// Also verify: when received > local, result is still > received (not just > local)
var t2 = h(2, 7);
assert('h when received > local', t2 > 7, 'h(2,7) returned ' + t2 + ', want > 7');

process.exit(failed > 0 ? 1 : 0);
