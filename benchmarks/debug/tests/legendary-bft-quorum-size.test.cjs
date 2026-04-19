'use strict';
const { f, g } = require('../../../bin/bench-buggy-legendary-bft-quorum-size.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// With b Byzantine faults, any two quorums must intersect in at least b+1 nodes
// so that at least one intersection node is honest.
// Intersection = 2*q - clusterSize >= b+1 requires q >= (clusterSize + b + 1) / 2 = (3f+1+b+1)/2 = 2f+1
for (var b = 1; b <= 4; b++) {
  var clusterSize = g(b);
  var q = f(b);
  var intersection = 2 * q - clusterSize;
  assert(
    'BFT quorum intersection >= b+1 for b=' + b,
    intersection >= b + 1,
    'intersection=' + intersection + ' need=' + (b + 1) + ' q=' + q + ' cluster=' + clusterSize
  );
}

// Explicit b=1: correct quorum=3, cluster=4
assert('b=1 quorum is 3 (not 2)', f(1) >= 3, 'got ' + f(1));
assert('b=2 quorum is 5 (not 3)', f(2) >= 5, 'got ' + f(2));

process.exit(failed > 0 ? 1 : 0);
