'use strict';
// bin/bench-buggy-extreme-quorum.cjs
// Distributed quorum check — determines whether a set of votes constitutes a majority
//
// The split-brain safety invariant:
//   For ANY partition of the cluster into two disjoint groups A and B,
//   it must be IMPOSSIBLE for both groups to simultaneously satisfy hasQuorum().
//   A partition [k, n-k] achieves split-brain iff hasQuorum(n,k) && hasQuorum(n,n-k).
//
// BUG: uses >= Math.floor(n/2) instead of > Math.floor(n/2)
// For even n=4: hasQuorum(4,2) = (2 >= 2) = true on BOTH sides of a [2,2] partition
// → two leaders can be elected simultaneously (split-brain)

function hasQuorum(clusterSize, votes) {
  return votes >= Math.floor(clusterSize / 2);  // BUG: should be > Math.floor(clusterSize / 2)
}

module.exports = { hasQuorum };
