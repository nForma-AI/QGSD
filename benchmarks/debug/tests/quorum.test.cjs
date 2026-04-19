'use strict';
// benchmarks/debug/tests/quorum.test.cjs
// Verifies the split-brain safety invariant:
//   For ANY partition of the cluster into two disjoint groups of sizes [k, n-k],
//   it must be IMPOSSIBLE for both groups to simultaneously have quorum.
//   TLC finds the violation by enumerating all (n, k) combinations.

const { f } = require('../../../bin/bench-buggy-extreme-quorum.cjs');
let failed = 0;

var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Enumerate all cluster sizes and all partitions
for (var n = 3; n <= 7; n++) {
  for (var k = 0; k <= n; k++) {
    var partA = k;
    var partB = n - k;
    var dualQuorum = f(n, partA) && f(n, partB);
    assert(
      'no split-brain: n=' + n + ' partition=[' + partA + ',' + partB + ']',
      !dualQuorum,
      'both halves simultaneously have quorum (split-brain possible)'
    );
  }
}

// Sanity: a true majority should still have quorum
assert('majority has quorum (n=5, b=3)', f(5, 3));
assert('majority has quorum (n=4, b=3)', f(4, 3));

process.exit(failed > 0 ? 1 : 0);
