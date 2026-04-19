'use strict';
// benchmarks/debug/tests/vector-clock.test.cjs
// Verifies the happens-before relation on vector clocks.
//
// Key formal properties:
//   1. Ordered: if A dominates B per-component, f(A,B) must be true
//   2. Concurrent: if A and B each have at least one strictly greater component,
//      BOTH f(A,B) and f(B,A) must be FALSE
//
// The sum-comparison bug misclassifies concurrent events as ordered.
// TLC finds this by enumerating all (A,B) pairs with 2 processes.

const { f } = require('../../../bin/bench-buggy-extreme-vector-clock.cjs');
let failed = 0;

var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// --- Ordered cases (should pass with both correct and buggy implementations for these) ---
assert('sequential: [0,0] before [1,0]', f([0, 0], [1, 0]));
assert('sequential: [1,0] before [1,1]', f([1, 0], [1, 1]));
assert('sequential: [1,1] before [2,2]', f([1, 1], [2, 2]));

// --- Concurrent cases: sum comparison breaks here ---
// A=[2,1], B=[1,3]: A[0]=2 > B[0]=1 AND A[1]=1 < B[1]=3 → concurrent
// sumA=3 < sumB=4 → buggy returns TRUE (claims A before B) → FAIL
assert(
  'concurrent: [2,1] not before [1,3]',
  !f([2, 1], [1, 3]),
  'sum(A)=3 < sum(B)=4 incorrectly treated as ordered; events are concurrent'
);
assert(
  'concurrent: [1,3] not before [2,1]',
  !f([1, 3], [2, 1]),
  'reverse direction also must be false for concurrent events'
);

// Additional concurrent pairs
assert('concurrent: [3,1] not before [1,2]', !f([3, 1], [1, 2]));
assert('concurrent: [1,2] not before [3,1]', !f([1, 2], [3, 1]));

// --- Irreflexive: A does not happen-before itself ---
assert('irreflexive: [2,2] not before [2,2]', !f([2, 2], [2, 2]));

process.exit(failed > 0 ? 1 : 0);
