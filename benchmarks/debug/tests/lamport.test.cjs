'use strict';
// benchmarks/debug/tests/lamport.test.cjs
// Verifies the Lamport clock causal-ordering invariant:
//   If A sends at time T_send, B's receive must be assigned T_recv > T_send (strictly greater).
//
// The bug (missing +1) only manifests when localClock == receivedTimestamp.
// TLC finds this via exhaustive enumeration of all (local, received) pairs.

const { receive } = require('../../../bin/bench-buggy-extreme-lamport.cjs');
let failed = 0;

function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// Enumerate critical boundary: local == received (the case that requires +1)
// For each clock value t, receive(t, t) must return strictly > t
for (var t = 0; t <= 5; t++) {
  var result = receive(t, t);
  assert(
    'causal order when local == received (t=' + t + ')',
    result > t,
    'receive(' + t + ',' + t + ') returned ' + result + ', want > ' + t
  );
}

// Also verify: when received > local, result is still > received (not just > local)
var t2 = receive(2, 7);
assert('receive when received > local', t2 > 7, 'receive(2,7) returned ' + t2 + ', want > 7');

process.exit(failed > 0 ? 1 : 0);
