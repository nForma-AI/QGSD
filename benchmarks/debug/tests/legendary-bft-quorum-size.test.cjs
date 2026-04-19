'use strict';
const { bftQuorumSize, bftClusterSize } = require('../../../bin/bench-buggy-legendary-bft-quorum-size.cjs');
let failed = 0;
function assert(label, cond, info) {
  if (!cond) {
    process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n');
    failed++;
  }
}

// With f Byzantine faults, any two quorums must intersect in at least f+1 nodes
// so that at least one intersection node is honest.
// Intersection = 2*q - clusterSize >= f+1 requires q >= (clusterSize + f + 1) / 2 = (3f+1+f+1)/2 = 2f+1
for (var f = 1; f <= 4; f++) {
  var clusterSize = bftClusterSize(f);
  var q = bftQuorumSize(f);
  var intersection = 2 * q - clusterSize;
  assert(
    'BFT quorum intersection >= f+1 for f=' + f,
    intersection >= f + 1,
    'intersection=' + intersection + ' need=' + (f + 1) + ' q=' + q + ' cluster=' + clusterSize
  );
}

// Explicit f=1: correct quorum=3, cluster=4
assert('f=1 quorum is 3 (not 2)', bftQuorumSize(1) >= 3, 'got ' + bftQuorumSize(1));
assert('f=2 quorum is 5 (not 3)', bftQuorumSize(2) >= 5, 'got ' + bftQuorumSize(2));

process.exit(failed > 0 ? 1 : 0);
