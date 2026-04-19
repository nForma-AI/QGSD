'use strict';
// benchmarks/debug/tests/quorum.test.cjs
// Verifies the split-brain safety invariant:
//   For ANY partition of the cluster into two disjoint groups of sizes [k, n-k],
//   it must be IMPOSSIBLE for both groups to simultaneously have quorum.
//   TLC finds the violation by enumerating all (n, k) combinations.

const { hasQuorum } = require('../../../bin/bench-buggy-extreme-quorum.cjs');
let failed = 0;

function assert(label, cond, info) {
  if (!cond) {
    process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n');
    failed++;
  }
}

// Enumerate all cluster sizes and all partitions
for (var n = 3; n <= 7; n++) {
  for (var k = 0; k <= n; k++) {
    var partA = k;
    var partB = n - k;
    var dualQuorum = hasQuorum(n, partA) && hasQuorum(n, partB);
    assert(
      'no split-brain: n=' + n + ' partition=[' + partA + ',' + partB + ']',
      !dualQuorum,
      'both halves simultaneously have quorum (split-brain possible)'
    );
  }
}

// Sanity: a true majority should still have quorum
assert('majority has quorum (n=5, votes=3)', hasQuorum(5, 3));
assert('majority has quorum (n=4, votes=3)', hasQuorum(4, 3));

process.exit(failed > 0 ? 1 : 0);
